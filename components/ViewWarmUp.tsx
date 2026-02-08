
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeTransition } from './FadeTransition.tsx';
import { X, Wind, Pause, ArrowDown, ChevronRight, Music, Waves, Type, SkipForward } from 'lucide-react';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { AgentMode } from '../types.ts';
import {
  BreathingDetector,
  type BreathPhase,
  type BreathingMetrics,
  getBreathPhaseMessage,
} from '../lib/breathing_detector.ts';

interface ViewWarmUpProps {
  onComplete: () => void;
  onExit: () => void;
}

const STAGES = [
  { id: 'breathe', title: 'Breathe', duration: 90 },
  { id: 'voice', title: 'Voice', duration: 90 },
  { id: 'body', title: 'Body', duration: 90 }
];

const TARGET_CYCLES = 6;

// ── Voice exercise config ───────────────────────────────────────────────
type VoiceExerciseId = 'humming' | 'lip-trills' | 'tongue-twister';

interface VoiceExercise {
  id: VoiceExerciseId;
  title: string;
  icon: React.ReactNode;
  duration: number; // seconds
  instruction: string;
}

const VOICE_EXERCISES: VoiceExercise[] = [
  {
    id: 'humming',
    title: 'Humming',
    icon: <Music className="w-5 h-5" />,
    duration: 30,
    instruction: 'Hum at your natural pitch: mmmmmmm',
  },
  {
    id: 'lip-trills',
    title: 'Lip Trills',
    icon: <Waves className="w-5 h-5" />,
    duration: 30,
    instruction: 'Blow through your lips: brrrrrrr',
  },
  {
    id: 'tongue-twister',
    title: 'Tongue Twisters',
    icon: <Type className="w-5 h-5" />,
    duration: 60,
    instruction: 'Repeat each phrase clearly',
  },
];

const HUMMING_CUES = ['Slide up ↑', 'Slide down ↓'] as const;
const LIP_TRILL_CUES = ['Go higher ↑', 'Go lower ↓'] as const;
const TONGUE_TWISTERS = [
  'Red leather, yellow leather',
  'Unique New York, unique New York',
  'She sells seashells by the seashore',
] as const;
const TWISTER_AUTO_ADVANCE = 20; // seconds per twister

const TOTAL_VOICE_DURATION = VOICE_EXERCISES.reduce((s, e) => s + e.duration, 0);

// ── Circle animation config per detected phase ─────────────────────────
const PHASE_CIRCLE: Record<BreathPhase, { scale: number; opacity: number; borderColor: string }> = {
  idle:    { scale: 1,    opacity: 0.3, borderColor: 'rgba(168,162,158,0.4)' },
  inhale:  { scale: 1.45, opacity: 1,   borderColor: 'rgba(16,185,129,0.8)' },   // emerald
  hold:    { scale: 1.45, opacity: 0.85, borderColor: 'rgba(99,102,241,0.7)' },   // indigo
  exhale:  { scale: 0.85, opacity: 0.7,  borderColor: 'rgba(168,162,158,0.6)' },  // stone
};
const PHASE_TRANSITION: Record<BreathPhase, { duration: number; ease: string }> = {
  idle:    { duration: 0.6, ease: 'easeOut' },
  inhale:  { duration: 3.8, ease: 'easeInOut' },
  hold:    { duration: 0.4, ease: 'easeOut' },
  exhale:  { duration: 3.8, ease: 'easeInOut' },
};

// ── Phase icon helper ──────────────────────────────────────────────────
const PhaseIcon: React.FC<{ phase: BreathPhase }> = ({ phase }) => {
  const cls = 'w-5 h-5';
  switch (phase) {
    case 'inhale': return <Wind className={cls} />;
    case 'hold':   return <Pause className={cls} />;
    case 'exhale': return <ArrowDown className={cls} />;
    default:       return null;
  }
};

