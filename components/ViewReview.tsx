
import React, { useEffect, useRef } from 'react';
import { FadeTransition } from './FadeTransition.tsx';
import { SessionResult, AgentMode } from '../types.ts';
import { Share2 } from 'lucide-react';
import { useRhetor } from '../contexts/RhetorContext.tsx';

interface ViewReviewProps {
  result: SessionResult | null;
  onReset: () => void;
}

export const ViewReview: React.FC<ViewReviewProps> = ({ result, onReset }) => {
  const { setMode, isConnected, aiResponse } = useRhetor();

  // Set mode once when connected
  const modeSetRef = useRef(false);
  useEffect(() => {
    if (isConnected && result && !modeSetRef.current) {
        modeSetRef.current = true;
        setMode(AgentMode.ANALYST, { 
            duration: result.durationSeconds, 
            wpm: result.wpm 
        });
    }
  }, [isConnected, result, setMode]);

  if (!result) return null;

  return (
    <FadeTransition className="flex flex-col items-center min-h-screen p-6 max-w-2xl mx-auto w-full bg-stone-50 text-stone-900">
      
      <div className="mt-12 mb-8 text-center">
        <div className="text-stone-400 text-xs tracking-widest uppercase mb-4">Coach Debrief</div>
        <div className="min-h-[150px] flex items-center justify-center">
             <p className="text-2xl serif italic text-stone-800 leading-relaxed">
                 "{aiResponse || "Analyzing your session..."}"
             </p>
        </div>
      </div>

      <div className="flex gap-8 mb-8 mt-12">
        <button onClick={onReset} className="text-stone-900 hover:text-stone-600 tracking-widest uppercase text-xs border-b border-stone-300 hover:border-stone-900 pb-1 transition-all">
            Practice Again
        </button>
        <button className="text-stone-900 hover:text-stone-600 tracking-widest uppercase text-xs border-b border-stone-300 hover:border-stone-900 pb-1 transition-all flex items-center gap-2">
            <Share2 className="w-3 h-3" /> Share
        </button>
      </div>

    </FadeTransition>
  );
};
