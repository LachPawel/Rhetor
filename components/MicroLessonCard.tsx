/**
 * Duolingo-style Micro-Lesson Card Component
 * Focused, gamified learning with progress tracking
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, Star, Trophy, Zap, ChevronRight, Volume2, Mic } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export type TaskType = 
  | 'listen'      // Listen to example
  | 'repeat'      // Repeat after AI
  | 'respond'     // Free response to prompt
  | 'choose'      // Multiple choice
  | 'record'      // Record yourself
  | 'breathe';    // Breathing exercise

export interface MicroTask {
  id: string;
  type: TaskType;
  instruction: string;
  content?: string;        // Main content to display
  options?: string[];      // For 'choose' type
  correctIndex?: number;   // For 'choose' type
  duration?: number;       // For timed tasks
  hint?: string;
}

export interface MicroLesson {
  id: string;
  title: string;
  description: string;
  pillar: 'ethos' | 'pathos' | 'logos';
  tasks: MicroTask[];
  xpReward: number;
}

export interface LessonProgress {
  currentTask: number;
  completed: boolean[];
  score: number;
  startTime: number;
}

// ============================================================================
// LESSON CARD COMPONENT
// ============================================================================

interface LessonCardProps {
  lesson: MicroLesson;
  onComplete: (score: number, xp: number) => void;
  onTaskComplete?: (taskIndex: number, correct: boolean) => void;
  aiAudio?: () => void; // Callback to play AI audio for listen tasks
}

export const LessonCard: React.FC<LessonCardProps> = ({
  lesson,
  onComplete,
  onTaskComplete,
  aiAudio,
}) => {
  const [progress, setProgress] = useState<LessonProgress>({
    currentTask: 0,
    completed: new Array(lesson.tasks.length).fill(false),
    score: 0,
    startTime: Date.now(),
  });
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const currentTask = lesson.tasks[progress.currentTask];
  const progressPercent = (progress.currentTask / lesson.tasks.length) * 100;

  const handleTaskComplete = (correct: boolean = true) => {
    const newCompleted = [...progress.completed];
    newCompleted[progress.currentTask] = correct;

    const newScore = correct 
      ? progress.score + Math.round(100 / lesson.tasks.length)
      : progress.score;

    setShowFeedback(correct ? 'correct' : 'incorrect');
    onTaskComplete?.(progress.currentTask, correct);

    setTimeout(() => {
      setShowFeedback(null);
      setSelectedOption(null);

      if (progress.currentTask < lesson.tasks.length - 1) {
        setProgress({
          ...progress,
          currentTask: progress.currentTask + 1,
          completed: newCompleted,
          score: newScore,
        });
      } else {
        // Lesson complete!
        const finalScore = Math.min(100, newScore);
        const bonusXp = finalScore >= 80 ? Math.round(lesson.xpReward * 0.2) : 0;
        onComplete(finalScore, lesson.xpReward + bonusXp);
      }
    }, 1000);
  };

  const handleOptionSelect = (index: number) => {
    setSelectedOption(index);
    const correct = index === currentTask.correctIndex;
    setTimeout(() => handleTaskComplete(correct), 500);
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-stone-500 uppercase tracking-wider">
            {lesson.title}
          </span>
          <span className="text-xs text-stone-500">
            {progress.currentTask + 1} / {lesson.tasks.length}
          </span>
        </div>
        <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-emerald-500"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Task Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentTask.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-white rounded-2xl shadow-lg border border-stone-100 overflow-hidden"
        >
          {/* Task Header */}
          <div className="px-6 py-4 border-b border-stone-100">
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <TaskIcon type={currentTask.type} />
              <span className="capitalize">{currentTask.type}</span>
            </div>
          </div>

          {/* Task Content */}
          <div className="p-6">
            <p className="text-lg text-stone-900 mb-6 font-medium">
              {currentTask.instruction}
            </p>

            {currentTask.content && (
              <div className="bg-stone-50 rounded-xl p-4 mb-6 border border-stone-100">
                <p className="text-stone-700 italic serif text-lg leading-relaxed">
                  "{currentTask.content}"
                </p>
              </div>
            )}

            {/* Task-specific UI */}
            {currentTask.type === 'choose' && currentTask.options && (
              <div className="space-y-3">
                {currentTask.options.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => handleOptionSelect(i)}
                    disabled={selectedOption !== null}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      selectedOption === i
                        ? i === currentTask.correctIndex
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-red-500 bg-red-50'
                        : selectedOption !== null && i === currentTask.correctIndex
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    <span className="text-stone-700">{option}</span>
                  </button>
                ))}
              </div>
            )}

            {currentTask.type === 'listen' && (
              <button
                onClick={aiAudio}
                className="flex items-center gap-3 px-6 py-3 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors mx-auto"
              >
                <Volume2 className="w-5 h-5" />
                <span>Listen to Example</span>
              </button>
            )}

            {(currentTask.type === 'repeat' || currentTask.type === 'respond' || currentTask.type === 'record') && (
              <div className="text-center">
                <button
                  onClick={() => setIsRecording(!isRecording)}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                    isRecording
                      ? 'bg-red-500 animate-pulse'
                      : 'bg-stone-900 hover:bg-stone-800'
                  }`}
                >
                  <div className={`w-6 h-6 ${isRecording ? 'bg-white rounded-sm' : 'bg-red-500 rounded-full'}`} />
                </button>
                <p className="text-sm text-stone-500 mt-3">
                  {isRecording ? 'Tap to stop' : 'Tap to speak'}
                </p>
              </div>
            )}

            {currentTask.type === 'breathe' && (
              <BreathingVisual duration={currentTask.duration || 16} onComplete={() => handleTaskComplete(true)} />
            )}

            {currentTask.hint && (
              <p className="text-sm text-stone-400 mt-4 text-center">
                💡 {currentTask.hint}
              </p>
            )}
          </div>

          {/* Continue Button for non-interactive tasks */}
          {(currentTask.type === 'listen' || currentTask.type === 'repeat' || currentTask.type === 'respond') && (
            <div className="px-6 pb-6">
              <button
                onClick={() => handleTaskComplete(true)}
                className="w-full py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
              >
                <span>Continue</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Feedback Overlay */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          >
            <div className={`px-8 py-4 rounded-2xl ${
              showFeedback === 'correct' ? 'bg-emerald-500' : 'bg-red-500'
            } text-white text-xl font-bold shadow-xl`}>
              {showFeedback === 'correct' ? '✓ Correct!' : '✗ Try again'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// TASK ICON COMPONENT
// ============================================================================

const TaskIcon: React.FC<{ type: TaskType }> = ({ type }) => {
  const iconClass = "w-4 h-4";
  switch (type) {
    case 'listen': return <Volume2 className={iconClass} />;
    case 'repeat': return <Circle className={iconClass} />;
    case 'respond': return <Circle className={iconClass} />;
    case 'choose': return <Circle className={iconClass} />;
    case 'record': return <Mic className={iconClass} />;
    case 'breathe': return <Circle className={iconClass} />;
    default: return <Circle className={iconClass} />;
  }
};

// ============================================================================
// BREATHING VISUAL COMPONENT
// ============================================================================

interface BreathingVisualProps {
  duration: number; // Total duration in seconds
  onComplete: () => void;
}

const BreathingVisual: React.FC<BreathingVisualProps> = ({ duration, onComplete }) => {
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [count, setCount] = useState(4);
  const [cycles, setCycles] = useState(0);
  const targetCycles = Math.floor(duration / 12); // 4+4+4 = 12 seconds per cycle

  useEffect(() => {
    const interval = setInterval(() => {
      setCount(prev => {
        if (prev > 1) return prev - 1;
        
        // Phase transition
        setPhase(currentPhase => {
          if (currentPhase === 'inhale') return 'hold';
          if (currentPhase === 'hold') return 'exhale';
          
          // Exhale complete - check cycles
          setCycles(c => {
            const newCycles = c + 1;
            if (newCycles >= targetCycles) {
              clearInterval(interval);
              setTimeout(onComplete, 500);
            }
            return newCycles;
          });
          return 'inhale';
        });
        
        return 4;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [targetCycles, onComplete]);

  const phaseText = {
    inhale: 'Breathe In',
    hold: 'Hold',
    exhale: 'Breathe Out',
  };

  return (
    <div className="flex flex-col items-center">
      <motion.div
        animate={{
          scale: phase === 'inhale' ? 1.3 : phase === 'hold' ? 1.3 : 1,
        }}
        transition={{ duration: 1 }}
        className="w-32 h-32 rounded-full border-4 border-emerald-500 flex items-center justify-center mb-4"
      >
        <span className="text-4xl font-light text-emerald-600">{count}</span>
      </motion.div>
      <p className="text-lg text-stone-700 font-medium">{phaseText[phase]}</p>
      <p className="text-sm text-stone-400 mt-2">
        Cycle {cycles + 1} of {targetCycles}
      </p>
    </div>
  );
};

// ============================================================================
// LESSON COMPLETE CELEBRATION
// ============================================================================

interface LessonCompleteProps {
  score: number;
  xpEarned: number;
  lessonTitle: string;
  onContinue: () => void;
}

export const LessonComplete: React.FC<LessonCompleteProps> = ({
  score,
  xpEarned,
  lessonTitle,
  onContinue,
}) => {
  const isPerfect = score >= 100;
  const isGreat = score >= 80;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-lg mx-auto text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring' }}
        className="mb-6"
      >
        {isPerfect ? (
          <Trophy className="w-20 h-20 text-amber-500 mx-auto" />
        ) : isGreat ? (
          <Star className="w-20 h-20 text-emerald-500 mx-auto" />
        ) : (
          <CheckCircle2 className="w-20 h-20 text-stone-400 mx-auto" />
        )}
      </motion.div>

      <h2 className="text-3xl font-bold text-stone-900 mb-2">
        {isPerfect ? 'Perfect!' : isGreat ? 'Great Job!' : 'Lesson Complete'}
      </h2>
      <p className="text-stone-500 mb-8">{lessonTitle}</p>

      <div className="flex justify-center gap-8 mb-8">
        <div className="text-center">
          <div className="text-3xl font-bold text-emerald-500">{score}%</div>
          <div className="text-sm text-stone-500">Score</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-amber-500 flex items-center gap-1">
            <Zap className="w-6 h-6" />
            {xpEarned}
          </div>
          <div className="text-sm text-stone-500">XP Earned</div>
        </div>
      </div>

      <button
        onClick={onContinue}
        className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold text-lg hover:bg-emerald-600 transition-colors"
      >
        Continue
      </button>
    </motion.div>
  );
};

// ============================================================================
// SAMPLE MICRO-LESSONS
// ============================================================================

export const SAMPLE_LESSONS: MicroLesson[] = [
  {
    id: 'hook-basics',
    title: 'The Hook',
    description: 'Learn to capture attention in your first sentence',
    pillar: 'ethos',
    xpReward: 50,
    tasks: [
      {
        id: 'hook-1',
        type: 'listen',
        instruction: 'Listen to this powerful hook:',
        content: 'In the next 60 seconds, I\'ll show you how to double your confidence.',
      },
      {
        id: 'hook-2',
        type: 'choose',
        instruction: 'What makes a hook effective?',
        options: [
          'Being as long as possible',
          'Creating curiosity or urgency',
          'Using complex vocabulary',
          'Starting with "Hello everyone"',
        ],
        correctIndex: 1,
      },
      {
        id: 'hook-3',
        type: 'respond',
        instruction: 'Create your own hook for this topic: "Why you should learn public speaking"',
        hint: 'Try starting with a surprising fact or bold promise',
      },
    ],
  },
  {
    id: 'breath-control',
    title: 'Breath Control',
    description: 'Master the foundation of vocal power',
    pillar: 'pathos',
    xpReward: 40,
    tasks: [
      {
        id: 'breath-1',
        type: 'listen',
        instruction: 'Breathing is the foundation of your voice. Let\'s practice box breathing.',
      },
      {
        id: 'breath-2',
        type: 'breathe',
        instruction: 'Follow the rhythm: 4 seconds in, 4 seconds hold, 4 seconds out.',
        duration: 24, // 2 cycles
      },
      {
        id: 'breath-3',
        type: 'choose',
        instruction: 'When should you take a breath while speaking?',
        options: [
          'Never - keep talking continuously',
          'At natural pauses and punctuation',
          'Only when you run out of air',
          'Every three words',
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    id: 'filler-words',
    title: 'Banish Fillers',
    description: 'Eliminate um, uh, and like from your speech',
    pillar: 'logos',
    xpReward: 60,
    tasks: [
      {
        id: 'filler-1',
        type: 'choose',
        instruction: 'Which of these is a filler word?',
        options: ['Therefore', 'Um', 'However', 'Because'],
        correctIndex: 1,
      },
      {
        id: 'filler-2',
        type: 'listen',
        instruction: 'The secret: Replace fillers with silence. A pause is powerful.',
        content: 'Instead of "I, um, think we should..." say "I think... we should..."',
      },
      {
        id: 'filler-3',
        type: 'record',
        instruction: 'Say this sentence WITHOUT any filler words: "I believe that public speaking is an essential skill."',
        hint: 'Take a breath before you start. Embrace the pause.',
      },
    ],
  },
];
