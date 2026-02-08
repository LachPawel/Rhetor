
import React from 'react';
import { FadeTransition } from './FadeTransition.tsx';
import { Lesson as LegacyLesson } from '../types.ts';
import { Lock, CheckCircle2, Play, Clock, Coins } from 'lucide-react';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { lessons, type Lesson as AcademyLesson } from '../src/data/lessons.ts';

// ─── Category Definitions ────────────────────────────────────────────
const CATEGORIES: {
  key: AcademyLesson['category'];
  emoji: string;
  label: string;
  accent: string;       // left bar + play button bg
  badgeBg: string;      // duration / reward badge
  badgeText: string;
  cardBorder: string;   // hover state
  completedBg: string;
}[] = [
  {
    key: 'breathing',
    emoji: '🫁',
    label: 'Breathing',
    accent: 'bg-blue-500',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-600',
    cardBorder: 'hover:border-blue-300',
    completedBg: 'bg-blue-50/60',
  },
  {
    key: 'voice',
    emoji: '🎤',
    label: 'Voice',
    accent: 'bg-purple-500',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-600',
    cardBorder: 'hover:border-purple-300',
    completedBg: 'bg-purple-50/60',
  },
  {
    key: 'technique',
    emoji: '💡',
    label: 'Technique',
    accent: 'bg-amber-500',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-600',
    cardBorder: 'hover:border-amber-300',
    completedBg: 'bg-amber-50/60',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────
/** Convert seconds → human-friendly label */
const fmtDuration = (s: number) => (s >= 60 ? `${Math.round(s / 60)} min` : `${s}s`);

/** Bridge new AcademyLesson → old Lesson interface expected by App.tsx */
const toLegacy = (l: AcademyLesson): LegacyLesson => ({
  id: l.id,
  pillarId: l.pillar,
  title: l.title,
  description: l.description,
  type: 'LESSON',
  reward: l.drachmas,
  durationMinutes: Math.ceil(l.duration / 60),
});

// ─── Component ───────────────────────────────────────────────────────
interface ViewAgoraProps {
  onSelectLesson: (lesson: LegacyLesson) => void;
}

export const ViewAgora: React.FC<ViewAgoraProps> = ({ onSelectLesson }) => {
  const { user } = useRhetor();
  const completed = new Set(user.completedLessons);

  const isUnlocked = (lesson: AcademyLesson, indexInCategory: number): boolean => {
    // First lesson in each category is always unlocked
    if (indexInCategory === 0) return true;
    // No prerequisite → unlocked
    if (!lesson.prerequisite) return true;
    // Prerequisite completed → unlocked
    return completed.has(lesson.prerequisite);
  };

  return (
    <FadeTransition className="min-h-screen pb-24 bg-stone-50">
      {/* Header */}
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-3xl serif font-light text-stone-900">Academy</h1>
        <p className="text-stone-500 text-sm mt-1">Build your voice, one lesson at a time.</p>
      </div>

      {/* Category Groups */}
      <div className="px-6 mt-6 space-y-10">
        {CATEGORIES.map((cat) => {
          const catLessons = lessons.filter((l) => l.category === cat.key);
          const doneCount = catLessons.filter((l) => completed.has(l.id)).length;

          return (
            <section key={cat.key}>
              {/* Category Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{cat.emoji}</span>
                  <h2 className="text-lg serif font-medium text-stone-900">{cat.label}</h2>
                </div>
                <span className="text-xs text-stone-400 font-mono">
                  {doneCount}/{catLessons.length}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1 bg-stone-100 rounded-full mb-5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${cat.accent}`}
                  style={{ width: `${catLessons.length ? (doneCount / catLessons.length) * 100 : 0}%` }}
                />
              </div>

              {/* Lesson Cards */}
              <div className="space-y-3">
                {catLessons.map((lesson, idx) => {
                  const isDone = completed.has(lesson.id);
                  const unlocked = isUnlocked(lesson, idx);

                  return (
                    <button
                      key={lesson.id}
                      disabled={!unlocked}
                      onClick={() => onSelectLesson(toLegacy(lesson))}
                      className={`
                        w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-200 group
                        ${isDone
                          ? `${cat.completedBg} border-stone-200`
                          : unlocked
                            ? `bg-white border-stone-200 shadow-sm ${cat.cardBorder} hover:shadow-md active:scale-[0.98]`
                            : 'bg-stone-50 border-stone-100 opacity-50 cursor-not-allowed'}
                      `}
                    >
                      {/* Left accent bar */}
                      <div className={`w-1 self-stretch rounded-full ${isDone ? 'bg-emerald-400' : unlocked ? cat.accent : 'bg-stone-200'}`} />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-serif text-[17px] text-stone-900 leading-tight">{lesson.title}</h3>
                        <p className="text-xs text-stone-500 mt-1 line-clamp-1">{lesson.description}</p>

                        {/* Badges */}
                        <div className="flex items-center gap-2 mt-2.5">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${cat.badgeBg} ${cat.badgeText}`}>
                            <Clock className="w-3 h-3" />
                            {fmtDuration(lesson.duration)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                            <Coins className="w-3 h-3" />
                            {lesson.drachmas}Δ
                          </span>
                        </div>
                      </div>

                      {/* Right icon */}
                      <div className="ml-2 flex-shrink-0">
                        {isDone ? (
                          <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                        ) : !unlocked ? (
                          <Lock className="w-5 h-5 text-stone-300" />
                        ) : (
                          <div className={`w-9 h-9 rounded-full ${cat.accent} text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                            <Play className="w-4 h-4 ml-0.5" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Bottom Spacer */}
      <div className="h-6" />
    </FadeTransition>
  );
};
