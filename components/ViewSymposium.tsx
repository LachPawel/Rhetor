
import React from 'react';
import { FadeTransition } from './FadeTransition.tsx';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { Trophy, Flame } from 'lucide-react';

export const ViewSymposium: React.FC = () => {
  const { user } = useRhetor();
  
  // Mock Data
  const LEADERS = [
      { name: "Helena", score: 4500, rank: 1 },
      { name: "Marcus", score: 4200, rank: 2 },
      { name: "Sophia", score: 3800, rank: 3 },
      { name: "You", score: user.drachmas, rank: 12, isMe: true },
      { name: "Alex", score: user.drachmas - 50, rank: 13 },
  ].sort((a,b) => b.score - a.score);

  return (
    <FadeTransition className="min-h-screen pb-24 bg-stone-50 p-6">
      <header className="mb-8 text-center">
        <h1 className="text-3xl serif font-light text-stone-900 mb-2">Symposium</h1>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold uppercase tracking-widest">
            <Trophy className="w-3 h-3" /> Academy League
        </div>
      </header>

      <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
          <div className="px-6 py-4 bg-stone-50 border-b border-stone-200 flex justify-between items-center">
               <span className="text-xs uppercase tracking-widest font-bold text-stone-500">Rank</span>
               <span className="text-xs uppercase tracking-widest font-bold text-stone-500">Speaker</span>
               <span className="text-xs uppercase tracking-widest font-bold text-stone-500">Drachmas</span>
          </div>
          <div className="divide-y divide-stone-100">
              {LEADERS.map((entry, i) => (
                  <div key={i} className={`flex items-center justify-between px-6 py-4 ${entry.isMe ? 'bg-stone-50' : ''}`}>
                      <div className="flex items-center gap-4">
                          <span className={`font-mono font-bold w-6 text-center ${entry.rank <= 3 ? 'text-amber-500' : 'text-stone-400'}`}>{entry.rank}</span>
                          <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-xs font-bold text-stone-600">
                                   {entry.name[0]}
                               </div>
                               <span className={`text-sm ${entry.isMe ? 'font-bold text-stone-900' : 'text-stone-600'}`}>{entry.name}</span>
                          </div>
                      </div>
                      <span className="font-mono text-sm text-stone-900 font-medium">{entry.score}</span>
                  </div>
              ))}
          </div>
      </div>
      
      <div className="mt-8 text-center text-xs text-stone-400">
          Top 10 promote to <span className="text-stone-900 font-bold">Lyceum</span> league in 3 days.
      </div>

    </FadeTransition>
  );
};
