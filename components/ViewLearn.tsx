
import React, { useState } from 'react';
import { FadeTransition } from './FadeTransition.tsx';
import { AppView, LearningGuide } from '../types.ts';
import { ArrowLeft, ChevronRight, Mic } from 'lucide-react';

interface ViewLearnProps {
  onBack: () => void;
  onPractice: () => void;
}

const PILLARS: LearningGuide[] = [
  {
    id: 'ethos',
    title: 'Ethos',
    subtitle: 'Establish Trust',
    content: (
      <div className="space-y-8">
        <blockquote className="text-2xl serif italic text-stone-500 border-l-2 border-stone-300 pl-4 my-6">
          "They believe in you before they believe your idea."
        </blockquote>
        
        <div>
            <h4 className="text-stone-900 uppercase text-xs tracking-widest font-bold mb-4">Key Principles</h4>
            <ul className="space-y-3 text-stone-600 font-light">
                <li><strong className="text-stone-800 font-medium">Lead with credibility.</strong> What makes YOU the one?</li>
                <li><strong className="text-stone-800 font-medium">Show commitment.</strong> Skin in the game builds trust.</li>
                <li><strong className="text-stone-800 font-medium">Be authentic.</strong> Confidence, not arrogance.</li>
            </ul>
        </div>

        <div className="bg-stone-100 p-6 rounded-sm">
            <h4 className="text-stone-400 uppercase text-xs tracking-widest font-bold mb-2">The Fix</h4>
            <p className="text-stone-600 mb-2">Don't bury your credibility. Open with a single sentence that earns attention.</p>
            <p className="font-serif italic text-stone-800">"After 8 years teaching English in Turkey, I saw this problem daily..."</p>
        </div>
      </div>
    )
  },
  {
    id: 'logos',
    title: 'Logos',
    subtitle: 'Structure Your Argument',
    content: (
      <div className="space-y-8">
        <blockquote className="text-2xl serif italic text-stone-500 border-l-2 border-stone-300 pl-4 my-6">
          "A confused mind never says yes."
        </blockquote>
        
        <div>
            <h4 className="text-stone-900 uppercase text-xs tracking-widest font-bold mb-4">The Rhetor Framework</h4>
            <ol className="space-y-3 text-stone-600 font-light list-decimal pl-5">
                <li><strong className="text-stone-800 font-medium">Hook</strong> — Grab attention in 10 seconds.</li>
                <li><strong className="text-stone-800 font-medium">Problem</strong> — Make them feel the pain.</li>
                <li><strong className="text-stone-800 font-medium">Solution</strong> — Your answer, clearly stated.</li>
                <li><strong className="text-stone-800 font-medium">Proof</strong> — Traction or data that validates.</li>
                <li><strong className="text-stone-800 font-medium">Ask</strong> — Exactly what you want.</li>
            </ol>
        </div>
      </div>
    )
  },
  {
    id: 'pathos',
    title: 'Pathos',
    subtitle: 'Make Them Feel',
    content: (
      <div className="space-y-8">
        <blockquote className="text-2xl serif italic text-stone-500 border-l-2 border-stone-300 pl-4 my-6">
          "Data tells. Stories sell."
        </blockquote>
        
        <div>
             <h4 className="text-stone-900 uppercase text-xs tracking-widest font-bold mb-4">Story Structure</h4>
             <ul className="space-y-3 text-stone-600 font-light">
                <li><strong className="text-stone-800 font-medium">Character</strong> — Who are we following?</li>
                <li><strong className="text-stone-800 font-medium">Struggle</strong> — What obstacle do they face?</li>
                <li><strong className="text-stone-800 font-medium">Transformation</strong> — How does your solution change things?</li>
            </ul>
        </div>
        
        <div className="bg-stone-100 p-6 rounded-sm">
            <h4 className="text-stone-400 uppercase text-xs tracking-widest font-bold mb-2">The Fix</h4>
            <p className="text-stone-600 mb-2">Lead with a story, support with data.</p>
            <p className="font-serif italic text-stone-800">"Maria spent 4 hours every week doing X. Now it takes 10 minutes."</p>
        </div>
      </div>
    )
  },
  {
    id: 'kairos',
    title: 'Kairos',
    subtitle: 'Master Timing',
    content: (
      <div className="space-y-8">
        <blockquote className="text-2xl serif italic text-stone-500 border-l-2 border-stone-300 pl-4 my-6">
          "The pause is where the power lives."
        </blockquote>
        
        <div>
             <h4 className="text-stone-900 uppercase text-xs tracking-widest font-bold mb-4">Principles</h4>
             <ul className="space-y-3 text-stone-600 font-light">
                <li><strong className="text-stone-800 font-medium">The 10-second rule</strong> — Hook them before they tune out.</li>
                <li><strong className="text-stone-800 font-medium">Strategic Silence</strong> — Pause after key points.</li>
                <li><strong className="text-stone-800 font-medium">Ideal Pace</strong> — 140-150 words per minute.</li>
            </ul>
        </div>
      </div>
    )
  },
  {
    id: 'lexis',
    title: 'Lexis',
    subtitle: 'Deliver With Presence',
    content: (
      <div className="space-y-8">
        <blockquote className="text-2xl serif italic text-stone-500 border-l-2 border-stone-300 pl-4 my-6">
          "Your body speaks before your mouth opens."
        </blockquote>
        
        <div className="grid grid-cols-1 gap-6">
            <div>
                 <h4 className="text-stone-900 uppercase text-xs tracking-widest font-bold mb-2">Posture</h4>
                 <p className="text-stone-600 font-light">Stand grounded. Open chest. Head level.</p>
            </div>
            <div>
                 <h4 className="text-stone-900 uppercase text-xs tracking-widest font-bold mb-2">Eye Contact</h4>
                 <p className="text-stone-600 font-light">Connect, don't scan. Hold for a full thought. Look at the lens.</p>
            </div>
             <div>
                 <h4 className="text-stone-900 uppercase text-xs tracking-widest font-bold mb-2">Fillers</h4>
                 <p className="text-stone-600 font-light">Replace "um" with silence. Silence sounds confident.</p>
            </div>
        </div>
      </div>
    )
  }
];

