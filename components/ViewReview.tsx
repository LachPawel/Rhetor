
import React, { useEffect, useRef, useState } from 'react';
import { FadeTransition } from './FadeTransition.tsx';
import { SessionResult, AgentMode } from '../types.ts';
import { Share2, Home, RotateCcw } from 'lucide-react';
import { useRhetor } from '../contexts/RhetorContext.tsx';

interface ViewReviewProps {
  result: SessionResult | null;
  onReset: () => void;
}

export const ViewReview: React.FC<ViewReviewProps> = ({ result, onReset }) => {
  const { setMode, isConnected, isSpeaking, aiResponse } = useRhetor();
  
  // Collect the debrief text only after the analyst finishes speaking
  const [debriefText, setDebriefText] = useState<string | null>(null);
  const analystStartedRef = useRef(false);
  
  // Set analyst mode once when connected
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

  // Track when AI finishes its analyst response to capture the complete debrief
  useEffect(() => {
    // Detect when the analyst starts speaking
    if (isSpeaking && modeSetRef.current) {
      analystStartedRef.current = true;
    }
    // When AI stops speaking after starting, capture the complete response
    if (!isSpeaking && analystStartedRef.current && aiResponse) {
      setDebriefText(aiResponse);
    }
  }, [isSpeaking, aiResponse]);

  if (!result) return null;

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <FadeTransition className="flex flex-col items-center min-h-screen p-6 max-w-2xl mx-auto w-full bg-stone-50 text-stone-900">
      
      {/* Session Stats */}
      <div className="mt-8 mb-6 w-full">
        <div className="text-stone-400 text-xs tracking-widest uppercase mb-4 text-center">Session Summary</div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-stone-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-mono font-bold text-stone-900">{formatTime(result.durationSeconds)}</div>
            <div className="text-xs text-stone-500 mt-1 uppercase tracking-wide">Duration</div>
          </div>
          <div className="bg-white border border-stone-200 rounded-lg p-4 text-center">
            <div className={`text-2xl font-mono font-bold ${result.wpm > 0 ? (result.wpm >= 130 && result.wpm <= 160 ? 'text-emerald-600' : 'text-amber-600') : 'text-stone-400'}`}>
              {result.wpm > 0 ? result.wpm : '—'}
            </div>
            <div className="text-xs text-stone-500 mt-1 uppercase tracking-wide">WPM</div>
          </div>
          <div className="bg-white border border-stone-200 rounded-lg p-4 text-center">
            <div className={`text-2xl font-mono font-bold ${result.fillersCount === 0 ? 'text-emerald-600' : result.fillersCount <= 3 ? 'text-amber-600' : 'text-red-500'}`}>
              {result.fillersCount}
            </div>
            <div className="text-xs text-stone-500 mt-1 uppercase tracking-wide">Fillers</div>
          </div>
        </div>
      </div>

      {/* Coach Debrief */}
      <div className="mb-8 text-center w-full">
        <div className="text-stone-400 text-xs tracking-widest uppercase mb-4">Coach Debrief</div>
        <div className="min-h-[120px] flex items-center justify-center bg-white border border-stone-200 rounded-lg p-6">
          {debriefText ? (
            <p className="text-xl serif italic text-stone-800 leading-relaxed">
              "{debriefText}"
            </p>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
              <p className="text-sm text-stone-500">Analyzing your session...</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-6 mb-8">
        <button onClick={onReset} className="flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors text-sm font-medium">
            <Home className="w-4 h-4" /> Home
        </button>
        <button onClick={onReset} className="flex items-center gap-2 px-5 py-2.5 border border-stone-300 rounded-lg hover:bg-stone-100 transition-colors text-sm font-medium text-stone-700">
            <RotateCcw className="w-4 h-4" /> Practice Again
        </button>
      </div>

    </FadeTransition>
  );
};
