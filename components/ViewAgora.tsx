
import React from 'react';
import { FadeTransition } from './FadeTransition.tsx';
import { AppView, Lesson } from '../types.ts';
import { Lock, CheckCircle, Play } from 'lucide-react';
import { useRhetor } from '../contexts/RhetorContext.tsx';

interface ViewAgoraProps {
  onSelectLesson: (lesson: Lesson) => void;
}

const PILLARS = [
  { id: 'ethos', title: 'Ethos', subtitle: 'Credibility', color: 'bg-emerald-500' },
  { id: 'logos', title: 'Logos', subtitle: 'Logic', color: 'bg-blue-500' },
  { id: 'pathos', title: 'Pathos', subtitle: 'Emotion', color: 'bg-rose-500' },
];

const SKILLS: Lesson[] = [
    { id: 'ethos-1', pillarId: 'ethos', title: 'The Hook', description: 'Master the first 10 seconds.', type: 'LESSON', reward: 20, durationMinutes: 2 },
    { id: 'ethos-2', pillarId: 'ethos', title: 'Why You?', description: 'Establish founder-market fit.', type: 'DRILL', reward: 30, durationMinutes: 3 },
    { id: 'ethos-3', pillarId: 'ethos', title: 'Audience Adapt', description: 'Pitch to VCs vs Customers.', type: 'CHALLENGE', reward: 50, durationMinutes: 5 },
];

export const ViewAgora: React.FC<ViewAgoraProps> = ({ onSelectLesson }) => {
  const { user } = useRhetor();

  return (
    <FadeTransition className="min-h-screen pb-24 bg-stone-50 p-6">
      <header className="mb-8">
        <h1 className="text-3xl serif font-light text-stone-900">Agora</h1>
        <p className="text-stone-500 text-sm">Master the five pillars of rhetoric.</p>
      </header>

      <div className="space-y-12">
          {PILLARS.map(pillar => (
              <div key={pillar.id} className="relative">
                  <div className="flex items-center gap-4 mb-4">
                      <div className={`w-3 h-12 rounded-full ${pillar.color} opacity-20`} />
                      <div>
                          <h2 className="text-xl serif font-medium">{pillar.title}</h2>
                          <p className="text-xs uppercase tracking-widest text-stone-400">{pillar.subtitle}</p>
                      </div>
                  </div>

                  <div className="pl-6 space-y-4 border-l border-stone-200 ml-1.5">
                      {SKILLS.filter(s => s.pillarId === pillar.id).map((skill, idx) => {
                          const isCompleted = user.completedLessons.includes(skill.id);
                          const isLocked = idx > 0 && !user.completedLessons.includes(SKILLS[idx-1].id);

                          return (
                              <button 
                                key={skill.id}
                                disabled={isLocked}
                                onClick={() => onSelectLesson(skill)}
                                className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all text-left group
                                    ${isCompleted ? 'bg-stone-100 border-stone-200' : isLocked ? 'bg-stone-50 border-stone-100 opacity-50' : 'bg-white border-stone-200 shadow-sm hover:border-stone-400'}
                                `}
                              >
                                  <div className="flex-1">
                                      <h3 className="font-serif text-lg text-stone-900">{skill.title}</h3>
                                      <p className="text-xs text-stone-500">{skill.description}</p>
                                  </div>
                                  
                                  <div className="ml-4">
                                      {isCompleted ? (
                                          <CheckCircle className="w-6 h-6 text-emerald-500" />
                                      ) : isLocked ? (
                                          <Lock className="w-5 h-5 text-stone-300" />
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
          ))}
      </div>
    </FadeTransition>
  );
};
