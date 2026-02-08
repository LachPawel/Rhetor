
import React, { useEffect } from 'react';
import { FadeTransition } from './FadeTransition.tsx';
import { AppView, AgentMode } from '../types.ts';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { Mic, Sparkles, Flame, Coins, Zap } from 'lucide-react';

interface ViewHomeProps {
  onChangeView: (view: AppView) => void;
}

export const ViewHome: React.FC<ViewHomeProps> = ({ onChangeView }) => {
  const { connect, isConnected, isConnecting, setMode, user } = useRhetor();

  useEffect(() => {
    if (isConnected) {
        setMode(AgentMode.WELCOMER);
    }
  }, [isConnected]);

  const handleStartJourney = async () => {
    if (!isConnected) await connect();
    // Default to daily challenge or warmup
    onChangeView(AppView.WARMUP);
  };

  return (
    <FadeTransition className="flex flex-col min-h-screen pb-20 bg-stone-50 text-stone-900">
      
      {/* Top Bar - Minimal */}
      <div className="px-6 pt-8 pb-4">
          <h1 className="text-2xl serif font-bold text-stone-900">Rhetor</h1>
      </div>

      <div className="px-6 flex-1 flex flex-col gap-6">
        
        {/* Daily Challenge Card */}
        <div className="bg-stone-900 text-white p-6 rounded-lg shadow-xl relative overflow-hidden group cursor-pointer" onClick={handleStartJourney}>
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] uppercase tracking-widest font-bold bg-white/20 px-2 py-1 rounded">Daily Challenge</span>
                    <span className="text-emerald-400 text-xs font-mono">+50 Δ</span>
                </div>
                <h3 className="text-2xl serif font-light mb-2">The Filler Killer</h3>
                <p className="text-stone-400 text-sm mb-6 max-w-[80%]">Speak for 60 seconds with zero filler words. Can you do it?</p>
                <div className="flex items-center gap-2 text-sm font-medium">
                    {isConnecting ? "Connecting..." : "Start Challenge"} 
                    <Zap className="w-4 h-4" />
                </div>
            </div>
            {/* Abstract Background Decoration */}
            <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-stone-800 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500" />
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-4">
            <button onClick={() => onChangeView(AppView.PREP)} className="p-4 bg-white border border-stone-200 rounded-lg shadow-sm hover:border-stone-400 transition-all text-left">
                <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center mb-3">
                    <Mic className="w-4 h-4 text-stone-600" />
                </div>
                <h4 className="font-serif text-lg">Build Pitch</h4>
                <p className="text-xs text-stone-500 mt-1">AI Interview Mode</p>
            </button>

            <button onClick={() => onChangeView(AppView.PRACTICE)} className="p-4 bg-white border border-stone-200 rounded-lg shadow-sm hover:border-stone-400 transition-all text-left">
                <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center mb-3">
                    <Sparkles className="w-4 h-4 text-stone-600" />
                </div>
                <h4 className="font-serif text-lg">Quick Practice</h4>
                <p className="text-xs text-stone-500 mt-1">Freestyle Session</p>
            </button>
        </div>

        {/* Continue Learning Section */}
        <div className="mt-2">
            <div className="flex justify-between items-end mb-4">
                <h3 className="text-lg serif text-stone-900">Continue Learning</h3>
                <button onClick={() => onChangeView(AppView.AGORA)} className="text-xs uppercase tracking-widest text-stone-400">View All</button>
            </div>
            
            <div className="bg-white border border-stone-200 p-4 rounded-lg flex items-center gap-4 cursor-pointer hover:bg-stone-50 transition-colors" onClick={() => onChangeView(AppView.AGORA)}>
                <div className="w-12 h-12 rounded bg-stone-200 flex items-center justify-center text-stone-500 font-serif text-xl font-bold">I</div>
                <div className="flex-1">
                    <h4 className="text-sm font-bold text-stone-900 uppercase tracking-wide">Ethos Pillar</h4>
                    <p className="text-xs text-stone-500 mt-0.5">Skill 2: The "Why You" Story</p>
                    <div className="w-full h-1 bg-stone-100 mt-3 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 w-1/3" />
                    </div>
                </div>
            </div>
        </div>

      </div>
    </FadeTransition>
  );
};
