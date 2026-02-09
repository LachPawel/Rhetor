
import React from 'react';
import { FadeTransition } from './FadeTransition.tsx';
import { User } from 'lucide-react';

export const ViewProfile: React.FC = () => {
  return (
    <FadeTransition className="min-h-screen pb-24 bg-stone-50 p-6 flex flex-col items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-6">
          <User className="w-8 h-8 text-stone-400" />
        </div>
        <h1 className="text-3xl serif font-light text-stone-900 mb-2">Profile</h1>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-600 rounded-full text-sm font-medium uppercase tracking-widest mb-6">
          Coming Soon
        </div>
        <p className="text-stone-500 text-sm leading-relaxed">
          Track your progress, view your achievements, and see your journey as a speaker.
        </p>
      </div>
    </FadeTransition>
  );
};
