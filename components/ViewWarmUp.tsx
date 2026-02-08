
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeTransition } from './FadeTransition.tsx';
import { X, Wind, Pause, ArrowDown, ChevronRight, Music, Waves, Type, SkipForward, Hand, Crown, Footprints, Sparkles, Coins } from 'lucide-react';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { AgentMode } from '../types.ts';

type BreathPhase = 'idle' | 'inhale' | 'hold' | 'exhale' | 'hold-empty';

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

// ── Body exercise config ────────────────────────────────────────────────
type BodyExerciseId = 'tension-release' | 'power-pose' | 'grounding';

interface BodySubStep {
  instruction: string;
  duration: number; // seconds
}

interface BodyExercise {
  id: BodyExerciseId;
  title: string;
  icon: React.ReactNode;
  totalDuration: number;
  subSteps: BodySubStep[];
  showCamera?: boolean;
}

const BODY_EXERCISES: BodyExercise[] = [
  {
    id: 'tension-release',
    title: 'Tension Release',
    icon: <Hand className="w-5 h-5" />,
    totalDuration: 30,
    subSteps: [
      { instruction: 'Scrunch your face tight — hold 5s — release', duration: 10 },
      { instruction: 'Shrug shoulders to ears — hold 5s — drop', duration: 10 },
      { instruction: 'Shake out your hands', duration: 10 },
    ],
  },
  {
    id: 'power-pose',
    title: 'Power Pose',
    icon: <Crown className="w-5 h-5" />,
    totalDuration: 45,
    showCamera: true,
    subSteps: [
      { instruction: 'Stand tall. Hands on hips. Chin up.', duration: 45 },
    ],
  },
  {
    id: 'grounding',
    title: 'Grounding',
    icon: <Footprints className="w-5 h-5" />,
    totalDuration: 15,
    subSteps: [
      { instruction: 'Feel your feet on the floor. One deep breath. You are ready.', duration: 15 },
    ],
  },
];

const TOTAL_BODY_DURATION = BODY_EXERCISES.reduce((s, e) => s + e.totalDuration, 0);
const DRACHMA_REWARD = 15;

// ── Helper function for breath phase message ──────────────────────────────
const getBreathPhaseMessage = (phase: BreathPhase): string => {
  switch (phase) {
    case 'inhale': return 'Breathe In...';
    case 'hold': return 'Hold...';
    case 'exhale': return 'Breathe Out...';
    case 'hold-empty': return 'Hold...';
    default: return 'Ready to breathe?';
  }
};

// ── Circle animation config per phase (black and white only) ─────────────────────
const PHASE_CIRCLE: Record<BreathPhase, { scale: number; opacity: number; borderColor: string }> = {
  idle:    { scale: 1,    opacity: 0.3, borderColor: 'rgba(0,0,0,0.2)' },
  inhale:  { scale: 1.6, opacity: 1,   borderColor: 'rgba(0,0,0,1)' },
  hold:    { scale: 1.6, opacity: 0.9, borderColor: 'rgba(0,0,0,0.9)' },
  exhale:  { scale: 1,  opacity: 0.7,  borderColor: 'rgba(0,0,0,0.4)' },
  'hold-empty': { scale: 1, opacity: 0.7, borderColor: 'rgba(0,0,0,0.4)' },
};
const PHASE_TRANSITION: Record<BreathPhase, { duration: number; ease: string }> = {
  idle:    { duration: 0.6, ease: 'easeOut' },
  inhale:  { duration: 3.8, ease: 'easeInOut' },
  hold:    { duration: 0.4, ease: 'easeOut' },
  exhale:  { duration: 3.8, ease: 'easeInOut' },
  'hold-empty': { duration: 0.4, ease: 'easeOut' },
};

// ── Phase icon helper ──────────────────────────────────────────────────
const PhaseIcon: React.FC<{ phase: BreathPhase }> = ({ phase }) => {
  const cls = 'w-5 h-5';
  switch (phase) {
    case 'inhale': return <Wind className={cls} />;
    case 'hold':   return <Pause className={cls} />;
    case 'exhale': return <ArrowDown className={cls} />;
    case 'hold-empty': return <Pause className={cls} />;
    default:       return null;
  }
};

