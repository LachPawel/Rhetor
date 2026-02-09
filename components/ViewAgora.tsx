
import React, { useMemo } from 'react';
import { FadeTransition } from './FadeTransition.tsx';
import { AppView, Lesson } from '../types.ts';
import { Lock, CheckCircle, Play } from 'lucide-react';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { lessons as lessonData } from '../src/data/lessons.ts';

interface ViewAgoraProps {
  onSelectLesson: (lesson: Lesson) => void;
}

const PILLARS = [
  { id: 'ethos', title: 'Ethos', subtitle: 'Credibility', color: 'bg-stone-900' },
  { id: 'logos', title: 'Logos', subtitle: 'Logic', color: 'bg-stone-600' },
  { id: 'pathos', title: 'Pathos', subtitle: 'Emotion', color: 'bg-stone-500' },
  { id: 'kairos', title: 'Kairos', subtitle: 'Timing', color: 'bg-stone-400' },
  { id: 'lexis', title: 'Lexis', subtitle: 'Delivery', color: 'bg-stone-300' },
];

export const ViewAgora: React.FC<ViewAgoraProps> = ({ onSelectLesson }) => {
  const { user } = useRhetor();

  // Sort lessons by pillar and then by order in the file
  const lessonsByPillar = useMemo(() => {
    const grouped: Record<string, Lesson[]> = {};
    lessonData.forEach(l => {
        // Map AcademyLesson to Legacy Lesson shape for compatibility
        const legacy: Lesson = {
            id: l.id,
            pillarId: l.pillar,
            title: l.title,
            description: l.description,
            type: 'LESSON', // Default type
            reward: l.drachmas,
            durationMinutes: Math.ceil(l.duration / 60)
        };
        
        if (!grouped[l.pillar]) grouped[l.pillar] = [];
        grouped[l.pillar].push(legacy);
    });
    return grouped;
  }, []);

  return (
    <FadeTransition className="min-h-screen pb-24 bg-stone-50 p-6">
      <header className="mb-8">
        <h1 className="text-3xl serif font-light text-stone-900">Agora</h1>
        <p className="text-stone-500 text-sm">Master the five pillars of rhetoric.</p>
      </header>

      <div className="space-y-12">
          {PILLARS.map(pillar => {
              const skills = lessonsByPillar[pillar.id] || [];
              if (skills.length === 0) return null;

              return (
                <div key={pillar.id} className="relative">
                    <div className="flex items-center gap-4 mb-4">
                        <div className={`w-3 h-12 rounded-full ${pillar.color} opacity-20`} />
                        <div>
                            <h2 className="text-xl serif font-medium">{pillar.title}</h2>
                            <p className="text-xs uppercase tracking-widest text-stone-400">{pillar.subtitle}</p>
                        </div>
                    </div>

                    <div className="pl-6 space-y-4 border-l border-stone-200 ml-1.5">
                        {skills.map((skill, idx) => {
                            // Kill the Fillers is always playable & never shown as completed
                            // Belly Breathing is explicitly locked/disabled
                            const isKillFillers = skill.id === 'kill-the-fillers';
                            const isLocked = !isKillFillers;
                            const isCompleted = !isKillFillers && user.completedLessons.includes(skill.id);

                            return (
                                <button 
                                  key={skill.id}
                                  disabled={isLocked}
                                  onClick={() => onSelectLesson(skill)}
                                  className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all text-left group
                                      ${isCompleted ? 'bg-stone-100 border-stone-200' : isLocked ? 'bg-stone-50 border-stone-100 opacity-50' : 'bg-white border-stone-200 shadow-sm hover:border-stone-400'}
                                  `}
                                >
                                    <div className="flex-1 pr-4">
                                        <h3 className="font-serif text-lg text-stone-900 mb-1">{skill.title}</h3>
                                        <p className="text-xs text-stone-500 line-clamp-2">{skill.description}</p>
                                        <div className="flex gap-3 mt-2">
                                            <span className="text-[10px] uppercase tracking-wider text-stone-400 font-bold border border-stone-200 px-1.5 py-0.5 rounded">
                                                {String(Math.ceil((skill.durationMinutes || 5)))} min
                                            </span>
                                            <span className="text-[10px] uppercase tracking-wider text-stone-400 font-bold border border-stone-200 px-1.5 py-0.5 rounded">
                                                +{skill.reward || 20} Δ
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="shrink-0">
                                        {isLocked ? (
                                            <Lock className="w-5 h-5 text-stone-300" />
                                        ) : isCompleted ? (
                                            <CheckCircle className="w-6 h-6 text-stone-900" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                                <Play className="w-3 h-3 ml-0.5" />
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
              );
          })}
      </div>
    </FadeTransition>
  );
};
