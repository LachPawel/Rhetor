/**
 * ViewKillFillers — "Kill the Fillers" Interactive Game
 *
 * A 5-round game where the AI asks random questions and the user
 * must answer for 15-20 seconds WITHOUT filler words.
 * Real-time filler detection with red flash, buzzer visual, and scoring.
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeTransition } from './FadeTransition.tsx';
import { AgentMode } from '../types.ts';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { useRhetorStore } from '../stores/useRhetorStore.ts';
import {
  X,
  Zap,
  Trophy,
  Target,
  Coins,
  ChevronRight,
  Shield,
  Volume2,
  Mic,
} from 'lucide-react';

// ============================================================================
// CONSTANTS
// ============================================================================

const TOTAL_ROUNDS = 5;
const ROUND_DURATION = 18; // seconds to answer (15-20 range)
const COUNTDOWN_BEFORE_ROUND = 3;

/** Pool of prompts the AI will ask — we pick randomly per round. */
const QUESTION_PROMPTS = [
  'What did you do last weekend?',
  'Describe your favorite movie and why you love it.',
  'Explain what you do for work to a 10-year-old.',
  "What's a skill you recently learned or want to learn?",
  'Tell me about a trip or vacation that stands out in your memory.',
  'If you could have dinner with anyone, living or dead, who and why?',
  'Describe the perfect morning routine.',
  "What's something most people don't know about you?",
  'Tell me about a challenge you overcame recently.',
  'If you had to teach a class on anything, what would it be?',
];

// ============================================================================
// TYPES
// ============================================================================

interface RoundResult {
  round: number;
  question: string;
  fillerCount: number;
  fillerWords: string[];
  duration: number;
}

type GamePhase =
  | 'intro'
  | 'countdown'
  | 'speaking'
  | 'ai-feedback'
  | 'scoreboard';

