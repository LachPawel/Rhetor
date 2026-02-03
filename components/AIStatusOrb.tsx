
import React from 'react';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { Mic, Zap } from 'lucide-react';

export const AIStatusOrb: React.FC = () => {
  const { isConnected, isSpeaking, connect } = useRhetor();

  if (!isConnected) {
    return (
        <button 
            onClick={connect}
            className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-stone-900 text-white shadow-lg hover:scale-105 transition-transform"
            title="Connect AI Coach"
        >
            <Mic className="w-5 h-5" />
        </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
        <div className={`
            flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all duration-500
            ${isSpeaking ? 'bg-emerald-500 scale-110' : 'bg-stone-900'}
        `}>
            {isSpeaking ? (
                <div className="flex gap-0.5 h-4 items-center">
                    <div className="w-1 bg-white animate-[bounce_1s_infinite]" style={{ animationDelay: '0ms' }} />
                    <div className="w-1 bg-white animate-[bounce_1s_infinite]" style={{ animationDelay: '200ms' }} />
                    <div className="w-1 bg-white animate-[bounce_1s_infinite]" style={{ animationDelay: '400ms' }} />
                </div>
            ) : (
                <Zap className="w-5 h-5 text-white" />
            )}
        </div>
    </div>
  );
};
