/**
 * ViewPaceController — "Pace Controller" Interactive Exercise
 *
 * 3 rounds at different target WPMs (120, 150, 180).
 * A karaoke-style highlight sweeps across a paragraph at the target speed.
 * Real-time WPM display with color feedback: green (±10), yellow (±20), red (beyond).
 * Teaches users what different speaking speeds feel like.
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeTransition } from './FadeTransition.tsx';
import { AgentMode } from '../types.ts';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { useRhetorStore } from '../stores/useRhetorStore.ts';
import {
  X,
  Gauge,
  Trophy,
  Coins,
  ChevronRight,
  Mic,
  Play,
  Timer,
  TrendingUp,
} from 'lucide-react';

// ============================================================================
// CONSTANTS
// ============================================================================

const TOTAL_ROUNDS = 3;
const COUNTDOWN_SECONDS = 3;

interface RoundConfig {
  targetWpm: number;
  label: string;
  emoji: string;
  description: string;
}

const ROUNDS: RoundConfig[] = [
  { targetWpm: 120, label: 'Slow & Steady', emoji: '🐢', description: 'Conversational pace — calm and clear' },
  { targetWpm: 150, label: 'Confident Cruise', emoji: '🚀', description: 'Presentation pace — energetic but clear' },
  { targetWpm: 180, label: 'Full Throttle', emoji: '⚡', description: 'Fast-paced pitch — high energy' },
];

/** Pool of ~50-word paragraphs. One is randomly picked per round. */
const READING_PASSAGES = [
  'The greatest speakers in history understood one simple truth. Your message is only as powerful as your delivery. Words spoken too fast become noise. Words spoken too slowly lose momentum. The key is matching your pace to your purpose. Today you will learn to control your speed like a master.',
  'Public speaking is not about perfection. It is about connection. When you stand before an audience, they want to feel your conviction, not judge your grammar. Speak with intention. Let each sentence land before starting the next. Rhythm and pace are your secret weapons on any stage.',
  'Imagine you are telling a story around a campfire. You would not rush through the best parts. You would slow down for suspense and speed up for excitement. Great speakers do the same thing. They vary their pace to keep listeners engaged and to emphasize the moments that matter most.',
  'Confidence is not about being loud. It is about being deliberate. A speaker who controls their pace signals authority. They are not rushing because they are nervous. They are not dragging because they are unsure. They are choosing every word with precision and letting silence do the heavy lifting.',
  'Think about the last presentation that truly impressed you. Chances are the speaker was not racing to finish. They paused at the right moments. They slowed down for key ideas. They sped up to build energy. Pace control is what separates good speakers from unforgettable ones.',
  'Every word you speak has weight. When you rush, that weight disappears. When you slow down too much, the audience drifts. The sweet spot is found through practice. Read this passage at the target speed. Feel the rhythm in your chest. Let the words flow naturally without forcing them.',
];

// ============================================================================
// TYPES
// ============================================================================

interface RoundResult {
  round: number;
  targetWpm: number;
  averageWpm: number;
  accuracy: number; // 0-100, how close to target
  passage: string;
  wpmSamples: number[];
}

type GamePhase =
  | 'intro'
  | 'round-intro'
  | 'countdown'
  | 'reading'
  | 'round-result'
  | 'scoreboard';