interface ViewKillFillersProps {
  onExit: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Pick `n` unique random items from an array. */
function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function getDrachmaReward(totalFillers: number): number {
  if (totalFillers === 0) return 50;
  if (totalFillers < 3) return 30;
  if (totalFillers < 5) return 20;
  return 10;
}

function getGrade(totalFillers: number): { label: string; emoji: string; color: string } {
  if (totalFillers === 0) return { label: 'FLAWLESS', emoji: '🏆', color: 'text-amber-400' };
  if (totalFillers < 3) return { label: 'EXCELLENT', emoji: '⭐', color: 'text-emerald-400' };
  if (totalFillers < 5) return { label: 'GOOD', emoji: '👍', color: 'text-blue-400' };
  if (totalFillers < 8) return { label: 'KEEP GOING', emoji: '💪', color: 'text-purple-400' };
  return { label: 'PRACTICE MORE', emoji: '🔄', color: 'text-stone-400' };
}

// ============================================================================
// COMPONENT
// ============================================================================

export const ViewKillFillers: React.FC<ViewKillFillersProps> = ({ onExit }) => {
  const {
    setMode,
    isConnected,
    connect,
    isSpeaking: aiIsSpeaking,
    aiResponse,
    lastTranscript,
    addDrachmas,
    completeLesson,
  } = useRhetor();

  // ── Store ──────────────────────────────────────────────────────────
  const startSession = useRhetorStore((s) => s.startSession);
  const endSession = useRhetorStore((s) => s.endSession);
  const fillerCountLive = useRhetorStore((s) => s.currentMetrics?.fillerCount ?? 0);
  const recentFillerWord = useRhetorStore((s) => s.recentFillerWord);
  const setNavigationBlocked = useRhetorStore((s) => s.setNavigationBlocked);

  // ── Game State ─────────────────────────────────────────────────────
  const [phase, setPhase] = useState<GamePhase>('intro');
  const [currentRound, setCurrentRound] = useState(0); // 0-indexed
  const [timer, setTimer] = useState(ROUND_DURATION);
  const [countdown, setCountdown] = useState(COUNTDOWN_BEFORE_ROUND);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [drachmaAwarded, setDrachmaAwarded] = useState(0);

  // Questions picked for this game session
  const questions = useMemo(() => pickRandom(QUESTION_PROMPTS, TOTAL_ROUNDS), []);

  // ── Filler tracking per round ──────────────────────────────────────
  const roundFillerStartRef = useRef(0); // fillerCount at round start
  const roundFillerWordsRef = useRef<string[]>([]);
  const transcriptAtRoundStartRef = useRef('');

  // ── Flash & buzzer state ───────────────────────────────────────────
  const [fillerFlash, setFillerFlash] = useState(false);
  const [buzzerWord, setBuzzerWord] = useState<string | null>(null);
  const prevFillerCountRef = useRef(0);

  // ── AI feedback capture ────────────────────────────────────────────
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const prevAiSpeakingRef = useRef(false);

  // Refs for timers
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modeSetRef = useRef(false);

  // ── Connect to Gemini ──────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      if (!isConnected) await connect();
    };
    init();
  }, [isConnected, connect]);

  // Set AI mode once connected
  useEffect(() => {
    if (isConnected && !modeSetRef.current) {
      modeSetRef.current = true;
      setMode(AgentMode.COACH_LESSON, {
        lessonId: 'kill-the-fillers',
        lessonTitle: 'Kill the Fillers',
        lessonDesc:
          'Interactive filler-word elimination game. You ask questions and the student tries to answer without fillers.',
        step: {
          index: 0,
          total: TOTAL_ROUNDS,
          type: 'practice',
          aiPrompt:
            'You are the host of "Kill the Fillers" — a fast-paced game. Wait for instructions before asking a question.',
          expectedAction: 'speak',
          duration: ROUND_DURATION,
        },
      });
    }
  }, [isConnected, setMode]);

  // ── Detect new fillers → flash + buzzer ────────────────────────────
  useEffect(() => {
    if (phase !== 'speaking') return;
    if (fillerCountLive > prevFillerCountRef.current) {
      // New filler detected!
      setFillerFlash(true);
      if (recentFillerWord) {
        setBuzzerWord(recentFillerWord);
        roundFillerWordsRef.current.push(recentFillerWord);
      }
      const timeout = setTimeout(() => {
        setFillerFlash(false);
        setBuzzerWord(null);
      }, 800);
      prevFillerCountRef.current = fillerCountLive;
      return () => clearTimeout(timeout);
    }
  }, [fillerCountLive, recentFillerWord, phase]);

  // ── Capture AI feedback when it finishes speaking ──────────────────
  useEffect(() => {
    if (prevAiSpeakingRef.current && !aiIsSpeaking && aiResponse) {
      setLastFeedback(aiResponse);
    }
    prevAiSpeakingRef.current = aiIsSpeaking;
  }, [aiIsSpeaking, aiResponse]);

  // ── Nav guard ──────────────────────────────────────────────────────
  useEffect(() => {
    setNavigationBlocked(true);
    return () => setNavigationBlocked(false);
  }, [setNavigationBlocked]);

  // ── Cleanup timers ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // ============================================================================
  // GAME FLOW
  // ============================================================================

  /** Start a round: show 3-2-1 countdown, then let user speak */
  const startRound = useCallback(() => {
    setPhase('countdown');
    setCountdown(COUNTDOWN_BEFORE_ROUND);
    setLastFeedback(null);
    setBuzzerWord(null);
    setFillerFlash(false);

    // Tell AI to ask the question for this round
    setMode(AgentMode.COACH_LESSON, {
      lessonId: 'kill-the-fillers',
      lessonTitle: 'Kill the Fillers',
      step: {
        index: currentRound,
        total: TOTAL_ROUNDS,
        type: 'practice',
        aiPrompt: `You are the host of "Kill the Fillers." Ask this question in an energetic, game-show style: "${questions[currentRound]}". Then say "GO!" and listen. Do NOT speak again until told. Keep it to 1-2 sentences max.`,
        expectedAction: 'speak',
        duration: ROUND_DURATION,
      },
    });

    // Start 3-2-1 countdown
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          beginSpeaking();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [currentRound, questions, setMode]);

  /** User is now speaking — start the timer + filler tracking */
  const beginSpeaking = useCallback(() => {
    setPhase('speaking');
    setTimer(ROUND_DURATION);
    roundFillerStartRef.current = fillerCountLive;
    roundFillerWordsRef.current = [];
    transcriptAtRoundStartRef.current = lastTranscript || '';
    prevFillerCountRef.current = fillerCountLive;

    // Start the session metrics if first round
    if (currentRound === 0) {
      startSession();
    }

    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          endRound();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [fillerCountLive, lastTranscript, currentRound, startSession]);

  /** Round ended — record result & ask AI for feedback */
  const endRound = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    const roundFillers = fillerCountLive - roundFillerStartRef.current;
    const result: RoundResult = {
      round: currentRound + 1,
      question: questions[currentRound],
      fillerCount: roundFillers,
      fillerWords: [...roundFillerWordsRef.current],
      duration: ROUND_DURATION,
    };
    setResults((prev) => [...prev, result]);

    // Ask AI for quick feedback
    setPhase('ai-feedback');

    const feedbackPrompt =
      roundFillers === 0
        ? `The student just answered Round ${currentRound + 1} of Kill the Fillers with ZERO filler words! Celebrate this. Say something like "Clean! Zero fillers — that was flawless!" Keep it to 1-2 sentences, energetic and encouraging.`
        : `The student just finished Round ${currentRound + 1} of Kill the Fillers with ${roundFillers} filler word(s): ${roundFillerWordsRef.current.join(', ')}. Give quick, constructive feedback in 1-2 sentences. Example: "${roundFillers} fillers — try replacing '${roundFillerWordsRef.current[0] || 'um'}' with a confident pause." Be encouraging but specific.`;

    setMode(AgentMode.COACH_LESSON, {
      lessonId: 'kill-the-fillers',
      lessonTitle: 'Kill the Fillers',
      step: {
        index: currentRound,
        total: TOTAL_ROUNDS,
        type: 'practice',
        aiPrompt: feedbackPrompt,
        expectedAction: 'listen',
        duration: 10,
      },
    });
  }, [fillerCountLive, currentRound, questions, setMode]);

  /** Move to next round or final scoreboard */
  const advanceRound = useCallback(() => {
    if (currentRound + 1 >= TOTAL_ROUNDS) {
      // Game over
      endSession();
      const totalFillers = results.reduce((sum, r) => sum + r.fillerCount, 0) +
        (fillerCountLive - roundFillerStartRef.current); // include last round if not yet counted
      const reward = getDrachmaReward(totalFillers);
      addDrachmas(reward);
      completeLesson('kill-the-fillers');
      setDrachmaAwarded(reward);
      setPhase('scoreboard');
    } else {
      setCurrentRound((r) => r + 1);
      startRound();
    }
  }, [currentRound, results, fillerCountLive, endSession, addDrachmas, completeLesson, startRound]);

  /** Start the game from intro */
  const handleStart = useCallback(() => {
    setCurrentRound(0);
    setResults([]);
    startRound();
  }, [startRound]);

  /** Auto-advance from AI feedback after a delay or when AI stops speaking */
  useEffect(() => {
    if (phase !== 'ai-feedback') return;
    // Wait for AI to finish speaking, then auto-advance after 2s
    if (!aiIsSpeaking && lastFeedback) {
      const timeout = setTimeout(advanceRound, 2500);
      return () => clearTimeout(timeout);
    }
  }, [phase, aiIsSpeaking, lastFeedback, advanceRound]);

  // ── Restart from startRound when currentRound changes (after first round) ──
  useEffect(() => {
    // startRound is called explicitly, this just ensures proper cleanup
  }, [currentRound]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const currentFillers = phase === 'speaking'
    ? fillerCountLive - roundFillerStartRef.current
    : 0;

  const allResults = results;
  const totalFillers = allResults.reduce((s, r) => s + r.fillerCount, 0);
  const cleanestRound = allResults.length > 0
    ? allResults.reduce((best, r) => (r.fillerCount < best.fillerCount ? r : best))
    : null;

  const timerPct = (timer / ROUND_DURATION) * 100;
  const timerColor =
    timer <= 3
      ? 'text-red-500'
      : timer <= 7
        ? 'text-amber-500'
        : 'text-emerald-400';

  // ============================================================================
  // RENDER
  // ============================================================================

  // ── INTRO ──────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <FadeTransition className="fixed inset-0 bg-stone-900 text-white z-50 flex flex-col">
        <button
          onClick={onExit}
          className="absolute top-6 right-6 text-stone-500 hover:text-white transition-colors z-20"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          {/* Big icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
            className="w-28 h-28 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center mb-8 shadow-[0_0_60px_rgba(239,68,68,0.4)]"
          >
            <Zap className="w-14 h-14 text-white" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-4xl font-serif font-bold mb-3"
          >
            Kill the Fillers
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="text-stone-400 text-base max-w-sm mb-2"
          >
            5 rounds. Random questions. Answer without saying
            <span className="text-red-400 font-semibold"> "um," "uh," "like," "you know"</span> or
            any filler word.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col items-center gap-3 mt-4 mb-8"
          >
            <div className="flex items-center gap-6 text-sm text-stone-500">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-red-400" />
                <span>5 rounds</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>~{ROUND_DURATION}s each</span>
              </div>
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>Up to 50Δ</span>
              </div>
            </div>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleStart}
            className="px-12 py-4 bg-gradient-to-r from-red-500 to-orange-500 text-white text-lg font-bold rounded-2xl shadow-lg shadow-red-500/30 uppercase tracking-wider"
          >
            Let's Go
          </motion.button>
        </div>
      </FadeTransition>
    );
  }

  // ── SCOREBOARD ─────────────────────────────────────────────────────
  if (phase === 'scoreboard') {
    const grade = getGrade(totalFillers);

    return (
      <FadeTransition className="fixed inset-0 bg-stone-900 text-white z-50 flex flex-col overflow-y-auto">
        <button
          onClick={onExit}
          className="absolute top-6 right-6 text-stone-500 hover:text-white transition-colors z-20"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex-1 flex flex-col items-center pt-16 px-6 pb-12">
          {/* Grade */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12 }}
            className="text-7xl mb-4"
          >
            {grade.emoji}
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`text-3xl font-serif font-bold mb-1 ${grade.color}`}
          >
            {grade.label}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="text-stone-400 text-sm mb-8"
          >
            {totalFillers === 0
              ? 'Not a single filler. Legendary.'
              : `${totalFillers} total filler${totalFillers !== 1 ? 's' : ''} across ${TOTAL_ROUNDS} rounds`}
          </motion.p>

          {/* Drachma Award */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.6, type: 'spring', stiffness: 300, damping: 15 }}
            className="flex items-center gap-3 bg-amber-500/20 border border-amber-500/30 rounded-xl px-6 py-3 mb-8"
          >
            <Coins className="w-6 h-6 text-amber-400" />
            <span className="text-2xl font-mono font-bold text-amber-400">
              +{drachmaAwarded}Δ
            </span>
          </motion.div>

          {/* Round-by-round breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 }}
            className="w-full max-w-md space-y-3 mb-8"
          >
            <h3 className="text-xs uppercase tracking-widest text-stone-500 mb-2">
              Round Breakdown
            </h3>
            {allResults.map((r) => (
              <div
                key={r.round}
                className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
                  r.fillerCount === 0
                    ? 'bg-emerald-500/10 border-emerald-500/20'
                    : r.fillerCount < 3
                      ? 'bg-amber-500/10 border-amber-500/20'
                      : 'bg-red-500/10 border-red-500/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-stone-500 w-8">
                    R{r.round}
                  </span>
                  <span className="text-sm text-stone-300 truncate max-w-[200px]">
                    {r.question}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {r.fillerCount === 0 ? (
                    <span className="text-emerald-400 text-sm font-bold">
                      CLEAN ✓
                    </span>
                  ) : (
                    <span className="text-red-400 text-sm font-mono font-bold">
                      {r.fillerCount} filler{r.fillerCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="flex items-center gap-6 mb-10"
          >
            <div className="text-center">
              <div className="text-2xl font-mono font-bold text-white">
                {totalFillers}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-stone-500">
                Total Fillers
              </div>
            </div>
            <div className="w-px h-8 bg-stone-700" />
            <div className="text-center">
              <div className="text-2xl font-mono font-bold text-emerald-400">
                {cleanestRound ? cleanestRound.fillerCount : 0}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-stone-500">
                Best Round
              </div>
            </div>
            <div className="w-px h-8 bg-stone-700" />
            <div className="text-center">
              <div className="text-2xl font-mono font-bold text-amber-400">
                {allResults.filter((r) => r.fillerCount === 0).length}/{TOTAL_ROUNDS}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-stone-500">
                Clean Rounds
              </div>
            </div>
          </motion.div>

          {/* Actions */}
          <div className="flex flex-col items-center gap-3 w-full max-w-xs">
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.05 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setCurrentRound(0);
                setResults([]);
                setDrachmaAwarded(0);
                setPhase('intro');
                modeSetRef.current = false;
              }}
              className="w-full px-8 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 uppercase tracking-wider text-sm"
            >
              Play Again
            </motion.button>
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.15 }}
              onClick={onExit}
              className="w-full px-8 py-3 border border-stone-700 text-stone-400 rounded-xl uppercase tracking-wider text-sm hover:bg-stone-800 transition-colors"
            >
              Back to Academy
            </motion.button>
          </div>
        </div>
      </FadeTransition>
    );
  }

  // ── COUNTDOWN / SPEAKING / AI FEEDBACK ─────────────────────────────
  return (
    <FadeTransition className="fixed inset-0 bg-stone-900 text-white z-50 flex flex-col">
      {/* Red flash overlay */}
      <AnimatePresence>
        {fillerFlash && (
          <motion.div
            key="flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-red-600 z-30 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Close button */}
      <button
        onClick={onExit}
        className="absolute top-6 right-6 text-stone-500 hover:text-white transition-colors z-40"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Top bar: Round indicator + filler counter */}
      <div className="flex items-center justify-between px-6 pt-6 pb-3 z-20">
        {/* Round pills */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
            <div
              key={i}
              className={`w-8 h-1.5 rounded-full transition-all duration-300 ${
                i < currentRound
                  ? 'bg-emerald-400'
                  : i === currentRound
                    ? 'bg-red-400'
                    : 'bg-stone-700'
              }`}
            />
          ))}
          <span className="ml-2 text-xs font-mono text-stone-500">
            R{currentRound + 1}/{TOTAL_ROUNDS}
          </span>
        </div>

        {/* Filler counter */}
        <motion.div
          animate={
            fillerFlash
              ? { scale: [1, 1.4, 1], color: ['#ef4444', '#ff0000', '#ef4444'] }
              : {}
          }
          transition={{ duration: 0.3 }}
          className={`flex items-center gap-2 px-3 py-1 rounded-full border ${
            currentFillers > 0
              ? 'bg-red-500/20 border-red-500/40 text-red-400'
              : 'bg-stone-800 border-stone-700 text-stone-400'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span className="text-sm font-mono font-bold">{currentFillers}</span>
        </motion.div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 relative">
        {/* ── COUNTDOWN PHASE ─────────────────────────── */}
        <AnimatePresence mode="wait">
          {phase === 'countdown' && (
            <motion.div
              key="countdown"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              className="flex flex-col items-center"
            >
              <p className="text-stone-400 text-sm mb-6 text-center max-w-sm">
                {questions[currentRound]}
              </p>
              <motion.span
                key={countdown}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                className="text-8xl font-mono font-bold text-red-400"
              >
                {countdown}
              </motion.span>
              <p className="text-stone-500 text-xs mt-4 uppercase tracking-widest">
                Get ready…
              </p>
            </motion.div>
          )}

          {/* ── SPEAKING PHASE ────────────────────────── */}
          {phase === 'speaking' && (
            <motion.div
              key="speaking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center w-full"
            >
              {/* Question */}
              <p className="text-stone-300 text-base mb-8 text-center max-w-md font-serif italic">
                "{questions[currentRound]}"
              </p>

              {/* Timer ring */}
              <div className="relative w-44 h-44 mb-8">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  {/* Background circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="text-stone-800"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 42}`}
                    strokeDashoffset={`${2 * Math.PI * 42 * (1 - timerPct / 100)}`}
                    className={`transition-all duration-1000 ${timerColor}`}
                  />
                </svg>
                {/* Timer text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-4xl font-mono font-bold ${timerColor}`}>
                    {timer}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-stone-500 mt-1">
                    seconds
                  </span>
                </div>
              </div>

              {/* Mic indicator */}
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="flex items-center gap-2 text-emerald-400"
              >
                <Mic className="w-5 h-5" />
                <span className="text-sm font-medium">Listening…</span>
              </motion.div>

              {/* Buzzer word popup */}
              <AnimatePresence>
                {buzzerWord && (
                  <motion.div
                    key="buzzer"
                    initial={{ scale: 0, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0, opacity: 0, y: -20 }}
                    className="absolute bottom-32 bg-red-500 text-white px-6 py-3 rounded-xl shadow-2xl shadow-red-500/40"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5" />
                      <span className="text-lg font-bold uppercase">
                        "{buzzerWord}"
                      </span>
                      <Volume2 className="w-4 h-4 opacity-60" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ── AI FEEDBACK PHASE ─────────────────────── */}
          {phase === 'ai-feedback' && (
            <motion.div
              key="feedback"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center text-center px-4"
            >
              {/* Round result icon */}
              {results[results.length - 1]?.fillerCount === 0 ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 12 }}
                  className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6"
                >
                  <span className="text-4xl">✨</span>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 12 }}
                  className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mb-6"
                >
                  <span className="text-4xl">
                    {results[results.length - 1]?.fillerCount < 3 ? '👏' : '💪'}
                  </span>
                </motion.div>
              )}

              {/* Filler count for this round */}
              <h3 className="text-2xl font-serif font-bold mb-2">
                {results[results.length - 1]?.fillerCount === 0
                  ? 'CLEAN ROUND!'
                  : `${results[results.length - 1]?.fillerCount} filler${results[results.length - 1]?.fillerCount !== 1 ? 's' : ''}`}
              </h3>

              {/* AI feedback text */}
              {lastFeedback && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-stone-400 text-sm max-w-sm italic mb-6"
                >
                  "{lastFeedback}"
                </motion.p>
              )}

              {/* Manual advance button (in case auto-advance doesn't fire) */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                onClick={advanceRound}
                className="flex items-center gap-2 text-sm text-stone-400 hover:text-white transition-colors mt-4"
              >
                {currentRound + 1 < TOTAL_ROUNDS ? (
                  <>
                    Next Round <ChevronRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    See Results <Trophy className="w-4 h-4 text-amber-400" />
                  </>
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom: total filler tally */}
      <div className="px-6 pb-6 flex items-center justify-center gap-8 text-xs text-stone-500 font-mono">
        <span>
          Total fillers:{' '}
          <span className={totalFillers > 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
            {totalFillers}
          </span>
        </span>
        <span>
          Clean rounds:{' '}
          <span className="text-emerald-400 font-bold">
            {allResults.filter((r) => r.fillerCount === 0).length}
          </span>
        </span>
      </div>
    </FadeTransition>
  );
};
