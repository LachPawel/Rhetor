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
  Play,
  ArrowRight,
  Clock
} from 'lucide-react';

// ============================================================================
// CONSTANTS
// ============================================================================

const TOTAL_ROUNDS = 2;
const ROUND_DURATION = 30; // seconds to answer
const COUNTDOWN_BEFORE_ROUND = 3;
const FEEDBACK_ADVANCE_DELAY = 6000; // Max ms to wait on feedback before auto-advancing

/**
 * Local filler word scanner — a simple backup that directly scans
 * transcript text for common filler words, independent of the
 * streaming FillerDetector pipeline.
 */
const LOCAL_FILLER_RE = /\b(um+|uh+|uhm+|er+m?|ah+|eh+|hm+|mhm|like|basically|actually|literally|obviously|essentially|totally|honestly|whatever|you know|i mean|kind of|kinda|sort of|sorta|i guess|i suppose)\b/gi;

function countLocalFillers(text: string): { count: number; words: string[] } {
  const matches = text.match(LOCAL_FILLER_RE) || [];
  return { count: matches.length, words: matches.map(w => w.toLowerCase()) };
}

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
    resetTranscript
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
      // Set Mode
      setMode(AgentMode.COACH_LESSON, {
        lessonId: 'kill-the-fillers',
        lessonTitle: 'Kill the Fillers',
        lessonDesc:
          'Interactive filler-word elimination game. You ask questions and the student tries to answer without fillers.',
        step: {
          index: 0,
          total: TOTAL_ROUNDS,
          type: 'intro',
          aiPrompt:
            'SYSTEM RESET: Starting new "Kill the Fillers" game. Forget all previous context. You are the energetic host. Briefly welcome the player and tell them to press Start. Do NOT ask a question yet.',
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

  /** Round ended — record result & ask AI for feedback */
  const endRound = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    // Get live values from store directly to avoid stale closures
    const currentMetrics = useRhetorStore.getState().currentMetrics;
    const storeFillers = Math.max(0, (currentMetrics?.fillerCount ?? 0) - roundFillerStartRef.current);

    // Also run local regex scan on the transcript as a backup
    const currentTranscript = useRhetorStore.getState().transcript || '';
    const roundText = currentTranscript.slice(transcriptAtRoundStartRef.current.length);
    const localScan = countLocalFillers(roundText);

    // Use whichever found more fillers (store pipeline vs. local scan)
    const roundFillers = Math.max(storeFillers, localScan.count);
    const allWords = [...roundFillerWordsRef.current, ...localScan.words];
    const uniqueWords = [...new Set(allWords)];
    console.log('[KillFillers] Round end — store:', storeFillers, 'local:', localScan.count, 'words:', uniqueWords);
    
    // Use state setter form to ensure we have the latest round index
    setCurrentRound(currRound => {
      const result: RoundResult = {
        round: currRound + 1,
        question: questions[currRound],
        fillerCount: roundFillers,
        fillerWords: uniqueWords,
        duration: ROUND_DURATION,
      };
      setResults((prev) => [...prev, result]);

      // Ask AI for quick feedback
      setPhase('ai-feedback');

      const feedbackPrompt =
        roundFillers === 0
          ? `The student just answered Round ${currRound + 1} of Kill the Fillers with ZERO filler words! Say "Clean! Zero fillers!". Keep it brief.`
          : `The student just finished Round ${currRound + 1} with ${roundFillers} filler word(s): ${uniqueWords.join(', ') || 'none detected'}. Give 1 sentence of constructive feedback.`;

      setMode(AgentMode.COACH_LESSON, {
        lessonId: 'kill-the-fillers',
        lessonTitle: 'Kill the Fillers',
        step: {
          index: currRound,
          total: TOTAL_ROUNDS,
          type: 'practice',
          aiPrompt: feedbackPrompt,
          expectedAction: 'listen',
          duration: 10,
        },
      });
      
      return currRound; // return same value, update happens in advanceRound
    });
  }, [questions, setMode]);

  /** User is now speaking — start the timer + filler tracking */
  const beginSpeaking = useCallback(() => {
    setPhase('speaking');
    setTimer(ROUND_DURATION);
    
    // Ensure accurate baseline from the store (not React state)
    roundFillerStartRef.current = useRhetorStore.getState().currentMetrics?.fillerCount ?? 0;
    roundFillerWordsRef.current = [];
    transcriptAtRoundStartRef.current = useRhetorStore.getState().transcript || '';
    prevFillerCountRef.current = roundFillerStartRef.current;

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
  }, [endRound]); // reads from store directly, no stale closures

  /** Start a round: show 3-2-1 countdown, then let user speak */
  const startRound = useCallback((roundIdx: number) => {
    resetTranscript();
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
        index: roundIdx,
        total: TOTAL_ROUNDS,
        type: 'practice',
        aiPrompt: `Round ${roundIdx + 1}: Ask this question in an energetic, game-show style: "${questions[roundIdx]}". Then say "GO!" and listen. Do NOT speak again until told. Keep it to 1-2 sentences max.`,
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
  }, [questions, setMode, resetTranscript, beginSpeaking]); // Removed currentRound dependency, passed as arg instead

  /** Move to next round or final scoreboard */
  const advanceRound = useCallback(() => {
    setCurrentRound(prevRound => {
      const nextRound = prevRound + 1;
      if (nextRound >= TOTAL_ROUNDS) {
        // Game over
        endSession();
        // Calculate total from results + state
        setResults(prevResults => {
          const totalFillers = prevResults.reduce((sum, r) => sum + r.fillerCount, 0);
          const reward = getDrachmaReward(totalFillers);
          addDrachmas(reward);
          completeLesson('kill-the-fillers');
          setDrachmaAwarded(reward);
          return prevResults;
        });
        setPhase('scoreboard');
        return prevRound;
      } else {
        startRound(nextRound);
        return nextRound;
      }
    });
  }, [endSession, addDrachmas, completeLesson, startRound]);

  /** Start the game from intro */
  const handleStart = useCallback(() => {
    resetTranscript();
    startSession(); // Initialize metrics
    setCurrentRound(0); // Reset round to 0
    setResults([]);
    startRound(0); // Start round 0 explicitly
  }, [startRound, startSession, resetTranscript]);

  /** Auto-advance from AI feedback — guaranteed fallback timer + optional early advance */
  useEffect(() => {
    if (phase !== 'ai-feedback') return;

    // ALWAYS set a guaranteed fallback timer — even if AI feedback never arrives
    const fallback = setTimeout(() => {
      console.log('[KillFillers] Fallback timer fired — advancing round');
      advanceRound();
    }, FEEDBACK_ADVANCE_DELAY);

    // If AI feedback arrived, we can advance sooner (after 2.5s reading time)
    let early: ReturnType<typeof setTimeout> | null = null;
    if (lastFeedback) {
      early = setTimeout(() => {
        console.log('[KillFillers] Early advance — feedback received');
        advanceRound();
      }, 2500);
    }

    return () => {
      clearTimeout(fallback);
      if (early) clearTimeout(early);
    };
  }, [phase, lastFeedback, advanceRound]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const currentFillers = phase === 'speaking'
    ? fillerCountLive - roundFillerStartRef.current
    : 0;

  const allResults = results;
  const totalFillers = allResults.reduce((s, r) => s + r.fillerCount, 0);
  const grade = getGrade(totalFillers);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <FadeTransition className="relative flex flex-col items-center justify-center min-h-screen bg-stone-50 text-stone-900 overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-blue-100 rounded-full blur-[120px] mix-blend-multiply" />
        <div className="absolute top-[30%] -right-[10%] w-[50%] h-[50%] bg-emerald-50 rounded-full blur-[100px] mix-blend-multiply" />
      </div>

      <button onClick={onExit} className="absolute top-8 right-8 text-stone-400 hover:text-stone-900 transition-colors z-50">
        <X className="w-6 h-6" />
      </button>

      {/* Red flash overlay (subtle) */}
      <AnimatePresence>
        {fillerFlash && (
          <motion.div
            key="flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.15 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-red-500 z-30 pointer-events-none mix-blend-multiply"
          />
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl px-6 z-10 text-center relative">
        <AnimatePresence mode="wait">
          
          {/* ───── INTRO PHASE ───── */}
          {phase === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center"
            >
              <div className="w-20 h-20 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-8 border border-stone-100">
                <Zap className="w-8 h-8 text-stone-800" />
              </div>

              <h1 className="text-4xl md:text-5xl font-serif font-light mb-6 tracking-tight text-stone-900">
                Kill the Fillers
              </h1>
              
              <p className="text-lg text-stone-600 font-serif italic mb-12 max-w-md leading-relaxed">
                "Eliminate 'um', 'uh', and 'like' from your speech. Think before you speak."
              </p>

              <div className="grid grid-cols-2 gap-4 w-full max-w-md mb-12">
                <div className="bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-stone-100 flex flex-col items-center">
                  <span className="text-2xl font-mono font-medium text-stone-900 mb-1">{TOTAL_ROUNDS}</span>
                  <span className="text-xs uppercase tracking-widest text-stone-500">Rounds</span>
                </div>
                <div className="bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-stone-100 flex flex-col items-center">
                  <span className="text-2xl font-mono font-medium text-stone-900 mb-1">{ROUND_DURATION}s</span>
                  <span className="text-xs uppercase tracking-widest text-stone-500">Per Round</span>
                </div>
              </div>

              <button
                onClick={handleStart}
                className="group relative flex items-center gap-3 px-8 py-4 bg-stone-900 text-stone-50 rounded-full text-sm uppercase tracking-widest hover:bg-stone-800 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-stone-900/10"
              >
                Start Exercise
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
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
              className="flex flex-col items-center justify-center min-h-[400px]"
            >
               <h3 className="text-sm uppercase tracking-widest text-stone-400 mb-12">Round {currentRound + 1} of {TOTAL_ROUNDS}</h3>
              
              <p className="text-2xl md:text-3xl text-stone-800 mb-16 text-center max-w-xl font-serif leading-snug">
                {questions[currentRound]}
              </p>
              
              <div className="relative flex items-center justify-center">
                 <motion.span
                  key={countdown}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.5, opacity: 0 }}
                  className="text-8xl font-mono font-light text-stone-900 absolute"
                >
                  {countdown}
                </motion.span>
              </div>
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
              {/* Top status bar */}
              <div className="absolute top-0 left-0 right-0 flex justify-between items-center px-6 py-4 border-b border-stone-100/50 bg-stone-50/80 backdrop-blur-sm">
                <div className="flex gap-2">
                  {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        i < currentRound ? 'w-1.5 bg-emerald-400' : 
                        i === currentRound ? 'w-8 bg-stone-800' : 'w-1.5 bg-stone-200'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${currentFillers > 0 ? 'bg-red-500 animate-pulse' : 'bg-stone-300'}`} />
                  <span className={`text-sm font-mono ${currentFillers > 0 ? 'text-red-600 font-bold' : 'text-stone-400'}`}>
                    {currentFillers} Filler{currentFillers !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Question */}
              <div className="mt-12 mb-16 px-4">
                <p className="text-xl md:text-2xl text-stone-700 text-center font-serif leading-relaxed">
                  "{questions[currentRound]}"
                </p>
              </div>

              {/* Visual Timer & Feedback */}
              <div className="relative w-64 h-64 mb-12 flex items-center justify-center">
                 {/* Decorative outer rings */}
                 <div className="absolute inset-0 rounded-full border border-stone-100 scale-125 opacity-50" />
                 <div className="absolute inset-0 rounded-full border border-stone-100 scale-150 opacity-30" />

                 {/* Timer SVG */}
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#e7e5e4"
                    strokeWidth="2"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke={timer <= 5 ? '#ef4444' : '#1c1917'} 
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 45}`}
                    strokeDashoffset={`${2 * Math.PI * 45 * (1 - (timer / ROUND_DURATION))}`}
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                
                <div className="flex flex-col items-center z-10">
                   <span className={`text-6xl font-mono font-light tabular-nums tracking-tighter ${timer <= 5 ? 'text-red-500' : 'text-stone-900'}`}>{timer}</span>
                </div>

                 {/* Buzzer Popup */}
                 <AnimatePresence>
                    {buzzerWord && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.5, y: -20 }}
                        className="absolute -bottom-16 bg-red-50 text-red-600 px-4 py-2 rounded-full border border-red-100 flex items-center gap-2 shadow-sm"
                      >
                         <Zap className="w-3 h-3 fill-red-600" />
                         <span className="text-sm font-bold uppercase tracking-wide">{buzzerWord}</span>
                      </motion.div>
                    )}
                 </AnimatePresence>
              </div>

              <div className="flex items-center gap-3 text-stone-400">
                <Mic className="w-4 h-4 animate-pulse" />
                <span className="text-xs uppercase tracking-widest">Listening for fillers...</span>
              </div>
            </motion.div>
          )}

          {/* ───── AI FEEDBACK / INTERSTITIAL PHASE ───── */}
          {phase === 'ai-feedback' && (
            <motion.div
              key="feedback"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full w-full"
            >
              <div className="w-16 h-16 rounded-full bg-stone-50 flex items-center justify-center mb-8 shadow-sm">
                {results[results.length - 1]?.fillerCount === 0 ? (
                  <Trophy className="w-8 h-8 text-amber-500" />
                ) : (
                   <Zap className="w-8 h-8 text-stone-300" />
                )}
              </div>

              <h2 className="text-2xl font-serif mb-4">
                 {results[results.length - 1]?.fillerCount === 0 ? "Perfect Flow" : "Round Complete"}
              </h2>

              {lastFeedback && (
                <motion.p
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="text-stone-600 text-center max-w-md mb-12 leading-relaxed"
                >
                  {lastFeedback}
                </motion.p>
              )}

              <button
                onClick={advanceRound}
                className="group flex items-center gap-3 px-6 py-3 bg-stone-900 text-stone-50 rounded-full text-sm uppercase tracking-widest hover:bg-stone-800 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-stone-900/10"
              >
                Continue
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
              <p className="text-xs text-stone-400 mt-4 uppercase tracking-widest">or auto-advancing...</p>
            </motion.div>
          )}

          {/* ───── SCOREBOARD PHASE ───── */}
          {phase === 'scoreboard' && (
            <motion.div
              key="scoreboard"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center w-full max-w-lg"
            >
              <div className="mb-8">
                 <Sparkles className="w-12 h-12 text-emerald-500" />
              </div>
              
              <h2 className={`text-4xl font-serif mb-2 ${grade.color}`}>
                {grade.label}
              </h2>
              
              <p className="text-stone-500 mb-10 text-center">
                You used <strong className="text-stone-900">{totalFillers}</strong> filler words across {TOTAL_ROUNDS} rounds.
              </p>

              {/* Breakdown Card */}
              <div className="w-full bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden mb-8">
                {allResults.map((r, i) => (
                  <div key={i} className={`flex items-center justify-between px-6 py-4 ${i !== allResults.length - 1 ? 'border-b border-stone-50' : ''}`}>
                    <div className="flex flex-col items-start">
                       <span className="text-xs uppercase tracking-widest text-stone-400 mb-1">Round {r.round}</span>
                       <span className="text-sm font-medium text-stone-700 truncate max-w-[200px]">{r.question}</span>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${r.fillerCount === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-500'}`}>
                       {r.fillerCount === 0 ? 'CLEAN' : `${r.fillerCount}`}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 mb-12">
                 <Coins className="w-5 h-5 text-amber-500" />
                 <span className="font-mono font-bold text-lg text-amber-600">+{drachmaAwarded} Drachmas</span>
              </div>

              <div className="flex flex-col gap-3 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setCurrentRound(0);
                    setResults([]);
                    setDrachmaAwarded(0);
                    setPhase('intro');
                    modeSetRef.current = false;
                  }}
                  className="w-full sm:w-64 px-6 py-3 bg-stone-900 text-stone-50 rounded-full text-sm uppercase tracking-widest hover:bg-stone-800 transition-colors"
                >
                  Play Again
                </button>
                <button
                  onClick={onExit}
                  className="w-full sm:w-64 px-6 py-3 bg-transparent text-stone-500 rounded-full text-sm uppercase tracking-widest hover:text-stone-900 transition-colors"
                >
                  Complete Exercise
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </FadeTransition>
  );
};