interface ViewPaceControllerProps {
  onExit: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

/** Calculate WPM accuracy score (0-100). Perfect = 100, ±10 = ~90, ±20 = ~70, etc. */
function calcAccuracy(actual: number, target: number): number {
  if (actual === 0) return 0;
  const diff = Math.abs(actual - target);
  // Each WPM off target costs ~2 points, capped at 0
  return Math.max(0, Math.round(100 - diff * 2));
}

/** Get color class based on WPM deviation from target */
function getWpmColor(actual: number, target: number): string {
  if (actual === 0) return 'text-stone-500';
  const diff = Math.abs(actual - target);
  if (diff <= 10) return 'text-emerald-400';
  if (diff <= 20) return 'text-amber-400';
  return 'text-red-400';
}

/** Get background glow color for the container */
function getGlowColor(actual: number, target: number): string {
  if (actual === 0) return '';
  const diff = Math.abs(actual - target);
  if (diff <= 10) return 'shadow-[0_0_40px_rgba(52,211,153,0.15)]';
  if (diff <= 20) return 'shadow-[0_0_40px_rgba(251,191,36,0.15)]';
  return 'shadow-[0_0_40px_rgba(248,113,113,0.15)]';
}

function getDrachmaReward(avgAccuracy: number): number {
  if (avgAccuracy >= 90) return 50;
  if (avgAccuracy >= 75) return 35;
  if (avgAccuracy >= 60) return 25;
  if (avgAccuracy >= 40) return 15;
  return 10;
}

function getGrade(avgAccuracy: number): { label: string; emoji: string; color: string } {
  if (avgAccuracy >= 90) return { label: 'MASTER PACER', emoji: '🏆', color: 'text-amber-400' };
  if (avgAccuracy >= 75) return { label: 'EXCELLENT', emoji: '⭐', color: 'text-emerald-400' };
  if (avgAccuracy >= 60) return { label: 'GOOD CONTROL', emoji: '👍', color: 'text-blue-400' };
  if (avgAccuracy >= 40) return { label: 'GETTING THERE', emoji: '💪', color: 'text-purple-400' };
  return { label: 'KEEP PRACTICING', emoji: '🔄', color: 'text-stone-400' };
}

/** Split passage into words with their character offsets */
function tokenizePassage(text: string): { word: string; start: number; end: number }[] {
  const tokens: { word: string; start: number; end: number }[] = [];
  const regex = /\S+/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    tokens.push({ word: match[0], start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

// ============================================================================
// KARAOKE TEXT COMPONENT
// ============================================================================

interface KaraokeTextProps {
  passage: string;
  targetWpm: number;
  isActive: boolean;
  /** elapsed milliseconds since reading started */
  elapsedMs: number;
}

const KaraokeText: React.FC<KaraokeTextProps> = ({ passage, targetWpm, isActive, elapsedMs }) => {
  const tokens = useMemo(() => tokenizePassage(passage), [passage]);
  const totalWords = tokens.length;

  // How many words should be highlighted by now, based on target WPM
  const wordsPerMs = targetWpm / 60_000;
  const highlightedCount = isActive ? Math.min(totalWords, Math.floor(elapsedMs * wordsPerMs)) : 0;

  // Total expected duration for the passage at this WPM
  const totalDurationMs = (totalWords / targetWpm) * 60_000;
  const progressPct = isActive ? Math.min(100, (elapsedMs / totalDurationMs) * 100) : 0;

  return (
    <div className="relative">
      {/* Progress bar */}
      <div className="h-1 bg-stone-800 rounded-full mb-6 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-emerald-400 to-blue-400 rounded-full"
          style={{ width: `${progressPct}%` }}
          transition={{ duration: 0.3, ease: 'linear' }}
        />
      </div>

      {/* Text with karaoke highlight */}
      <div className="text-xl leading-relaxed font-serif select-none">
        {tokens.map((token, i) => {
          const isHighlighted = i < highlightedCount;
          const isCurrent = i === highlightedCount - 1 || i === highlightedCount;
          return (
            <span key={i}>
              <span
                className={`transition-colors duration-200 ${
                  isHighlighted
                    ? 'text-white'
                    : isCurrent && isActive
                      ? 'text-stone-400'
                      : 'text-stone-600'
                }`}
                style={
                  isCurrent && isActive
                    ? { textShadow: '0 0 20px rgba(255,255,255,0.3)' }
                    : isHighlighted
                      ? { textShadow: '0 0 8px rgba(255,255,255,0.1)' }
                      : undefined
                }
              >
                {token.word}
              </span>
              {i < tokens.length - 1 ? ' ' : ''}
            </span>
          );
        })}
      </div>

      {/* Word count tracker */}
      <div className="mt-4 flex items-center justify-between text-xs text-stone-600 font-mono">
        <span>{highlightedCount}/{totalWords} words</span>
        <span>{Math.ceil((totalDurationMs - elapsedMs) / 1000)}s remaining</span>
      </div>
    </div>
  );
};

// ============================================================================
// WPM GAUGE COMPONENT
// ============================================================================

interface WpmGaugeProps {
  actual: number;
  target: number;
}

const WpmGauge: React.FC<WpmGaugeProps> = ({ actual, target }) => {
  const diff = actual - target;
  const color = getWpmColor(actual, target);
  const diffLabel = actual === 0
    ? '—'
    : diff > 0
      ? `+${diff}`
      : `${diff}`;

  return (
    <div className="flex items-center gap-6">
      {/* Target */}
      <div className="text-center">
        <div className="text-sm font-mono text-stone-500">{target}</div>
        <div className="text-[10px] uppercase tracking-widest text-stone-600">target</div>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-stone-700" />

      {/* Actual */}
      <div className="text-center">
        <motion.div
          key={actual}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          className={`text-2xl font-mono font-bold ${color}`}
        >
          {actual || '—'}
        </motion.div>
        <div className="text-[10px] uppercase tracking-widest text-stone-600">your wpm</div>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-stone-700" />

      {/* Difference */}
      <div className="text-center">
        <div className={`text-sm font-mono font-bold ${color}`}>{diffLabel}</div>
        <div className="text-[10px] uppercase tracking-widest text-stone-600">diff</div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ViewPaceController: React.FC<ViewPaceControllerProps> = ({ onExit }) => {
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
  const liveWpm = useRhetorStore((s) => s.currentMetrics?.wpm ?? 0);
  const setNavigationBlocked = useRhetorStore((s) => s.setNavigationBlocked);

  // ── Game State ─────────────────────────────────────────────────────
  const [phase, setPhase] = useState<GamePhase>('intro');
  const [currentRound, setCurrentRound] = useState(0);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [drachmaAwarded, setDrachmaAwarded] = useState(0);

  // Passages picked for this game
  const passages = useMemo(() => pickRandom(READING_PASSAGES, TOTAL_ROUNDS), []);

  // ── Reading state ──────────────────────────────────────────────────
  const [elapsedMs, setElapsedMs] = useState(0);
  const [liveWpmLocal, setLiveWpmLocal] = useState(0);
  const readingStartRef = useRef(0);
  const transcriptAtStartRef = useRef('');
  const wpmSamplesRef = useRef<number[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── AI feedback ────────────────────────────────────────────────────
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const prevAiSpeakingRef = useRef(false);
  const modeSetRef = useRef(false);

  // Current round config
  const roundConfig = ROUNDS[currentRound] || ROUNDS[0];
  const passage = passages[currentRound] || passages[0];
  const passageWordCount = useMemo(() => passage.split(/\s+/).length, [passage]);
  // How long (ms) this passage should take at the target WPM
  const passageDurationMs = useMemo(
    () => (passageWordCount / roundConfig.targetWpm) * 60_000,
    [passageWordCount, roundConfig.targetWpm],
  );
  // Add a small buffer so the user can finish slightly late
  const roundTimeLimitMs = passageDurationMs + 5_000;

  // ── Connect to Gemini ──────────────────────────────────────────────
  useEffect(() => {
    if (!isConnected) { connect(); }
  }, [isConnected, connect]);

  useEffect(() => {
    if (isConnected && !modeSetRef.current) {
      modeSetRef.current = true;
      setMode(AgentMode.COACH_LESSON, {
        lessonId: 'pace-controller',
        lessonTitle: 'Pace Controller',
        lessonDesc: 'Interactive exercise to practice speaking at different speeds. Wait for instructions.',
      });
    }
  }, [isConnected, setMode]);

  // ── Capture AI feedback ────────────────────────────────────────────
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

  // ── Cleanup ────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // ============================================================================
  // LIVE WPM CALCULATION
  // ============================================================================

  /** Calculate WPM from the transcript delta since the round started. */
  const calcLiveWpm = useCallback(() => {
    const now = Date.now();
    const elapsed = now - readingStartRef.current;
    if (elapsed < 1000) return 0; // need at least 1s of data
    const currentTranscript = lastTranscript || '';
    const baseLen = transcriptAtStartRef.current.length;
    const newText = currentTranscript.slice(baseLen);
    const wordCount = newText.split(/\s+/).filter(Boolean).length;
    const minutes = elapsed / 60_000;
    return minutes > 0 ? Math.round(wordCount / minutes) : 0;
  }, [lastTranscript]);

  // ============================================================================
  // GAME FLOW
  // ============================================================================

  const showRoundIntro = useCallback(() => {
    setPhase('round-intro');
    setLastFeedback(null);
    setElapsedMs(0);
    setLiveWpmLocal(0);
    wpmSamplesRef.current = [];
  }, []);

  const startCountdown = useCallback(() => {
    setPhase('countdown');
    setCountdown(COUNTDOWN_SECONDS);

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          beginReading();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const beginReading = useCallback(() => {
    setPhase('reading');
    readingStartRef.current = Date.now();
    transcriptAtStartRef.current = lastTranscript || '';
    wpmSamplesRef.current = [];
    setElapsedMs(0);
    setLiveWpmLocal(0);

    if (currentRound === 0) {
      startSession();
    }

    // Tell AI to listen
    setMode(AgentMode.COACH_LESSON, {
      lessonId: 'pace-controller',
      lessonTitle: 'Pace Controller',
      step: {
        index: currentRound,
        total: TOTAL_ROUNDS,
        type: 'practice',
        aiPrompt: `The student is about to read a passage aloud at a target pace of ${roundConfig.targetWpm} WPM. Stay silent and listen. Do NOT speak until told.`,
        expectedAction: 'speak',
        duration: Math.ceil(passageDurationMs / 1000),
      },
    });

    // Elapsed timer via requestAnimationFrame for smooth karaoke
    const tick = () => {
      const now = Date.now();
      const elapsed = now - readingStartRef.current;
      setElapsedMs(elapsed);

      if (elapsed < roundTimeLimitMs) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        finishRound();
      }
    };
    animFrameRef.current = requestAnimationFrame(tick);

    // Sample WPM every second
    tickIntervalRef.current = setInterval(() => {
      const wpm = calcLiveWpm();
      setLiveWpmLocal(wpm);
      if (wpm > 0) {
        wpmSamplesRef.current.push(wpm);
      }
    }, 1000);
  }, [currentRound, lastTranscript, roundConfig, passageDurationMs, roundTimeLimitMs, startSession, setMode, calcLiveWpm]);

  const finishRound = useCallback(() => {
    // Stop timers
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);

    const samples = wpmSamplesRef.current;
    const avgWpm = samples.length > 0
      ? Math.round(samples.reduce((s, v) => s + v, 0) / samples.length)
      : 0;
    const accuracy = calcAccuracy(avgWpm, roundConfig.targetWpm);

    const result: RoundResult = {
      round: currentRound + 1,
      targetWpm: roundConfig.targetWpm,
      averageWpm: avgWpm,
      accuracy,
      passage,
      wpmSamples: [...samples],
    };
    setResults((prev) => [...prev, result]);

    // Ask AI for feedback
    setPhase('round-result');
    const diffDesc = avgWpm > roundConfig.targetWpm ? 'too fast' : avgWpm < roundConfig.targetWpm ? 'too slow' : 'perfectly on target';
    setMode(AgentMode.COACH_LESSON, {
      lessonId: 'pace-controller',
      lessonTitle: 'Pace Controller',
      step: {
        index: currentRound,
        total: TOTAL_ROUNDS,
        type: 'practice',
        aiPrompt: `The student just read at an average of ${avgWpm} WPM against a target of ${roundConfig.targetWpm} WPM (${diffDesc}). Accuracy score: ${accuracy}/100. Give 1-2 sentences of specific pace coaching feedback. If they were close (within 10 WPM), celebrate. If too fast, suggest breathing between sentences. If too slow, suggest building momentum. Be energetic and encouraging.`,
        expectedAction: 'listen',
        duration: 10,
      },
    });
  }, [currentRound, roundConfig, passage, setMode]);

  const advanceRound = useCallback(() => {
    if (currentRound + 1 >= TOTAL_ROUNDS) {
      // Game over
      endSession();
      const allResults = [...results];
      // include the last result which may not be in state yet
      if (allResults.length < TOTAL_ROUNDS && results.length > 0) {
        // results should already contain the latest
      }
      const avgAccuracy = allResults.length > 0
        ? Math.round(allResults.reduce((s, r) => s + r.accuracy, 0) / allResults.length)
        : 0;
      const reward = getDrachmaReward(avgAccuracy);
      addDrachmas(reward);
      completeLesson('pace-controller');
      setDrachmaAwarded(reward);
      setPhase('scoreboard');
    } else {
      setCurrentRound((r) => r + 1);
      showRoundIntro();
    }
  }, [currentRound, results, endSession, addDrachmas, completeLesson, showRoundIntro]);

  /** Start the game from intro */
  const handleStart = useCallback(() => {
    setCurrentRound(0);
    setResults([]);
    showRoundIntro();
  }, [showRoundIntro]);

  // Auto-advance from round result after AI finishes
  useEffect(() => {
    if (phase !== 'round-result') return;
    if (!aiIsSpeaking && lastFeedback) {
      const timeout = setTimeout(advanceRound, 3000);
      return () => clearTimeout(timeout);
    }
  }, [phase, aiIsSpeaking, lastFeedback, advanceRound]);

  // User can also manually finish reading early
  const handleFinishEarly = useCallback(() => {
    finishRound();
  }, [finishRound]);

  // ============================================================================
  // COMPUTED
  // ============================================================================

  const allResults = results;
  const avgAccuracy = allResults.length > 0
    ? Math.round(allResults.reduce((s, r) => s + r.accuracy, 0) / allResults.length)
    : 0;

  // ============================================================================
  // RENDER — INTRO
  // ============================================================================

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
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
            className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mb-8 shadow-[0_0_60px_rgba(59,130,246,0.4)]"
          >
            <Gauge className="w-14 h-14 text-white" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-4xl font-serif font-bold mb-3"
          >
            Pace Controller
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="text-stone-400 text-base max-w-sm mb-2"
          >
            Read passages at <span className="text-blue-400 font-semibold">3 different speeds</span>.
            A karaoke highlight shows the target pace — match it with your voice.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col items-center gap-4 mt-6 mb-8"
          >
            {/* Speed previews */}
            <div className="flex items-center gap-4 text-sm">
              {ROUNDS.map((r, i) => (
                <div key={i} className="flex flex-col items-center gap-1 px-4 py-3 bg-stone-800/60 rounded-lg border border-stone-700/50">
                  <span className="text-lg">{r.emoji}</span>
                  <span className="text-white font-mono font-bold">{r.targetWpm}</span>
                  <span className="text-[10px] uppercase tracking-widest text-stone-500">wpm</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-6 text-xs text-stone-500 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span>±10 WPM</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>±20 WPM</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span>Beyond</span>
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm text-stone-500 mt-2">
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-blue-400" />
                <span>3 rounds</span>
              </div>
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>Up to 50 Δ</span>
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
            className="px-12 py-4 bg-gradient-to-r from-blue-500 to-cyan-400 text-white text-lg font-bold rounded-2xl shadow-lg shadow-blue-500/30 uppercase tracking-wider"
          >
            Let's Go
          </motion.button>
        </div>
      </FadeTransition>
    );
  }

  // ============================================================================
  // RENDER — SCOREBOARD
  // ============================================================================

  if (phase === 'scoreboard') {
    const grade = getGrade(avgAccuracy);

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
            Average accuracy: {avgAccuracy}% across {TOTAL_ROUNDS} speeds
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
            {allResults.map((r) => {
              const diff = Math.abs(r.averageWpm - r.targetWpm);
              const borderColor =
                diff <= 10
                  ? 'bg-emerald-500/10 border-emerald-500/20'
                  : diff <= 20
                    ? 'bg-amber-500/10 border-amber-500/20'
                    : 'bg-red-500/10 border-red-500/20';
              return (
                <div
                  key={r.round}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg border ${borderColor}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{ROUNDS[r.round - 1]?.emoji}</span>
                    <div>
                      <span className="text-sm text-stone-300 font-medium">
                        {ROUNDS[r.round - 1]?.label}
                      </span>
                      <div className="text-xs text-stone-500 font-mono">
                        Target: {r.targetWpm} WPM
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-mono font-bold ${getWpmColor(r.averageWpm, r.targetWpm)}`}>
                      {r.averageWpm} <span className="text-xs text-stone-500">WPM</span>
                    </div>
                    <div className="text-xs text-stone-500">{r.accuracy}% accuracy</div>
                  </div>
                </div>
              );
            })}
          </motion.div>

          {/* Speed Feel Summary */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="w-full max-w-md bg-stone-800/50 border border-stone-700/50 rounded-lg p-4 mb-8"
          >
            <h4 className="text-xs uppercase tracking-widest text-stone-500 mb-3">
              Your Speed Profile
            </h4>
            <div className="flex items-end justify-around h-24">
              {allResults.map((r) => {
                const barHeight = Math.max(15, Math.min(100, r.accuracy));
                const color = getWpmColor(r.averageWpm, r.targetWpm).replace('text-', 'bg-');
                return (
                  <div key={r.round} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-mono text-stone-400">{r.averageWpm}</span>
                    <div
                      className={`w-10 rounded-t-md ${color} transition-all`}
                      style={{ height: `${barHeight}%` }}
                    />
                    <span className="text-[10px] font-mono text-stone-500">{r.targetWpm}</span>
                  </div>
                );
              })}
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
              className="w-full px-8 py-3 bg-gradient-to-r from-blue-500 to-cyan-400 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 uppercase tracking-wider text-sm"
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

  // ============================================================================
  // RENDER — ROUND INTRO / COUNTDOWN / READING / ROUND RESULT
  // ============================================================================

  return (
    <FadeTransition className="fixed inset-0 bg-stone-900 text-white z-50 flex flex-col">
      {/* Close button */}
      <button
        onClick={onExit}
        className="absolute top-6 right-6 text-stone-500 hover:text-white transition-colors z-40"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Top bar: Round indicators */}
      <div className="flex items-center justify-between px-6 pt-6 pb-3 z-20">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => (
            <div
              key={i}
              className={`w-10 h-1.5 rounded-full transition-all duration-300 ${
                i < currentRound
                  ? 'bg-emerald-400'
                  : i === currentRound
                    ? 'bg-blue-400'
                    : 'bg-stone-700'
              }`}
            />
          ))}
          <span className="ml-3 text-xs font-mono text-stone-500">
            R{currentRound + 1}/{TOTAL_ROUNDS}
          </span>
        </div>

        {/* Live WPM badge (only during reading) */}
        {phase === 'reading' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`flex items-center gap-2 px-3 py-1 rounded-full border ${
              liveWpmLocal === 0
                ? 'bg-stone-800 border-stone-700 text-stone-400'
                : getWpmColor(liveWpmLocal, roundConfig.targetWpm) === 'text-emerald-400'
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : getWpmColor(liveWpmLocal, roundConfig.targetWpm) === 'text-amber-400'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                    : 'bg-red-500/20 border-red-500/40 text-red-400'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span className="text-sm font-mono font-bold">{liveWpmLocal || '—'} WPM</span>
          </motion.div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 relative">
        <AnimatePresence mode="wait">
          {/* ── ROUND INTRO ─────────────────────────────── */}
          {phase === 'round-intro' && (
            <motion.div
              key="round-intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center text-center"
            >
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                className="text-6xl mb-6"
              >
                {roundConfig.emoji}
              </motion.span>

              <h2 className="text-3xl font-serif font-bold mb-2">
                Round {currentRound + 1}: {roundConfig.label}
              </h2>

              <p className="text-stone-400 text-sm mb-2">{roundConfig.description}</p>

              <div className="flex items-center gap-2 mb-8">
                <span className="text-blue-400 font-mono text-xl font-bold">{roundConfig.targetWpm}</span>
                <span className="text-stone-500 text-sm">WPM target</span>
              </div>

              <p className="text-stone-500 text-xs max-w-sm mb-8 italic">
                Read the passage at the pace shown by the highlight. Try to keep your speed
                within the green zone.
              </p>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={startCountdown}
                className="flex items-center gap-2 px-10 py-3 bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 uppercase tracking-wider text-sm"
              >
                <Play className="w-4 h-4" /> Ready
              </motion.button>
            </motion.div>
          )}

          {/* ── COUNTDOWN ───────────────────────────────── */}
          {phase === 'countdown' && (
            <motion.div
              key="countdown"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              className="flex flex-col items-center"
            >
              <p className="text-stone-400 text-sm mb-4">
                Target: <span className="text-blue-400 font-mono font-bold">{roundConfig.targetWpm} WPM</span>
              </p>
              <motion.span
                key={countdown}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                className="text-8xl font-mono font-bold text-blue-400"
              >
                {countdown}
              </motion.span>
              <p className="text-stone-500 text-xs mt-4 uppercase tracking-widest">
                Start reading when the highlight begins...
              </p>
            </motion.div>
          )}

          {/* ── READING PHASE ───────────────────────────── */}
          {phase === 'reading' && (
            <motion.div
              key="reading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`w-full max-w-2xl transition-shadow duration-500 ${getGlowColor(liveWpmLocal, roundConfig.targetWpm)}`}
            >
              {/* Target badge */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-lg">{roundConfig.emoji}</span>
                  <span className="text-stone-400">Read at</span>
                  <span className="text-blue-400 font-mono font-bold">{roundConfig.targetWpm} WPM</span>
                </div>

                {/* Mic indicator */}
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="flex items-center gap-1.5 text-emerald-400 text-sm"
                >
                  <Mic className="w-4 h-4" />
                  <span className="text-xs font-medium">Listening</span>
                </motion.div>
              </div>

              {/* Karaoke passage */}
              <div className="bg-stone-800/50 border border-stone-700/50 rounded-xl p-6 mb-6">
                <KaraokeText
                  passage={passage}
                  targetWpm={roundConfig.targetWpm}
                  isActive={true}
                  elapsedMs={elapsedMs}
                />
              </div>

              {/* WPM Gauge */}
              <div className="flex items-center justify-center mb-6">
                <WpmGauge actual={liveWpmLocal} target={roundConfig.targetWpm} />
              </div>

              {/* Color feedback bar */}
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                  liveWpmLocal === 0
                    ? 'bg-stone-800'
                    : getWpmColor(liveWpmLocal, roundConfig.targetWpm) === 'text-emerald-400'
                      ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]'
                      : getWpmColor(liveWpmLocal, roundConfig.targetWpm) === 'text-amber-400'
                        ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                        : 'bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.5)]'
                }`} />
              </div>

              {/* Finish early button */}
              <div className="flex justify-center">
                <button
                  onClick={handleFinishEarly}
                  className="text-stone-500 hover:text-stone-300 text-xs uppercase tracking-widest transition-colors"
                >
                  Finish Reading →
                </button>
              </div>
            </motion.div>
          )}

          {/* ── ROUND RESULT ────────────────────────────── */}
          {phase === 'round-result' && (() => {
            const lastResult = allResults[allResults.length - 1];
            if (!lastResult) return null;
            const diff = Math.abs(lastResult.averageWpm - lastResult.targetWpm);
            return (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center text-center px-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 12 }}
                  className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
                    diff <= 10
                      ? 'bg-emerald-500/20'
                      : diff <= 20
                        ? 'bg-amber-500/20'
                        : 'bg-red-500/20'
                  }`}
                >
                  <span className="text-4xl">
                    {diff <= 10 ? '🎯' : diff <= 20 ? '👏' : '💪'}
                  </span>
                </motion.div>

                <h3 className="text-2xl font-serif font-bold mb-1">
                  {diff <= 10
                    ? 'Right on target!'
                    : diff <= 20
                      ? 'Close!'
                      : 'Keep practicing!'}
                </h3>

                <div className="flex items-center gap-4 mb-4">
                  <div className="text-center">
                    <div className={`text-3xl font-mono font-bold ${getWpmColor(lastResult.averageWpm, lastResult.targetWpm)}`}>
                      {lastResult.averageWpm}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-stone-500">your wpm</div>
                  </div>
                  <div className="text-stone-600">vs</div>
                  <div className="text-center">
                    <div className="text-3xl font-mono font-bold text-blue-400">
                      {lastResult.targetWpm}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-stone-500">target</div>
                  </div>
                </div>

                <div className="text-sm text-stone-400 mb-4">
                  Accuracy: <span className="font-mono font-bold text-white">{lastResult.accuracy}%</span>
                </div>

                {lastFeedback && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-stone-400 text-sm max-w-sm italic mb-6"
                  >
                    &ldquo;{lastFeedback}&rdquo;
                  </motion.p>
                )}

                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.5 }}
                  onClick={advanceRound}
                  className="flex items-center gap-2 text-sm text-stone-400 hover:text-white transition-colors mt-2"
                >
                  {currentRound + 1 < TOTAL_ROUNDS ? (
                    <>
                      Next Speed <ChevronRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      See Results <Trophy className="w-4 h-4 text-amber-400" />
                    </>
                  )}
                </motion.button>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>

      {/* Bottom info */}
      {phase === 'reading' && (
        <div className="px-6 pb-6 flex items-center justify-center gap-8 text-xs text-stone-500 font-mono">
          <span>
            Speed:{' '}
            <span className={`font-bold ${getWpmColor(liveWpmLocal, roundConfig.targetWpm)}`}>
              {liveWpmLocal > 0 ? (
                liveWpmLocal > roundConfig.targetWpm ? 'TOO FAST' :
                liveWpmLocal < roundConfig.targetWpm - 20 ? 'TOO SLOW' :
                'ON PACE'
              ) : 'START READING'}
            </span>
          </span>
          <span>
            Target: <span className="text-blue-400 font-bold">{roundConfig.targetWpm} WPM</span>
          </span>
        </div>
      )}
    </FadeTransition>
  );
};
