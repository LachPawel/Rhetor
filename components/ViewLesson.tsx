
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FadeTransition } from './FadeTransition.tsx';
import { Lesson as LegacyLesson, AgentMode } from '../types.ts';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { X, Mic, Wind, Ear, ChevronRight, CheckCircle2, Coins, ArrowRight, RotateCcw } from 'lucide-react';
import { getLessonById, lessons, type Lesson as AcademyLesson, type LessonStep } from '../src/data/lessons.ts';

// ─── Props ───────────────────────────────────────────────────────────
interface ViewLessonProps {
  lesson: LegacyLesson;
  onExit: () => void;
  onNextLesson?: (lesson: LegacyLesson) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────
const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
};

const CATEGORY_COLORS: Record<string, { accent: string; accentBg: string; ring: string }> = {
  breathing: { accent: 'text-blue-400', accentBg: 'bg-blue-500', ring: 'shadow-[0_0_40px_rgba(59,130,246,0.4)]' },
  voice:     { accent: 'text-purple-400', accentBg: 'bg-purple-500', ring: 'shadow-[0_0_40px_rgba(168,85,247,0.4)]' },
  technique: { accent: 'text-amber-400', accentBg: 'bg-amber-500', ring: 'shadow-[0_0_40px_rgba(245,158,11,0.4)]' },
};

/** Find the next lesson in the lessons array after the current one */
const findNextLesson = (currentId: string): AcademyLesson | null => {
  const idx = lessons.findIndex(l => l.id === currentId);
  return idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : null;
};

/** Bridge academy lesson → legacy type */
const toLegacy = (l: AcademyLesson): LegacyLesson => ({
  id: l.id,
  pillarId: l.pillar,
  title: l.title,
  description: l.description,
  type: 'LESSON',
  reward: l.drachmas,
  durationMinutes: Math.ceil(l.duration / 60),
});

// ─── Step Type Icons ─────────────────────────────────────────────────
const StepIcon: React.FC<{ step: LessonStep; isSpeaking: boolean; className?: string }> = ({ step, isSpeaking, className = 'w-8 h-8' }) => {
  if (step.expectedAction === 'breathe') return <Wind className={`${className} text-blue-400`} />;
  if (step.expectedAction === 'listen' || step.type === 'explain' || step.type === 'demonstrate')
    return <Ear className={`${className} text-stone-400`} />;
  return <Mic className={`${className} text-white`} />;
};