export const ViewWarmUp: React.FC<ViewWarmUpProps> = ({ onComplete, onExit }) => {
  const { setMode, isConnected, addDrachmas } = useRhetor();
  const [stageIndex, setStageIndex] = useState(0);
  const currentStage = STAGES[stageIndex];
  
  // Vision state (keep local as it's view-specific visual feedback)
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // ── Breathing state ──────────────────────────────────────────────────────
  const [breathPhase, setBreathPhase] = useState<BreathPhase>('idle');
  const [cycleCount, setCycleCount] = useState(0);
  const [breathCompleted, setBreathCompleted] = useState(false);
  const [breathTimer, setBreathTimer] = useState(0);
  const autoAdvancedRef = useRef(false);
  const breathIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Voice exercise state ──────────────────────────────────────────────
  const [voiceExIndex, setVoiceExIndex] = useState(0);
  const [voiceRunning, setVoiceRunning] = useState(false);
  const [voiceTimer, setVoiceTimer] = useState(0); // counts down
  const [voiceCueIdx, setVoiceCueIdx] = useState(0); // for humming/lip-trill cues
  const [twisterIdx, setTwisterIdx] = useState(0);
  const [voiceCompleted, setVoiceCompleted] = useState(false);
  const voiceAutoRef = useRef(false);

  // ── Body exercise state ───────────────────────────────────────────────
  const [bodyExIndex, setBodyExIndex] = useState(0);
  const [bodySubStep, setBodySubStep] = useState(0);
  const [bodyTimer, setBodyTimer] = useState(0);
  const [bodyRunning, setBodyRunning] = useState(false);
  const [bodyCompleted, setBodyCompleted] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const bodyAutoRef = useRef(false);

  // Set mode when connected - reset on disconnect so it re-fires after reconnection
  const modeSetRef = useRef(false);
  useEffect(() => {
    if (isConnected && !modeSetRef.current) {
      modeSetRef.current = true;
      setMode(AgentMode.COACH_WARMUP);
    } else if (!isConnected) {
      modeSetRef.current = false;
    }
  }, [isConnected, setMode]);

  // ── Simple timer-based breathing cycle ────────────────────────────────────
  useEffect(() => {
    if (currentStage.id !== 'breathe' || breathCompleted) {
      if (breathIntervalRef.current) {
        clearInterval(breathIntervalRef.current);
        breathIntervalRef.current = null;
        setBreathPhase('idle');
      }
      return;
    }

    // Box breathing: 4 inhale, 4 hold, 4 exhale, 4 hold = 16 seconds per cycle
    const PHASE_DURATION = 4; // 4 seconds
    const CYCLE_DURATION = PHASE_DURATION * 4;
    
    breathIntervalRef.current = setInterval(() => {
      setBreathTimer(prev => prev + 0.1);
    }, 100);

    return () => {
      if (breathIntervalRef.current) {
        clearInterval(breathIntervalRef.current);
        breathIntervalRef.current = null;
      }
    };
  }, [currentStage.id, breathCompleted]);

  // Update phase based on timer
  useEffect(() => {
    if (currentStage.id !== 'breathe' || breathCompleted) return;
    
    const PHASE_DURATION = 4;
    const CYCLE_DURATION = PHASE_DURATION * 4;
    const cycleElapsed = breathTimer % CYCLE_DURATION;
    const currentCycle = Math.floor(breathTimer / CYCLE_DURATION);
    
    if (currentCycle >= TARGET_CYCLES && !autoAdvancedRef.current) {
      autoAdvancedRef.current = true;
      setBreathCompleted(true);
      setBreathPhase('idle');
      return;
    }
    
    setCycleCount(currentCycle);
    
    if (cycleElapsed < PHASE_DURATION) {
      setBreathPhase('inhale');
    } else if (cycleElapsed < PHASE_DURATION * 2) {
      setBreathPhase('hold');
    } else if (cycleElapsed < PHASE_DURATION * 3) {
      setBreathPhase('exhale');
    } else {
      setBreathPhase('hold-empty');
    }
  }, [breathTimer, currentStage.id, breathCompleted]);

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

  // ── Body exercise countdown timer ─────────────────────────────────────
  useEffect(() => {
    if (currentStage.id !== 'body' || !bodyRunning || bodyTimer <= 0) return;
    const t = setInterval(() => {
      setBodyTimer(prev => {
        if (prev <= 1) {
          clearInterval(t);
          // Sub-step finished — advance to next sub-step or next exercise
          const ex = BODY_EXERCISES[bodyExIndex];
          const nextSub = bodySubStep + 1;
          if (nextSub < ex.subSteps.length) {
            setBodySubStep(nextSub);
            return ex.subSteps[nextSub].duration;
          }
          // Exercise done — advance
          const nextEx = bodyExIndex + 1;
          if (nextEx < BODY_EXERCISES.length) {
            setBodyExIndex(nextEx);
            setBodySubStep(0);
            return BODY_EXERCISES[nextEx].subSteps[0].duration;
          }
          // All done
          setBodyRunning(false);
          if (!bodyAutoRef.current) {
            bodyAutoRef.current = true;
            setBodyCompleted(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [currentStage.id, bodyRunning, bodyTimer, bodyExIndex, bodySubStep]);

  // Reset body state when entering body stage
  useEffect(() => {
    if (currentStage.id === 'body') {
      setBodyExIndex(0);
      setBodySubStep(0);
      setBodyTimer(0);
      setBodyRunning(false);
      setBodyCompleted(false);
      setShowReward(false);
      bodyAutoRef.current = false;
    }
  }, [currentStage.id]);

  // Award drachmas and show reward when body stage completed
  useEffect(() => {
    if (!bodyCompleted) return;
    const t = setTimeout(() => {
      addDrachmas(DRACHMA_REWARD);
      setShowReward(true);
    }, 600);
    return () => clearTimeout(t);
  }, [bodyCompleted]);

  // Auto-finish warm-up after reward shown
  useEffect(() => {
    if (!showReward) return;
    const t = setTimeout(() => {
      onComplete();
    }, 2500);
    return () => clearTimeout(t);
  }, [showReward, onComplete]);

  const startBodyExercise = useCallback(() => {
    const first = BODY_EXERCISES[0].subSteps[0];
    setBodyTimer(first.duration);
    setBodySubStep(0);
    setBodyExIndex(0);
    setBodyRunning(true);
  }, []);

  /** Total elapsed time across body exercises (for overall progress bar) */
  const bodyElapsed = (() => {
    let elapsed = 0;
    for (let i = 0; i < bodyExIndex; i++) elapsed += BODY_EXERCISES[i].totalDuration;
    if (bodyRunning && BODY_EXERCISES[bodyExIndex]) {
      const ex = BODY_EXERCISES[bodyExIndex];
      for (let s = 0; s < bodySubStep; s++) elapsed += ex.subSteps[s].duration;
      if (ex.subSteps[bodySubStep]) {
        elapsed += ex.subSteps[bodySubStep].duration - bodyTimer;
      }
    }
    return elapsed;
  })();

  // Does the current body exercise need the camera?
  const bodyNeedsCamera = bodyRunning && BODY_EXERCISES[bodyExIndex]?.showCamera;

  // Camera Logic for BODY stage (activates for power-pose sub-exercise)
  useEffect(() => {
    let localStream: MediaStream | null = null;
    let mounted = true;

    if (currentStage.id === 'body' && bodyNeedsCamera) {
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
      // Not needed — ensure stream is stopped
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
  }, [currentStage.id, bodyNeedsCamera]);

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

                    {/* Pulsing circle synced to phase */}
                    <div className="relative flex items-center justify-center mb-10">
                      {/* Main breath circle */}
                      <motion.div
                        className="w-48 h-48 rounded-full border-4 flex items-center justify-center bg-stone-50"
                        animate={{
                          scale: circleAnim.scale,
                          opacity: circleAnim.opacity,
                          borderColor: circleAnim.borderColor,
                        }}
                        transition={{ duration: circleTrans.duration, ease: circleTrans.ease }}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <PhaseIcon phase={breathPhase} />
                          <span className="text-lg font-light tracking-wide text-stone-900">
                            {getBreathPhaseMessage(breathPhase)}
                          </span>
                        </div>
                      </motion.div>
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
                              ? 'bg-stone-900'
                              : i === cycleCount && breathPhase !== 'idle'
                                ? 'bg-stone-500 animate-pulse'
                                : 'bg-stone-200'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Completed badge */}
                    {breathCompleted && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-4 px-4 py-1.5 bg-stone-100 text-stone-900 border border-stone-300 rounded-full text-xs font-medium"
                      >
                        Breathing complete
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
                 <motion.div
                   key="body"
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   className="flex flex-col items-center w-full"
                 >
                    <h2 className="text-4xl font-serif font-light mb-1">Body</h2>
                    <p className="text-stone-500 font-serif italic mb-6">Release tension, stand strong</p>

                    {/* Overall progress bar */}
                    <div className="w-full max-w-xs mb-8">
                      <div className="flex items-center justify-between text-[10px] text-stone-400 uppercase tracking-widest mb-1.5">
                        {BODY_EXERCISES.map((ex, i) => (
                          <span
                            key={ex.id}
                            className={`${
                              i < bodyExIndex ? 'text-emerald-600' : i === bodyExIndex && bodyRunning ? 'text-stone-900 font-medium' : ''
                            }`}
                          >
                            {ex.title}
                          </span>
                        ))}
                      </div>
                      <div className="h-1 bg-stone-200 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-stone-900 rounded-full"
                          animate={{ width: `${(bodyElapsed / TOTAL_BODY_DURATION) * 100}%` }}
                          transition={{ duration: 0.4 }}
                        />
                      </div>
                    </div>

                    {/* Reward / completion overlay */}
                    {showReward ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center py-8"
                      >
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.15 }}
                          className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mb-4"
                        >
                          <Sparkles className="w-10 h-10 text-emerald-600" />
                        </motion.div>
                        <h3 className="text-2xl font-serif font-light mb-2">Warm-up Complete!</h3>
                        <div className="flex items-center gap-1.5 text-amber-600">
                          <Coins className="w-4 h-4" />
                          <span className="text-sm font-medium">+{DRACHMA_REWARD} drachmas earned</span>
                        </div>
                      </motion.div>
                    ) : bodyCompleted ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center py-8"
                      >
                        <div className="w-16 h-16 rounded-full border-2 border-emerald-300 flex items-center justify-center mb-3 animate-pulse">
                          <Footprints className="w-8 h-8 text-emerald-600" />
                        </div>
                        <p className="text-lg font-serif text-stone-700">You are ready.</p>
                      </motion.div>
                    ) : (
                      /* Exercise content */
                      <AnimatePresence mode="wait">
                        {(() => {
                          const ex = BODY_EXERCISES[bodyExIndex];
                          if (!ex) return null;
                          const step = ex.subSteps[bodySubStep];

                          return (
                            <motion.div
                              key={`${ex.id}-${bodySubStep}`}
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

                              {/* Camera feed for power pose */}
                              {ex.showCamera && bodyRunning && stream && (
                                <div className="relative w-full max-w-xs aspect-[3/4] bg-black rounded-lg overflow-hidden mb-5">
                                  <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover transform -scale-x-100"
                                  />
                                  {/* Silhouette overlay hint */}
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="w-24 h-32 border-2 border-dashed border-white/20 rounded-xl" />
                                  </div>
                                </div>
                              )}

                              {/* Power-pose silhouette icon when camera not available */}
                              {ex.showCamera && bodyRunning && !stream && (
                                <div className="w-32 h-40 rounded-xl bg-stone-100 flex items-center justify-center mb-5">
                                  <Crown className="w-12 h-12 text-stone-300" />
                                </div>
                              )}

                              {/* Instruction text */}
                              {step && (
                                <p className="text-lg text-stone-800 font-serif mb-6 max-w-sm leading-relaxed text-center">
                                  {step.instruction}
                                </p>
                              )}

                              {/* Grounding calm animation */}
                              {ex.id === 'grounding' && bodyRunning && (
                                <motion.div
                                  className="w-24 h-24 rounded-full border-2 border-stone-200 mb-4"
                                  animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
                                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                                />
                              )}

                              {/* Sub-step pips (for tension release) */}
                              {ex.subSteps.length > 1 && bodyRunning && (
                                <div className="flex gap-2 mb-4">
                                  {ex.subSteps.map((_, i) => (
                                    <div
                                      key={i}
                                      className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                                        i < bodySubStep
                                          ? 'bg-emerald-500'
                                          : i === bodySubStep
                                            ? 'bg-stone-900 animate-pulse'
                                            : 'bg-stone-200'
                                      }`}
                                    />
                                  ))}
                                </div>
                              )}

                              {/* Timer */}
                              {bodyRunning && (
                                <div className="flex flex-col items-center mb-4">
                                  <span className="text-3xl font-light tabular-nums text-stone-900">
                                    {String(Math.floor(bodyTimer / 60)).padStart(1, '0')}:{String(bodyTimer % 60).padStart(2, '0')}
                                  </span>
                                  <div className="w-40 h-0.5 bg-stone-200 rounded-full mt-2 overflow-hidden">
                                    <motion.div
                                      className="h-full bg-stone-600 rounded-full"
                                      animate={{ width: step ? `${((step.duration - bodyTimer) / step.duration) * 100}%` : '0%' }}
                                      transition={{ duration: 0.8 }}
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Start button */}
                              {!bodyRunning && !bodyCompleted && (
                                <button
                                  onClick={startBodyExercise}
                                  className="px-5 py-2 bg-stone-900 text-stone-50 rounded-full text-sm uppercase tracking-widest hover:bg-stone-800 transition-colors"
                                >
                                  Start
                                </button>
                              )}
                            </motion.div>
                          );
                        })()}
                      </AnimatePresence>
                    )}
                 </motion.div>
             )}
         </AnimatePresence>
      </div>

      <div className="w-full max-w-md z-20 flex flex-col items-center gap-4">
          {!bodyCompleted && (
            <p className="text-xs text-stone-400 uppercase tracking-widest animate-pulse">Rhetor is guiding you...</p>
          )}
          {!bodyCompleted && (
            <button onClick={handleNext} className="text-stone-900 border-b border-stone-900 pb-1 text-sm uppercase tracking-widest">
                {stageIndex < STAGES.length - 1 ? 'Next Stage →' : 'Finish →'}
            </button>
          )}
      </div>
    </FadeTransition>
  );
};
