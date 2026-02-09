/**
 * ViewKillFillers — "Kill the Fillers" Interactive Game
 *
 * A 2-round game where the AI asks random questions and the user
 * must answer for 30 seconds WITHOUT filler words.
 * Real-time filler detection with visual feedback and scoring.
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
  Mic,
  Sparkles,
} from 'lucide-react';

// ============================================================================
// CONSTANTS
// ============================================================================

const TOTAL_ROUNDS = 2;
const ROUND_DURATION = 30; // seconds to answer
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

function getGrade(totalFillers: number): { label: string; color: string } {
  if (totalFillers === 0) return { label: 'FLAWLESS', color: 'text-amber-600' };
  if (totalFillers < 3) return { label: 'EXCELLENT', color: 'text-emerald-500' };
  if (totalFillers < 5) return { label: 'GOOD', color: 'text-stone-700' };
  if (totalFillers < 8) return { label: 'KEEP GOING', color: 'text-stone-600' };
  return { label: 'PRACTICE MORE', color: 'text-stone-500' };
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

  // Set AI mode once connected - reset on disconnect so it re-fires after reconnection
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
    } else if (!isConnected) {
      modeSetRef.current = false;
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

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const currentFillers = phase === 'speaking'
    ? fillerCountLive - roundFillerStartRef.current
    : 0;

  const allResults = results;
  const totalFillers = allResults.reduce((s, r) => s + r.fillerCount, 0);

  const timerPct = (timer / ROUND_DURATION) * 100;
  const timerColor =
    timer <= 3
      ? 'text-red-500'
      : timer <= 7
        ? 'text-amber-500'
        : 'text-emerald-500';

  const grade = getGrade(totalFillers);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <FadeTransition className="flex flex-col items-center justify-center min-h-screen p-6 relative bg-stone-50 text-stone-900 overflow-hidden">
      <button onClick={onExit} className="absolute top-6 right-6 text-stone-400 hover:text-stone-900 transition-colors z-20">
        <X className="w-6 h-6" />
      </button>

      {/* Red flash overlay */}
      <AnimatePresence>
        {fillerFlash && (
          <motion.div
            key="flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-red-500 z-30 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Stage indicators - only show during active game */}
      {phase !== 'intro' && phase !== 'scoreboard' && (
        <div className="absolute top-12 flex gap-2 z-10">
          {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${
                i < currentRound ? 'bg-emerald-500' : i === currentRound ? 'bg-stone-900' : 'bg-stone-300'
              }`}
            />
          ))}
        </div>
      )}

      {/* Filler counter badge - only show during speaking */}
      {phase === 'speaking' && (
        <motion.div
          className="absolute top-12 right-6 z-20"
          animate={fillerFlash ? { scale: [1, 1.2, 1] } : {}}
          transition={{ duration: 0.3 }}
        >
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
            currentFillers > 0
              ? 'bg-red-50 border-red-300 text-red-600'
              : 'bg-white/60 border-stone-200 text-stone-600'
          }`}>
            <Zap className="w-3.5 h-3.5" />
            <span className="text-sm font-mono font-bold">{currentFillers}</span>
          </div>
        </motion.div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg z-10 text-center">
        <AnimatePresence mode="wait">
          {/* ───── INTRO PHASE ───── */}
          {phase === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <h2 className="text-4xl font-serif font-light mb-1">Kill the Fillers</h2>
              <p className="text-stone-500 font-serif italic mb-10">
                Speak clearly. No fillers.
              </p>

              <div className="flex items-center gap-2 text-stone-600 mb-6">
                <Zap className="w-5 h-5" />
                <span className="text-sm uppercase tracking-widest font-medium">Filler Detection</span>
              </div>

              <p className="text-base text-stone-700 mb-8 max-w-sm leading-relaxed">
                Answer questions without saying "um," "uh," "like," or "you know"
              </p>

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-stone-500 mb-10">
                <div className="flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  <span>{TOTAL_ROUNDS} rounds</span>
                </div>
                <div className="w-px h-3 bg-stone-300" />
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>{ROUND_DURATION}s each</span>
                </div>
                <div className="w-px h-3 bg-stone-300" />
                <div className="flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5" />
                  <span>Up to 50Δ</span>
                </div>
              </div>

              <button
                onClick={handleStart}
                className="px-5 py-2 bg-stone-900 text-stone-50 rounded-full text-sm uppercase tracking-widest hover:bg-stone-800 transition-colors"
              >
                Start
              </button>
            </motion.div>
          )}

          {/* ───── COUNTDOWN PHASE ───── */}
          {phase === 'countdown' && (
            <motion.div
              key="countdown"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <p className="text-stone-600 text-sm mb-10 text-center max-w-md font-serif">
                {questions[currentRound]}
              </p>
              <motion.span
                key={countdown}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-8xl font-mono font-bold text-stone-900"
              >
                {countdown}
              </motion.span>
              <p className="text-stone-500 text-xs mt-6 uppercase tracking-widest">
                Get ready…
              </p>
            </motion.div>
          )}

          {/* ───── SPEAKING PHASE ───── */}
          {phase === 'speaking' && (
            <motion.div
              key="speaking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center w-full"
            >
              {/* Question */}
              <p className="text-stone-700 text-base mb-8 text-center max-w-md font-serif italic">
                "{questions[currentRound]}"
              </p>

              {/* Timer ring */}
              <div className="relative w-40 h-40 mb-8">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  {/* Background circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-stone-200"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
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
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="flex items-center gap-2 text-emerald-500"
              >
                <Mic className="w-4 h-4" />
                <span className="text-sm font-medium">Listening…</span>
              </motion.div>

              {/* Buzzer word popup */}
              <AnimatePresence>
                {buzzerWord && (
                  <motion.div
                    key="buzzer"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="absolute bottom-20 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      <span className="text-base font-bold">
                        "{buzzerWord}"
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ───── AI FEEDBACK PHASE ───── */}
          {phase === 'ai-feedback' && (
            <motion.div
              key="feedback"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center text-center"
            >
              {/* Round result indicator */}
              <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mb-6">
                {results[results.length - 1]?.fillerCount === 0 ? (
                  <Trophy className="w-8 h-8 text-emerald-500" />
                ) : (
                  <Zap className="w-8 h-8 text-stone-400" />
                )}
              </div>

              {/* Filler count for this round */}
              <h3 className="text-2xl font-serif font-light mb-4">
                {results[results.length - 1]?.fillerCount === 0
                  ? 'Clean round!'
                  : `${results[results.length - 1]?.fillerCount} filler${results[results.length - 1]?.fillerCount !== 1 ? 's' : ''}`}
              </h3>

              {/* AI feedback text */}
              {lastFeedback && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-stone-600 text-sm max-w-sm italic mb-6"
                >
                  "{lastFeedback}"
                </motion.p>
              )}

              {/* Progress indicator */}
              <div className="flex gap-2 mb-6">
                {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${
                      i <= currentRound ? 'bg-stone-900' : 'bg-stone-300'
                    }`}
                  />
                ))}
              </div>

              {/* Manual advance button */}
              <button
                onClick={advanceRound}
                className="text-sm text-stone-600 hover:text-stone-900 transition-colors flex items-center gap-1"
              >
                {currentRound + 1 < TOTAL_ROUNDS ? (
                  <>Next Round <ChevronRight className="w-4 h-4" /></>
                ) : (
                  <>See Results <ChevronRight className="w-4 h-4" /></>
                )}
              </button>
            </motion.div>
          )}

          {/* ───── SCOREBOARD PHASE ───── */}
          {phase === 'scoreboard' && (
            <motion.div
              key="scoreboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center w-full"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mb-6"
              >
                <Sparkles className="w-10 h-10 text-emerald-600" />
              </motion.div>

              <h2 className={`text-3xl font-serif font-light mb-2 ${grade.color}`}>
                {grade.label}
              </h2>

              <p className="text-stone-600 text-sm mb-8">
                {totalFillers === 0
                  ? 'Not a single filler. Legendary.'
                  : `${totalFillers} total filler${totalFillers !== 1 ? 's' : ''} across ${TOTAL_ROUNDS} rounds`}
              </p>

              {/* Drachma Award */}
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-5 py-3 mb-8">
                <Coins className="w-5 h-5 text-amber-600" />
                <span className="text-xl font-mono font-bold text-amber-600">
                  +{drachmaAwarded}Δ
                </span>
              </div>

              {/* Round breakdown */}
              <div className="w-full max-w-sm space-y-2 mb-8">
                <h3 className="text-xs uppercase tracking-widest text-stone-500 mb-3">
                  Round Breakdown
                </h3>
                {allResults.map((r) => (
                  <div
                    key={r.round}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                      r.fillerCount === 0
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-stone-100 text-stone-700'
                    }`}
                  >
                    <span className="font-medium">Round {r.round}</span>
                    <span className="text-xs">
                      {r.fillerCount === 0 ? 'Clean ✓' : `${r.fillerCount} filler${r.fillerCount !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <button
                  onClick={() => {
                    setCurrentRound(0);
                    setResults([]);
                    setDrachmaAwarded(0);
                    setPhase('intro');
                    modeSetRef.current = false;
                  }}
                  className="px-5 py-2 bg-stone-900 text-stone-50 rounded-full text-sm uppercase tracking-widest hover:bg-stone-800 transition-colors"
                >
                  Play Again
                </button>
                <button
                  onClick={onExit}
                  className="text-stone-900 border-b border-stone-900 pb-1 text-sm uppercase tracking-widest hover:text-stone-700 transition-colors"
                >
                  Back to Academy →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FadeTransition>
  );
};
