
import React, { useEffect, useRef } from 'react';
import { FadeTransition } from './FadeTransition.tsx';
import { Lesson, AgentMode } from '../types.ts';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { X, Mic } from 'lucide-react';

interface ViewLessonProps {
  lesson: Lesson;
  onExit: () => void;
}

export const ViewLesson: React.FC<ViewLessonProps> = ({ lesson, onExit }) => {
  const { setMode, isConnected, connect, isSpeaking, aiResponse, user } = useRhetor();

  useEffect(() => {
      const init = async () => {
          if (!isConnected) await connect();
      };
      init();
  }, [isConnected, connect]);

  // Set mode once when connected - use ref to prevent multiple calls
  const modeSetRef = useRef(false);
  useEffect(() => {
      if (isConnected && !modeSetRef.current) {
          modeSetRef.current = true;
          // Critical: Passing lessonId so the AI tool can reference it
          setMode(AgentMode.COACH_LESSON, { 
              lessonId: lesson.id,
              lessonTitle: lesson.title, 
              lessonDesc: lesson.description 
          });
      }
  }, [isConnected, lesson, setMode]);

  // Check if this specific lesson is complete to show visual feedback
  const isComplete = user.completedLessons.includes(lesson.id);

  return (
    <FadeTransition className="fixed inset-0 bg-stone-900 text-white z-50 flex flex-col p-6">
        <button onClick={onExit} className="absolute top-6 right-6 text-stone-500 hover:text-white transition-colors z-20">
            <X className="w-6 h-6" />
        </button>

        <div className="flex-1 flex flex-col items-center justify-center text-center max-w-lg mx-auto w-full relative">
            <div className="mb-4">
                <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${isComplete ? 'bg-emerald-500 text-white' : 'bg-white/10 text-stone-300'}`}>
                    {isComplete ? 'COMPLETED' : `${lesson.type} • +${lesson.reward} Δ`}
                </span>
            </div>
            
            <h2 className="text-4xl serif font-light mb-8">{lesson.title}</h2>
            
            <div className="min-h-[120px] mb-12 flex items-center justify-center">
                <p className="text-xl serif italic text-stone-300 leading-relaxed max-w-md">
                    "{aiResponse || "Connecting to Zeus..."}"
                </p>
            </div>

            <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${isSpeaking ? 'bg-emerald-500 scale-110 shadow-[0_0_40px_rgba(16,185,129,0.4)]' : 'bg-stone-800'}`}>
                {isComplete ? (
                    <span className="text-2xl">✅</span>
                ) : (
                    <Mic className="w-8 h-8 text-white" />
                )}
            </div>
            
            <p className="mt-8 text-stone-500 text-xs uppercase tracking-widest animate-pulse">
                {isSpeaking ? "Zeus is speaking..." : isComplete ? "Lesson Conquered" : "Listening to you..."}
            </p>

            {isComplete && (
                <button 
                    onClick={onExit}
                    className="mt-12 px-8 py-3 bg-white text-stone-900 rounded-sm font-medium tracking-widest uppercase hover:bg-emerald-400 hover:text-white transition-colors"
                >
                    Return to Agora
                </button>
            )}
        </div>
    </FadeTransition>
  );
};
