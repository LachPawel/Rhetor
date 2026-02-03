
import React, { useEffect } from 'react';
import { FadeTransition } from './FadeTransition.tsx';
import { ArrowLeft, Mic } from 'lucide-react';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { AgentMode } from '../types.ts';

interface ViewPrepProps {
  onBegin: (talkingPoints?: string[]) => void;
  onBack: () => void;
}

export const ViewPrep: React.FC<ViewPrepProps> = ({ onBegin, onBack }) => {
  const { setMode, isConnected, talkingPoints, aiResponse, isSpeaking } = useRhetor();

  useEffect(() => {
    if (isConnected) {
        setMode(AgentMode.INTERVIEWER);
    }
  }, [isConnected]);

  // If the AI tool has saved the talking points, we are ready
  useEffect(() => {
      if (talkingPoints.length > 0) {
          // Add a small delay so user sees the result before jumping
          const timeout = setTimeout(() => {
              onBegin(talkingPoints);
          }, 3000);
          return () => clearTimeout(timeout);
      }
  }, [talkingPoints]);

  return (
    <FadeTransition className="flex flex-col items-center min-h-screen p-6 relative bg-stone-50 text-stone-900">
      <button onClick={onBack} className="absolute top-6 left-6 text-stone-400 hover:text-stone-900 transition-colors z-20">
          <ArrowLeft className="w-6 h-6" />
      </button>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl text-center">
          <div className="mb-8">
              <h2 className="text-4xl serif font-light text-stone-900 mb-2">Pitch Builder</h2>
              <p className="text-stone-500 text-sm tracking-widest uppercase">AI Interview Mode</p>
          </div>

          <div className="min-h-[200px] flex items-center justify-center p-8 bg-white border border-stone-100 shadow-sm rounded-sm mb-8 w-full">
              <p className="text-2xl serif text-stone-700 leading-relaxed italic">
                  "{aiResponse || "I'm ready. Let's build your pitch. What topic are we covering today?"}"
              </p>
          </div>

          <div className="flex flex-col items-center gap-4">
               {isSpeaking ? (
                   <div className="flex gap-2 items-center text-emerald-600">
                       <Mic className="w-5 h-5 animate-pulse" />
                       <span className="text-xs uppercase tracking-widest">Listening...</span>
                   </div>
               ) : (
                   <div className="text-xs text-stone-400 uppercase tracking-widest">Rhetor is waiting for your answer</div>
               )}
          </div>
      </div>
      
      {/* Visual Indicator of Progress if we had access to the internal thought process, but for now just a manual skip */}
      <button onClick={() => onBegin()} className="mb-8 text-xs text-stone-300 hover:text-stone-500 uppercase tracking-widest">
          Skip Interview
      </button>

    </FadeTransition>
  );
};
