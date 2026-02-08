
import React, { useMemo } from 'react';
import { FadeTransition } from './FadeTransition.tsx';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { useRhetorStore } from '../stores/useRhetorStore.ts';
import { Flame, Coins, Award, Clock, Mic, AlertTriangle } from 'lucide-react';

export const ViewProfile: React.FC = () => {
  const { user } = useRhetor();
  const sessionHistory = useRhetorStore((s) => s.sessionHistory);

  // Last 5 sessions, newest first
  const recentHistory = useMemo(
    () => (sessionHistory ?? []).slice(-5).reverse(),
    [sessionHistory],
  );

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

      {/* ── Session History ─────────────────────────────────────────── */}
      <h2 className="text-lg serif font-medium mb-4">History</h2>
      {recentHistory.length === 0 ? (
        <p className="text-sm text-stone-400 mb-8">No sessions yet. Complete a practice to see your history.</p>
      ) : (
        <div className="flex flex-col gap-3 mb-8">
          {recentHistory.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-stone-200 rounded-lg p-4 shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-stone-900 truncate">
                  {s.topic || 'Freestyle'}
                </p>
                <span className="text-[11px] text-stone-400 shrink-0 ml-2">
                  {new Date(s.date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1 text-stone-400 mb-0.5">
                    <Clock className="w-3 h-3" />
                  </div>
                  <p className="text-xs font-mono font-bold text-stone-700">
                    {Math.floor(s.duration / 60)}:{String(s.duration % 60).padStart(2, '0')}
                  </p>
                  <p className="text-[9px] text-stone-400 uppercase">Time</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-stone-400 mb-0.5">
                    <Mic className="w-3 h-3" />
                  </div>
                  <p className={`text-xs font-mono font-bold ${s.wpm >= 130 && s.wpm <= 160 ? 'text-emerald-600' : s.wpm > 0 ? 'text-amber-600' : 'text-stone-400'}`}>
                    {s.wpm > 0 ? s.wpm : '—'}
                  </p>
                  <p className="text-[9px] text-stone-400 uppercase">WPM</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-stone-400 mb-0.5">
                    <AlertTriangle className="w-3 h-3" />
                  </div>
                  <p className={`text-xs font-mono font-bold ${s.fillerCount === 0 ? 'text-emerald-600' : s.fillerCount <= 3 ? 'text-amber-600' : 'text-red-500'}`}>
                    {s.fillerCount}
                  </p>
                  <p className="text-[9px] text-stone-400 uppercase">Fillers</p>
                </div>
                <div>
                  <p className="text-xs font-mono font-bold text-stone-700 mt-1">{s.score}</p>
                  <p className="text-[9px] text-stone-400 uppercase">Score</p>
                </div>
              </div>
              {s.bulletsTotal > 0 && (
                <div className="mt-2 pt-2 border-t border-stone-100 text-[11px] text-stone-400">
                  Points covered: {s.bulletsCovered}/{s.bulletsTotal}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