export const ViewWarmUp: React.FC<ViewWarmUpProps> = ({ onComplete, onExit }) => {
  const { setMode, isConnected, volume } = useRhetor();
  const [stageIndex, setStageIndex] = useState(0);
  const currentStage = STAGES[stageIndex];
  
  // Vision state (keep local as it's view-specific visual feedback)
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // ── Breathing detector state ──────────────────────────────────────────
  const detectorRef = useRef<BreathingDetector | null>(null);
  const [breathPhase, setBreathPhase] = useState<BreathPhase>('idle');
  const [cycleCount, setCycleCount] = useState(0);
  const [rhythmScore, setRhythmScore] = useState(0);
  const [breathCompleted, setBreathCompleted] = useState(false);
  const autoAdvancedRef = useRef(false);

  // ── Voice exercise state ──────────────────────────────────────────────
  const [voiceExIndex, setVoiceExIndex] = useState(0);
  const [voiceRunning, setVoiceRunning] = useState(false);
  const [voiceTimer, setVoiceTimer] = useState(0); // counts down
  const [voiceCueIdx, setVoiceCueIdx] = useState(0); // for humming/lip-trill cues
  const [twisterIdx, setTwisterIdx] = useState(0);
  const [voiceCompleted, setVoiceCompleted] = useState(false);
  const voiceAutoRef = useRef(false);

  // Set mode when connected - only run once when isConnected becomes true
  const modeSetRef = useRef(false);
  useEffect(() => {
    if (isConnected && !modeSetRef.current) {
      modeSetRef.current = true;
      setMode(AgentMode.COACH_WARMUP);
    }
  }, [isConnected, setMode]);

  // ── Breathing detector lifecycle ──────────────────────────────────────
  useEffect(() => {
    if (currentStage.id !== 'breathe') {
      // Clean up if we left the breathe stage
      if (detectorRef.current) {
        detectorRef.current.stop();
        detectorRef.current = null;
      }
      return;
    }

    const detector = new BreathingDetector({
      inhalePattern: [4, 4, 4], // 4-4-4 box breathing
      volumeThreshold: 0.04,
      onPhaseChange: (phase: BreathPhase) => {
        setBreathPhase(phase);
      },
      onCycleComplete: (cycle: number, metrics: Partial<BreathingMetrics>) => {
        setCycleCount(cycle);
        if (metrics.rhythmScore !== undefined) {
          setRhythmScore(metrics.rhythmScore);
        }
        // Auto-advance after TARGET_CYCLES
        if (cycle >= TARGET_CYCLES && !autoAdvancedRef.current) {
          autoAdvancedRef.current = true;
          setBreathCompleted(true);
        }
      },
    });

    detector.startExternal();
    detectorRef.current = detector;

    return () => {
      detector.stop();
      detectorRef.current = null;
    };
  }, [currentStage.id]);

  // ── Feed volume data from AudioRecorder's VU meter to detector ────────
  useEffect(() => {
    if (currentStage.id === 'breathe' && detectorRef.current) {
      detectorRef.current.feedVolume(volume);
    }
  }, [volume, currentStage.id]);

  // ── Auto-advance to Voice after breath completed ──────────────────────
  useEffect(() => {
    if (!breathCompleted) return;
    const t = setTimeout(() => {
      setStageIndex(prev => Math.min(prev + 1, STAGES.length - 1));
    }, 1500);
    return () => clearTimeout(t);
  }, [breathCompleted]);

  // ── Voice exercise countdown timer ────────────────────────────────────
  useEffect(() => {
    if (currentStage.id !== 'voice' || !voiceRunning || voiceTimer <= 0) return;
    const t = setInterval(() => {
      setVoiceTimer(prev => {
        if (prev <= 1) {
          clearInterval(t);
          // Exercise finished — advance
          const nextIdx = voiceExIndex + 1;
          if (nextIdx < VOICE_EXERCISES.length) {
            setVoiceExIndex(nextIdx);
            setVoiceRunning(false);
            setVoiceCueIdx(0);
            setTwisterIdx(0);
          } else {
            // All exercises done
            if (!voiceAutoRef.current) {
              voiceAutoRef.current = true;
              setVoiceCompleted(true);
            }
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [currentStage.id, voiceRunning, voiceTimer, voiceExIndex]);

  // ── Humming / Lip-trill cue rotation (every 5s) ──────────────────────
  useEffect(() => {
    if (currentStage.id !== 'voice' || !voiceRunning) return;
    const ex = VOICE_EXERCISES[voiceExIndex];
    if (ex.id !== 'humming' && ex.id !== 'lip-trills') return;
    const iv = setInterval(() => {
      setVoiceCueIdx(prev => prev + 1);
    }, 5000);
    return () => clearInterval(iv);
  }, [currentStage.id, voiceRunning, voiceExIndex]);

  // ── Tongue-twister auto-advance (every 20s) ──────────────────────────
  useEffect(() => {
    if (currentStage.id !== 'voice' || !voiceRunning) return;
    const ex = VOICE_EXERCISES[voiceExIndex];
    if (ex.id !== 'tongue-twister') return;
    const iv = setInterval(() => {
      setTwisterIdx(prev => Math.min(prev + 1, TONGUE_TWISTERS.length - 1));
    }, TWISTER_AUTO_ADVANCE * 1000);
    return () => clearInterval(iv);
  }, [currentStage.id, voiceRunning, voiceExIndex]);

  // ── Auto-advance to Body after voice completed ────────────────────────
  useEffect(() => {
    if (!voiceCompleted) return;
    const t = setTimeout(() => {
      setStageIndex(prev => Math.min(prev + 1, STAGES.length - 1));
    }, 1500);
    return () => clearTimeout(t);
  }, [voiceCompleted]);

  // Reset voice state when entering voice stage
  useEffect(() => {
    if (currentStage.id === 'voice') {
      setVoiceExIndex(0);
      setVoiceRunning(false);
      setVoiceTimer(0);
      setVoiceCueIdx(0);
      setTwisterIdx(0);
      setVoiceCompleted(false);
      voiceAutoRef.current = false;
    }
  }, [currentStage.id]);

  // ── Voice helpers ─────────────────────────────────────────────────────
  const startVoiceExercise = useCallback(() => {
    setVoiceTimer(VOICE_EXERCISES[voiceExIndex].duration);
    setVoiceCueIdx(0);
    setTwisterIdx(0);
    setVoiceRunning(true);
  }, [voiceExIndex]);

  const skipVoiceExercise = useCallback(() => {
    setVoiceRunning(false);
    const nextIdx = voiceExIndex + 1;
    if (nextIdx < VOICE_EXERCISES.length) {
      setVoiceExIndex(nextIdx);
      setVoiceTimer(0);
      setVoiceCueIdx(0);
      setTwisterIdx(0);
    } else {
      if (!voiceAutoRef.current) {
        voiceAutoRef.current = true;
        setVoiceCompleted(true);
      }
    }
  }, [voiceExIndex]);

  /** Total elapsed time across all voice exercises (for the overall progress bar) */
  const voiceElapsed = (() => {
    let elapsed = 0;
    for (let i = 0; i < voiceExIndex; i++) elapsed += VOICE_EXERCISES[i].duration;
    if (voiceRunning) elapsed += VOICE_EXERCISES[voiceExIndex].duration - voiceTimer;
    return elapsed;
  })();

  // Camera Logic for BODY stage only
  useEffect(() => {
    let localStream: MediaStream | null = null;
    let mounted = true;

    if (currentStage.id === 'body') {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(s => {
          if (!mounted) {
            s.getTracks().forEach(t => t.stop());
            return;
          }
          localStream = s;
          setStream(s);
          if (videoRef.current) videoRef.current.srcObject = s;
        })
        .catch(console.error);
    } else {
      // Not body stage - ensure stream is stopped
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        setStream(null);
      }
    }

    return () => {
      mounted = false;
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [currentStage.id]);

  const handleNext = () => {
    if (stageIndex < STAGES.length - 1) {
      setStageIndex(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  // ── Current circle animation values ───────────────────────────────────
  const circleAnim = PHASE_CIRCLE[breathPhase];
  const circleTrans = PHASE_TRANSITION[breathPhase];

  return (
    <FadeTransition className="flex flex-col items-center justify-center min-h-screen p-6 relative bg-stone-50 text-stone-900 overflow-hidden">
      <button onClick={onExit} className="absolute top-6 right-6 text-stone-400 hover:text-stone-900 transition-colors z-20">
        <X className="w-6 h-6" />
      </button>

      <div className="absolute top-12 flex gap-2 z-10">
        {STAGES.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === stageIndex ? 'bg-stone-900' : 'bg-stone-300'}`} />
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg z-10 text-center">
         <AnimatePresence mode="wait">
             {/* ───── BREATHE STAGE ───── */}
             {currentStage.id === 'breathe' && (
                 <motion.div
                   key="breathe"
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   className="flex flex-col items-center"
                 >
                    <h2 className="text-4xl font-serif font-light mb-1">Breathe</h2>
                    <p className="text-stone-500 font-serif italic mb-10">
                      Box breathing — 4 · 4 · 4 · 4
                    </p>

                    {/* Pulsing circle synced to detected phase */}
                    <div className="relative flex items-center justify-center mb-10">
                      {/* Outer glow ring */}
                      <motion.div
                        className="absolute w-52 h-52 rounded-full"
                        animate={{
                          scale: circleAnim.scale * 1.08,
                          opacity: circleAnim.opacity * 0.25,
                        }}
                        transition={{ duration: circleTrans.duration * 1.1, ease: circleTrans.ease }}
                        style={{ background: `radial-gradient(circle, ${circleAnim.borderColor} 0%, transparent 70%)` }}
                      />

                      {/* Main breath circle */}
                      <motion.div
                        className="w-48 h-48 rounded-full border-4 flex items-center justify-center"
                        animate={{
                          scale: circleAnim.scale,
                          opacity: circleAnim.opacity,
                          borderColor: circleAnim.borderColor,
                        }}
                        transition={{ duration: circleTrans.duration, ease: circleTrans.ease }}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <PhaseIcon phase={breathPhase} />
                          <span className="text-lg font-light tracking-wide">
                            {getBreathPhaseMessage(breathPhase)}
                          </span>
                        </div>
                      </motion.div>

                      {/* Volume indicator ring */}
                      <motion.div
                        className="absolute w-48 h-48 rounded-full border-2 border-stone-300/30 pointer-events-none"
                        animate={{ scale: 1 + volume * 0.3, opacity: 0.3 + volume * 0.5 }}
                        transition={{ duration: 0.08 }}
                      />
                    </div>

                    {/* Cycle counter */}
                    <p className="text-sm text-stone-600 tracking-widest uppercase mb-2">
                      Cycle {Math.min(cycleCount + (breathPhase !== 'idle' ? 1 : 0), TARGET_CYCLES)} of {TARGET_CYCLES}
                    </p>

                    {/* Progress pips */}
                    <div className="flex gap-2 mb-4">
                      {Array.from({ length: TARGET_CYCLES }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                            i < cycleCount
                              ? 'bg-emerald-500'
                              : i === cycleCount && breathPhase !== 'idle'
                                ? 'bg-emerald-300 animate-pulse'
                                : 'bg-stone-200'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Rhythm score (show after first cycle) */}
                    {cycleCount > 0 && (
                      <motion.p
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-stone-400"
                      >
                        Rhythm consistency:{' '}
                        <span className={`font-medium ${
                          rhythmScore >= 70 ? 'text-emerald-600' : rhythmScore >= 40 ? 'text-amber-600' : 'text-red-500'
                        }`}>
                          {rhythmScore}%
                        </span>
                      </motion.p>
                    )}

                    {/* Completed badge */}
                    {breathCompleted && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-4 px-4 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium"
                      >
                        ✓ Breathing complete — moving on
                      </motion.div>
                    )}
                 </motion.div>
             )}

             {/* ───── VOICE STAGE ───── */}
             {currentStage.id === 'voice' && (
                 <motion.div
                   key="voice"
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   className="flex flex-col items-center w-full"
                 >
                    <h2 className="text-4xl font-serif font-light mb-1">Voice</h2>
                    <p className="text-stone-500 font-serif italic mb-6">Warm up your instrument</p>

                    {/* Overall progress bar */}
                    <div className="w-full max-w-xs mb-8">
                      <div className="flex items-center justify-between text-[10px] text-stone-400 uppercase tracking-widest mb-1.5">
                        {VOICE_EXERCISES.map((ex, i) => (
                          <span
                            key={ex.id}
                            className={`${
                              i < voiceExIndex ? 'text-emerald-600' : i === voiceExIndex ? 'text-stone-900 font-medium' : ''
                            }`}
                          >
                            {ex.title}
                          </span>
                        ))}
                      </div>
                      <div className="h-1 bg-stone-200 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-stone-900 rounded-full"
                          animate={{ width: `${(voiceElapsed / TOTAL_VOICE_DURATION) * 100}%` }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      {(() => {
                        const ex = VOICE_EXERCISES[voiceExIndex];
                        if (!ex) return null;

                        return (
                          <motion.div
                            key={ex.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.3 }}
                            className="flex flex-col items-center"
                          >
                            {/* Exercise icon + title */}
                            <div className="flex items-center gap-2 text-stone-600 mb-3">
                              {ex.icon}
                              <span className="text-sm uppercase tracking-widest font-medium">{ex.title}</span>
                            </div>

                            {/* Instruction */}
                            <p className="text-lg text-stone-800 font-serif mb-6 max-w-sm leading-relaxed">
                              {ex.instruction}
                            </p>

                            {/* ── Per-exercise content ── */}
                            {/* Humming */}
                            {ex.id === 'humming' && voiceRunning && (
                              <motion.div
                                key={`cue-${voiceCueIdx}`}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-2xl font-light text-stone-700 mb-6"
                              >
                                {HUMMING_CUES[voiceCueIdx % HUMMING_CUES.length]}
                              </motion.div>
                            )}

                            {/* Lip Trills */}
                            {ex.id === 'lip-trills' && voiceRunning && (
                              <motion.div
                                key={`cue-${voiceCueIdx}`}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-2xl font-light text-stone-700 mb-6"
                              >
                                {LIP_TRILL_CUES[voiceCueIdx % LIP_TRILL_CUES.length]}
                              </motion.div>
                            )}

                            {/* Tongue Twisters */}
                            {ex.id === 'tongue-twister' && voiceRunning && (
                              <div className="flex flex-col items-center mb-6">
                                <AnimatePresence mode="wait">
                                  <motion.p
                                    key={twisterIdx}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    className="text-2xl font-serif text-stone-900 leading-snug text-center max-w-sm"
                                  >
                                    "{TONGUE_TWISTERS[twisterIdx]}"
                                  </motion.p>
                                </AnimatePresence>
                                <div className="flex gap-1.5 mt-4">
                                  {TONGUE_TWISTERS.map((_, i) => (
                                    <div
                                      key={i}
                                      className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                                        i < twisterIdx ? 'bg-emerald-500' : i === twisterIdx ? 'bg-stone-900' : 'bg-stone-200'
                                      }`}
                                    />
                                  ))}
                                </div>
                                {twisterIdx < TONGUE_TWISTERS.length - 1 && (
                                  <button
                                    onClick={() => setTwisterIdx(prev => Math.min(prev + 1, TONGUE_TWISTERS.length - 1))}
                                    className="mt-3 text-xs text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-1"
                                  >
                                    Next twister <ChevronRight className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Timer */}
                            {voiceRunning && (
                              <div className="flex flex-col items-center mb-4">
                                <span className="text-3xl font-light tabular-nums text-stone-900">
                                  {String(Math.floor(voiceTimer / 60)).padStart(1, '0')}:{String(voiceTimer % 60).padStart(2, '0')}
                                </span>
                                {/* Mini progress for this exercise */}
                                <div className="w-40 h-0.5 bg-stone-200 rounded-full mt-2 overflow-hidden">
                                  <motion.div
                                    className="h-full bg-stone-600 rounded-full"
                                    animate={{ width: `${((ex.duration - voiceTimer) / ex.duration) * 100}%` }}
                                    transition={{ duration: 0.8 }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Start / Skip buttons */}
                            <div className="flex items-center gap-4">
                              {!voiceRunning && !voiceCompleted && (
                                <button
                                  onClick={startVoiceExercise}
                                  className="px-5 py-2 bg-stone-900 text-stone-50 rounded-full text-sm uppercase tracking-widest hover:bg-stone-800 transition-colors"
                                >
                                  Start
                                </button>
                              )}
                              {voiceRunning && (
                                <button
                                  onClick={skipVoiceExercise}
                                  className="flex items-center gap-1.5 text-stone-400 hover:text-stone-700 text-xs uppercase tracking-widest transition-colors"
                                >
                                  <SkipForward className="w-3.5 h-3.5" /> Skip
                                </button>
                              )}
                            </div>
                          </motion.div>
                        );
                      })()}
                    </AnimatePresence>

                    {/* Completed badge */}
                    {voiceCompleted && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-6 px-4 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium"
                      >
                        ✓ Voice warm-up complete — moving on
                      </motion.div>
                    )}
                 </motion.div>
             )}

             {/* ───── BODY STAGE ───── */}
             {currentStage.id === 'body' && (
                 <motion.div key="body" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="w-full">
                    <div className="relative w-full aspect-video bg-black rounded-sm overflow-hidden mb-8">
                        {stream && <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />}
                    </div>
                    <h2 className="text-4xl font-serif font-light mb-2">Body</h2>
                    <p className="text-stone-500 font-serif italic">Stand tall.</p>
                 </motion.div>
             )}
         </AnimatePresence>
      </div>

      <div className="w-full max-w-md z-20 flex flex-col items-center gap-4">
          <p className="text-xs text-stone-400 uppercase tracking-widest animate-pulse">Rhetor is guiding you...</p>
          <button onClick={handleNext} className="text-stone-900 border-b border-stone-900 pb-1 text-sm uppercase tracking-widest">
              Next Stage →
          </button>
      </div>
    </FadeTransition>
  );
};