// ═════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════
export const ViewLesson: React.FC<ViewLessonProps> = ({ lesson, onExit, onNextLesson }) => {
  const { setMode, isConnected, connect, isSpeaking, aiResponse, user, addDrachmas, completeLesson: markComplete } = useRhetor();

  // Look up the full academy lesson by ID
  const academyLesson = getLessonById(lesson.id);
  const steps = academyLesson?.steps ?? [];
  const totalSteps = steps.length;
  const colors = CATEGORY_COLORS[academyLesson?.category ?? 'technique'];

  // ── State ────────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(0);
  const [phase, setPhase] = useState<'intro' | 'step' | 'complete'>('intro');
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [drachmaAnimating, setDrachmaAnimating] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modeSetRef = useRef(false);
  const stepPromptSentRef = useRef(-1);

  const step = steps[currentStep] as LessonStep | undefined;

  // ── Connect to Gemini ────────────────────────────────────────────
  useEffect(() => {
    const init = async () => { if (!isConnected) await connect(); };
    init();
  }, [isConnected, connect]);

  // Set AI mode once when connected
  useEffect(() => {
    if (isConnected && !modeSetRef.current) {
      modeSetRef.current = true;
      setMode(AgentMode.COACH_LESSON, {
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        lessonDesc: lesson.description,
      });
    }
  }, [isConnected, lesson, setMode]);

  // ── Send step prompt to AI whenever step changes ─────────────────
  useEffect(() => {
    if (phase !== 'step' || !step || !isConnected) return;
    if (stepPromptSentRef.current === currentStep) return;
    stepPromptSentRef.current = currentStep;

    // Build context for this specific step
    setMode(AgentMode.COACH_LESSON, {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      lessonDesc: lesson.description,
      step: {
        index: currentStep,
        total: totalSteps,
        type: step.type,
        aiPrompt: step.aiPrompt,
        expectedAction: step.expectedAction,
        duration: step.duration,
      },
    });
  }, [phase, currentStep, step, isConnected, lesson, setMode, totalSteps]);

  // ── Timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (timerActive && step) {
      setTimer(step.duration);
      timerRef.current = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            setTimerActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive, step]);

  // Auto-start timer for practice/demonstrate steps
  useEffect(() => {
    if (phase !== 'step' || !step) return;
    if (step.type === 'practice' || step.type === 'demonstrate') {
      setTimerActive(true);
    }
  }, [phase, currentStep, step]);

  // ── Navigation ───────────────────────────────────────────────────
  const goToNextStep = useCallback(() => {
    setTimerActive(false);
    setQuizAnswer(null);
    setQuizSubmitted(false);

    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // All steps done — mark complete
      if (academyLesson) {
        markComplete(lesson.id);
        addDrachmas(academyLesson.drachmas);
      }
      setDrachmaAnimating(true);
      setPhase('complete');
    }
  }, [currentStep, totalSteps, academyLesson, lesson.id, markComplete, addDrachmas]);

  const startLesson = useCallback(() => {
    setCurrentStep(0);
    setPhase('step');
  }, []);

  const handleQuizSubmit = useCallback((idx: number) => {
    setQuizAnswer(idx);
    setQuizSubmitted(true);
    // Auto-advance after brief delay
    setTimeout(() => goToNextStep(), 2000);
  }, [goToNextStep]);

  // Determine if "Next" button should auto-appear when timer runs out
  const timerDone = timerActive === false && timer === 0 && phase === 'step' && step &&
    (step.type === 'practice' || step.type === 'demonstrate');

  // ── No academy data fallback ─────────────────────────────────────
  if (!academyLesson || totalSteps === 0) {
    return (
      <FadeTransition className="fixed inset-0 bg-stone-900 text-white z-50 flex flex-col items-center justify-center p-6">
        <button onClick={onExit} className="absolute top-6 right-6 text-stone-500 hover:text-white transition-colors z-20">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-3xl serif font-light mb-4">{lesson.title}</h2>
        <p className="text-stone-400 mb-8">Lesson data not found.</p>
        <button onClick={onExit} className="px-6 py-3 bg-white/10 rounded-lg text-sm uppercase tracking-widest hover:bg-white/20 transition-colors">
          Back to Academy
        </button>
      </FadeTransition>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // INTRO SCREEN
  // ═══════════════════════════════════════════════════════════════════
  if (phase === 'intro') {
    return (
      <FadeTransition className="fixed inset-0 bg-stone-900 text-white z-50 flex flex-col">
        <button onClick={onExit} className="absolute top-6 right-6 text-stone-500 hover:text-white transition-colors z-20">
          <X className="w-6 h-6" />
        </button>

        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 max-w-lg mx-auto w-full">
          {/* Category pill */}
          <span className={`text-[10px] uppercase tracking-widest px-3 py-1 rounded-full mb-6 ${colors.accentBg} text-white`}>
            {academyLesson.category}
          </span>

          <h2 className="text-4xl serif font-light mb-3">{academyLesson.title}</h2>
          <p className="text-stone-400 text-sm leading-relaxed mb-8 max-w-sm">{academyLesson.description}</p>

          {/* Meta */}
          <div className="flex items-center gap-6 mb-12 text-sm text-stone-500">
            <span>{totalSteps} steps</span>
            <span>•</span>
            <span>{fmtTime(academyLesson.duration)}</span>
            <span>•</span>
            <span className="text-amber-400 font-medium">{academyLesson.drachmas}Δ</span>
          </div>

          {/* Start button */}
          <button
            onClick={startLesson}
            className={`px-10 py-4 rounded-full text-white font-medium text-sm uppercase tracking-widest transition-all active:scale-95 ${colors.accentBg} hover:opacity-90`}
          >
            Begin Lesson
          </button>
        </div>
      </FadeTransition>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // COMPLETION SCREEN
  // ═══════════════════════════════════════════════════════════════════
  if (phase === 'complete') {
    const next = findNextLesson(academyLesson.id);

    return (
      <FadeTransition className="fixed inset-0 bg-stone-900 text-white z-50 flex flex-col items-center justify-center p-6">
        {/* Drachma animation */}
        <div className={`mb-8 transition-all duration-700 ${drachmaAnimating ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
          <div className="w-24 h-24 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Coins className="w-12 h-12 text-amber-400" />
          </div>
        </div>

        <h2 className="text-3xl serif font-light mb-2">Lesson Complete!</h2>
        <p className="text-stone-400 mb-6">{academyLesson.title}</p>

        <div className="flex items-center gap-2 text-amber-400 text-xl font-mono font-bold mb-10">
          <Coins className="w-5 h-5" />
          +{academyLesson.drachmas}Δ
        </div>

        <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-10" />

        <div className="flex flex-col gap-3 w-full max-w-xs">
          {next && onNextLesson ? (
            <button
              onClick={() => onNextLesson(toLegacy(next))}
              className={`w-full py-4 rounded-xl font-medium text-sm uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${colors.accentBg} text-white hover:opacity-90`}
            >
              Next: {next.title}
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : null}

          <button
            onClick={onExit}
            className="w-full py-4 rounded-xl border border-stone-700 text-stone-300 font-medium text-sm uppercase tracking-widest hover:bg-stone-800 transition-all"
          >
            Back to Academy
          </button>
        </div>
      </FadeTransition>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP VIEW
  // ═══════════════════════════════════════════════════════════════════
  if (!step) return null;

  const isQuiz = step.type === 'quiz';
  const isPractice = step.type === 'practice';
  const isExplain = step.type === 'explain';
  const isDemo = step.type === 'demonstrate';
  const isListenStep = step.expectedAction === 'listen' || isExplain || isDemo;
  const isBreathe = step.expectedAction === 'breathe';

  return (
    <FadeTransition className="fixed inset-0 bg-stone-900 text-white z-50 flex flex-col">
      {/* ── Top Bar ──────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 flex items-center gap-4">
        <button onClick={onExit} className="text-stone-500 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>

        {/* Progress bar */}
        <div className="flex-1 h-1.5 bg-stone-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${colors.accentBg}`}
            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          />
        </div>

        <span className="text-xs text-stone-500 font-mono whitespace-nowrap">
          {currentStep + 1}/{totalSteps}
        </span>
      </div>

      {/* ── Step Label ───────────────────────────────────────────── */}
      <div className="px-6 mb-2">
        <span className={`text-[10px] uppercase tracking-widest font-bold ${colors.accent}`}>
          {step.type === 'explain' && 'Learn'}
          {step.type === 'demonstrate' && 'Listen'}
          {step.type === 'practice' && (isBreathe ? 'Breathe' : 'Speak')}
          {step.type === 'quiz' && 'Quiz'}
        </span>
      </div>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col px-6 overflow-y-auto">
        {/* Instruction text */}
        <p className="text-lg text-stone-200 leading-relaxed mb-6 font-light">
          {step.instruction}
        </p>

        {/* AI Response area — for explain/demonstrate/practice */}
        {!isQuiz && (
          <div className="flex-1 flex flex-col items-center justify-center text-center min-h-[180px]">
            {/* AI transcript */}
            {aiResponse && (
              <p className="text-base serif italic text-stone-400 leading-relaxed max-w-sm mb-8">
                "{aiResponse}"
              </p>
            )}

            {/* Central orb */}
            <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 ${
              isSpeaking
                ? `${colors.accentBg} scale-110 ${colors.ring}`
                : isPractice || isBreathe
                  ? 'bg-stone-800 border-2 border-stone-700'
                  : 'bg-stone-800'
            }`}>
              <StepIcon step={step} isSpeaking={isSpeaking} />
            </div>

            {/* Status text */}
            <p className="mt-4 text-stone-600 text-xs uppercase tracking-widest">
              {isSpeaking ? 'Zeus is speaking…' :
               isListenStep ? (aiResponse ? '' : 'Connecting to Zeus…') :
               isBreathe ? 'Breathe with the rhythm…' :
               'Listening to you…'}
            </p>
          </div>
        )}

        {/* Quiz options */}
        {isQuiz && step.options && (
          <div className="space-y-3 mt-4">
            {step.options.map((opt, idx) => {
              const isCorrect = idx === step.correctAnswer;
              const isSelected = quizAnswer === idx;
              let optStyle = 'bg-stone-800 border-stone-700 hover:border-stone-500';
              if (quizSubmitted) {
                if (isCorrect) optStyle = 'bg-emerald-900/40 border-emerald-500';
                else if (isSelected && !isCorrect) optStyle = 'bg-red-900/40 border-red-500';
              } else if (isSelected) {
                optStyle = 'bg-stone-700 border-stone-500';
              }

              return (
                <button
                  key={idx}
                  disabled={quizSubmitted}
                  onClick={() => handleQuizSubmit(idx)}
                  className={`w-full text-left px-5 py-4 rounded-xl border transition-all ${optStyle}`}
                >
                  <span className="text-sm text-stone-300 font-mono mr-3">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="text-stone-100">{opt}</span>
                </button>
              );
            })}

            {quizSubmitted && (
              <p className={`text-sm mt-3 font-medium ${quizAnswer === step.correctAnswer ? 'text-emerald-400' : 'text-red-400'}`}>
                {quizAnswer === step.correctAnswer ? '✓ Correct!' : `✗ The answer was ${String.fromCharCode(65 + (step.correctAnswer ?? 0))}`}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom Bar ───────────────────────────────────────────── */}
      <div className="px-6 pb-8 pt-4">
        {/* Timer */}
        {timerActive && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-stone-400 font-mono text-sm">{fmtTime(timer)}</span>
          </div>
        )}

        {/* Next button — visible for explain steps always, and practice/demo when timer done */}
        {!isQuiz && (isExplain || isDemo || timerDone) && (
          <button
            onClick={goToNextStep}
            className={`w-full py-4 rounded-xl font-medium text-sm uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${colors.accentBg} text-white hover:opacity-90`}
          >
            {currentStep < totalSteps - 1 ? 'Continue' : 'Finish'}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* For practice steps with active timer, show a skip option */}
        {isPractice && timerActive && (
          <button
            onClick={goToNextStep}
            className="w-full py-3 text-stone-600 text-xs uppercase tracking-widest hover:text-stone-400 transition-colors"
          >
            Skip →
          </button>
        )}
      </div>
    </FadeTransition>
  );
};
