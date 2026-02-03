
import React from 'react';
import { FadeTransition } from './FadeTransition.tsx';
import { ArrowLeft } from 'lucide-react';

interface ViewHistoryProps {
  onBack: () => void;
}

export const ViewHistory: React.FC<ViewHistoryProps> = ({ onBack }) => {
  return (
    <FadeTransition className="flex flex-col items-center justify-center min-h-screen p-6 bg-stone-50 text-stone-900">
      <button onClick={onBack} className="absolute top-6 left-6 text-stone-400 hover:text-stone-900 transition-colors">
        <ArrowLeft className="w-6 h-6" />
      </button>

      <div className="max-w-md text-center">
        <h2 className="text-4xl serif font-light text-stone-900 mb-4">Your Journey</h2>
        <p className="text-stone-500 font-serif italic text-lg mb-8">Track your progress over time</p>
        
        <div className="p-8 border border-dashed border-stone-300 rounded-sm bg-stone-100">
            <div className="text-sm uppercase tracking-widest text-stone-400 mb-2">Coming Soon</div>
            <p className="text-stone-600 text-sm leading-relaxed">
                History tracking and detailed progress analytics will be available soon. For now, keep practicing. Every session makes you better.
            </p>
        </div>
        
        <button onClick={onBack} className="mt-8 text-xs uppercase tracking-widest text-stone-400 hover:text-stone-900 transition-colors">
            ← Return Home
        </button>
      </div>
    </FadeTransition>
  );
};