export const ViewLearn: React.FC<ViewLearnProps> = ({ onBack, onPractice }) => {
  const [selectedPillar, setSelectedPillar] = useState<LearningGuide | null>(null);

  return (
    <FadeTransition className="flex flex-col min-h-screen p-6 max-w-3xl mx-auto w-full bg-stone-50 text-stone-900">
      <header className="flex items-center justify-between mb-12">
        <button onClick={onBack} className="text-stone-400 hover:text-stone-900 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-sm tracking-widest text-stone-500 uppercase">The Five Pillars</h1>
        <div className="w-6" /> 
      </header>

      {!selectedPillar ? (
        <div className="grid gap-0 divide-y divide-stone-200 border-t border-b border-stone-200">
          <div className="py-8 text-center">
             <h2 className="text-4xl serif font-light text-stone-900 mb-2">Ancient wisdom for modern speakers</h2>
          </div>
          {PILLARS.map((pillar) => (
            <button
              key={pillar.id}
              onClick={() => setSelectedPillar(pillar)}
              className="group flex items-center justify-between py-6 text-left transition-all duration-300 hover:bg-stone-100 px-4 -mx-4 rounded-sm"
            >
              <div>
                <h3 className="text-2xl serif font-light text-stone-900 mb-1">{pillar.title}</h3>
                <p className="text-sm text-stone-500 font-sans">{pillar.subtitle}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-stone-900 transition-colors" />
            </button>
          ))}
        </div>
      ) : (
        <FadeTransition>
           <div className="mb-8">
              <button onClick={() => setSelectedPillar(null)} className="text-xs text-stone-400 mb-6 hover:text-stone-900 uppercase tracking-widest">← Back to pillars</button>
              <h2 className="text-5xl serif font-light text-stone-900 mb-2">{selectedPillar.title}</h2>
              <p className="text-xl text-stone-500 serif italic mb-12 border-b border-stone-200 pb-8">{selectedPillar.subtitle}</p>
              
              <div className="mb-16">
                  {selectedPillar.content}
              </div>

              <button 
                onClick={onPractice}
                className="w-full py-5 bg-stone-900 text-stone-50 hover:bg-stone-800 rounded-sm flex items-center justify-center gap-2 transition-all group"
              >
                  <span className="uppercase tracking-widest text-sm font-medium">Practice {selectedPillar.title}</span>
                  <Mic className="w-4 h-4 text-stone-400 group-hover:text-white" />
              </button>
           </div>
        </FadeTransition>
      )}
    </FadeTransition>
  );
};
