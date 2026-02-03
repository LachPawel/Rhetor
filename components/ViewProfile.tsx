
import React from 'react';
import { FadeTransition } from './FadeTransition.tsx';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { Flame, Coins, Award, Clock } from 'lucide-react';

export const ViewProfile: React.FC = () => {
  const { user } = useRhetor();

  return (
    <FadeTransition className="min-h-screen pb-24 bg-stone-50 p-6">
      <header className="mb-12 flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-stone-900 text-white flex items-center justify-center text-3xl serif font-light">
              {user.name[0]}
          </div>
          <div>
              <h1 className="text-2xl serif font-medium text-stone-900">{user.name}</h1>
              <p className="text-stone-500 text-sm">Rhetorician</p>
          </div>
      </header>

      <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg border border-stone-200 shadow-sm">
              <div className="flex items-center gap-2 text-orange-500 mb-1">
                  <Flame className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-widest font-bold">Streak</span>
              </div>
              <p className="text-2xl font-mono text-stone-900">{user.streak} Days</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-stone-200 shadow-sm">
              <div className="flex items-center gap-2 text-amber-500 mb-1">
                  <Coins className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-widest font-bold">Earned</span>
              </div>
              <p className="text-2xl font-mono text-stone-900">{user.drachmas}</p>
          </div>
      </div>

      <h2 className="text-lg serif font-medium mb-4 mt-8">Achievements</h2>
      <div className="grid grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
              <div key={i} className={`aspect-square rounded-full border-2 flex items-center justify-center ${i <= 2 ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-transparent text-stone-200'}`}>
                  <Award className="w-6 h-6" />
              </div>
          ))}
      </div>
      
      <div className="mt-12 pt-12 border-t border-stone-200 text-center">
          <button className="text-stone-400 text-xs uppercase tracking-widest hover:text-red-500">Sign Out</button>
      </div>
    </FadeTransition>
  );
};
