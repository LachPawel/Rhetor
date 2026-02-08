
import React, { useMemo } from 'react';
import { FadeTransition } from './FadeTransition.tsx';
import { AppView } from '../types.ts';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { useRhetorStore } from '../stores/useRhetorStore.ts';
import { lessons } from '../src/data/lessons.ts';
import { Flame, Coins, ChevronRight } from 'lucide-react';

interface ViewHomeProps {
  onChangeView: (view: AppView) => void;
  onStartLesson?: (lessonId: string) => void;
}

export const ViewHome: React.FC<ViewHomeProps> = ({ onChangeView, onStartLesson }) => {
  const { user } = useRhetor();
  const talkingPoints = useRhetorStore((s) => s.talkingPoints);
  const sessionHistory = useRhetorStore((s) => s.sessionHistory);

  // ── Daily Challenge: random incomplete lesson, stable per day ──────
  const dailyChallenge = useMemo(() => {
    const completedIds = new Set(user.completedLessons);
    const incomplete = lessons.filter((l) => !completedIds.has(l.id));
    if (incomplete.length === 0) return null;
    const today = new Date();
    const seed =
      today.getFullYear() * 10000 +
      (today.getMonth() + 1) * 100 +
      today.getDate();
    return incomplete[seed % incomplete.length];
  }, [user.completedLessons]);

  // ── Next unlocked incomplete lesson ────────────────────────────────
  const nextLesson = useMemo(() => {
    const completedIds = new Set(user.completedLessons);
    return lessons.find((l) => {
      if (completedIds.has(l.id)) return false;
      if (l.prerequisite && !completedIds.has(l.prerequisite)) return false;
      return true;
    });
  }, [user.completedLessons]);

  // ── Last 2 practice sessions (newest first) ────────────────────
  const recentSessions = useMemo(
    () => (sessionHistory ?? []).slice(-2).reverse(),
    [sessionHistory],
  );

  const handlePracticeClick = () => {
    onChangeView(talkingPoints.length > 0 ? AppView.PRACTICE : AppView.INPUT);
  };

  return (
    <FadeTransition className="flex flex-col min-h-screen pb-20 bg-stone-50 text-stone-900">
      {/* ── Header with streak & drachmas ──────────────────────────── */}
      <div className="px-6 pt-6 pb-4 flex justify-between items-center bg-stone-50/80 backdrop-blur sticky top-0 z-10">
        <h1 className="text-2xl serif font-bold text-stone-900">Rhetor</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-orange-600">
            <Flame className="w-4 h-4 fill-current" />
            <span className="text-sm font-mono font-bold">{user.streak}</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-600">
            <Coins className="w-4 h-4 fill-current" />
            <span className="text-sm font-mono font-bold">{user.drachmas}</span>
          </div>
        </div>
      </div>

      <div className="px-6 flex-1 flex flex-col gap-6">
        {/* ── Quick Actions 2×2 ─────────────────────────────────────── */}
        <div>
          <h3 className="text-xs uppercase tracking-widest text-stone-400 mb-3">
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onChangeView(AppView.WARMUP)}
              className="p-4 bg-white border border-stone-200 rounded-lg shadow-sm hover:border-stone-400 transition-all text-left"
            >
              <span className="text-2xl mb-2 block">🫁</span>
              <h4 className="font-serif text-base font-semibold">Warm Up</h4>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Breathing &amp; voice prep
              </p>
            </button>

            <button
              onClick={() => onChangeView(AppView.INPUT)}
              className="p-4 bg-white border border-stone-200 rounded-lg shadow-sm hover:border-stone-400 transition-all text-left"
            >
              <span className="text-2xl mb-2 block">📝</span>
              <h4 className="font-serif text-base font-semibold">Prepare</h4>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Build your content
              </p>
            </button>

            <button
              onClick={handlePracticeClick}
              className="p-4 bg-white border border-stone-200 rounded-lg shadow-sm hover:border-stone-400 transition-all text-left"
            >
              <span className="text-2xl mb-2 block">🎤</span>
              <h4 className="font-serif text-base font-semibold">Practice</h4>
              <p className="text-[11px] text-stone-400 mt-0.5">
                {talkingPoints.length > 0 ? 'Continue session' : 'Start a session'}
              </p>
            </button>

            <button
              onClick={() => onChangeView(AppView.AGORA)}
              className="p-4 bg-white border border-stone-200 rounded-lg shadow-sm hover:border-stone-400 transition-all text-left"
            >
              <span className="text-2xl mb-2 block">📚</span>
              <h4 className="font-serif text-base font-semibold">Academy</h4>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Lessons &amp; skills
              </p>
            </button>
          </div>
        </div>

        {/* ── Daily Challenge Card ─────────────────────────────────── */}
        {dailyChallenge && (
          <div
            className="bg-stone-900 text-white p-5 rounded-lg shadow-xl relative overflow-hidden group cursor-pointer"
            onClick={() => onStartLesson?.(dailyChallenge.id)}
          >
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-3">
                <span className="text-[10px] uppercase tracking-widest font-bold bg-white/20 px-2 py-1 rounded">
                  Daily Challenge
                </span>
                <span className="text-emerald-400 text-xs font-mono">
                  +{dailyChallenge.drachmas} Δ
                </span>
              </div>
              <p className="text-sm text-stone-300">
                Today: Complete{' '}
                <span className="text-white font-semibold">
                  {dailyChallenge.title}
                </span>{' '}
                <span className="text-emerald-400">
                  +{dailyChallenge.drachmas}Δ bonus
                </span>
              </p>
              <div className="flex items-center gap-2 text-sm font-medium mt-4">
                Start Challenge <ChevronRight className="w-4 h-4" />
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-stone-800 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500" />
          </div>
        )}

        {/* ── Recent Sessions ──────────────────────────────────────── */}
        {recentSessions.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-widest text-stone-400 mb-3">
              Recent Sessions
            </h3>
            <div className="flex flex-col gap-2">
              {recentSessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-white border border-stone-200 rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900 truncate">
                      {session.topic || 'Freestyle'}
                    </p>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      {new Date(session.date).toLocaleDateString(
                        undefined,
                        { month: 'short', day: 'numeric' },
                      )}{' '}
                      · {Math.floor(session.duration / 60)}m
                      {session.wpm > 0 ? ` · ${session.wpm} wpm` : ''}
                    </p>
                  </div>
                  {session.score != null && (
                    <div className="text-right ml-3">
                      <span className="text-lg font-mono font-bold text-stone-900">
                        {session.score}
                      </span>
                      <span className="text-[10px] text-stone-400 block">
                        score
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Continue Learning ────────────────────────────────────── */}
        {nextLesson && (
          <div>
            <div className="flex justify-between items-end mb-3">
              <h3 className="text-xs uppercase tracking-widest text-stone-400">
                Continue Learning
              </h3>
              <button
                onClick={() => onChangeView(AppView.AGORA)}
                className="text-[11px] uppercase tracking-widest text-stone-400 hover:text-stone-600"
              >
                View All
              </button>
            </div>
            <div
              className="bg-white border border-stone-200 p-4 rounded-lg flex items-center gap-4 cursor-pointer hover:bg-stone-50 transition-colors"
              onClick={() => onStartLesson?.(nextLesson.id)}
            >
              <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-lg">
                {nextLesson.category === 'breathing'
                  ? '🫁'
                  : nextLesson.category === 'voice'
                    ? '🗣️'
                    : '🎯'}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-stone-900">
                  {nextLesson.title}
                </h4>
                <p className="text-[11px] text-stone-400 mt-0.5 truncate">
                  {nextLesson.description}
                </p>
              </div>
              <div className="flex items-center gap-1 text-stone-400">
                <span className="text-[11px] font-medium">Continue</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        )}
      </div>
    </FadeTransition>
  );
};
