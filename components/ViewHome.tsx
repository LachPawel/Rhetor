
import React, { useEffect } from 'react';
import { FadeTransition } from './FadeTransition.tsx';
import { AppView, AgentMode } from '../types.ts';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { Mic, Sparkles, Flame, Coins, Zap, MessageSquare } from 'lucide-react';

interface ViewHomeProps {
  onChangeView: (view: AppView) => void;
}

export const ViewHome: React.FC<ViewHomeProps> = ({ onChangeView }) => {
  const { connect, isConnected, isConnecting, setMode, user } = useRhetor();

  // Ensure we are in Welcomer mode when on Home
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
      
      {/* Top Bar */}
      <div className="px-6 pt-8 pb-4 flex justify-between items-end bg-stone-50 sticky top-0 z-10">
          <h1 className="text-3xl font-serif text-stone-900 tracking-tight">Rhetor</h1>
          <div className="flex items-center gap-4 mb-1">
              <div className="flex items-center gap-1.5 text-orange-600">
                  <Flame className="w-4 h-4 fill-current" />
                  <span className="text-sm font-bold font-mono">{user.streak}</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-600">
                  <MessageSquare className="w-4 h-4 fill-current" />
                  <span className="text-sm font-bold font-mono">{user.drachmas}</span>
              </div>
          </div>
      </div>

      <div className="px-6 flex-1 flex flex-col gap-6">
        
        {/* Daily Challenge Card - Minimal Black */}
        <div 
          className="bg-black text-white p-6 rounded-sm shadow-xl relative overflow-hidden group cursor-pointer transition-transform active:scale-[0.99]" 
          onClick={handleStartJourney}
        >
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold bg-white/10 px-2 py-1.5 rounded-sm">Daily Challenge</span>
                    <span className="text-emerald-400 text-xs font-mono tracking-wider">+50 Δ</span>
                </div>
                <h3 className="text-3xl font-serif font-light mb-3 text-stone-50">The Filler Killer</h3>
                <p className="text-stone-400 text-sm mb-8 max-w-[90%] font-light leading-relaxed">
                  Speak for 60 seconds with zero filler words. Can you do it?
                </p>
                <div className="flex items-center gap-2 text-sm font-medium border-b border-stone-700 pb-0.5 w-fit hover:border-white transition-colors">
                    {isConnecting ? "Connecting..." : "Start Challenge"} 
                    <Zap className="w-4 h-4" />
                </div>
            </div>
            {/* Very subtle texture/gradient */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-stone-800/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => onChangeView(AppView.PREP)} 
              className="p-6 bg-white border border-stone-200 rounded-sm shadow-sm hover:border-stone-400 hover:shadow-md transition-all text-left flex flex-col gap-4 group"
            >
                <div className="w-10 h-10 rounded-full bg-stone-50 flex items-center justify-center group-hover:bg-stone-100 transition-colors">
                    <Mic className="w-5 h-5 text-stone-900" />
                </div>
                <div>
                  <h4 className="font-serif text-xl text-stone-900">Build Pitch</h4>
                  <p className="text-[10px] uppercase tracking-wider text-stone-500 mt-1">AI Interview Mode</p>
                </div>
            </button>

            <button 
              onClick={() => onChangeView(AppView.PRACTICE)} 
              className="p-6 bg-white border border-stone-200 rounded-sm shadow-sm hover:border-stone-400 hover:shadow-md transition-all text-left flex flex-col gap-4 group"
            >
                <div className="w-10 h-10 rounded-full bg-stone-50 flex items-center justify-center group-hover:bg-stone-100 transition-colors">
                    <Sparkles className="w-5 h-5 text-stone-900" />
                </div>
                <div>
                  <h4 className="font-serif text-xl text-stone-900">Quick Practice</h4>
                  <p className="text-[10px] uppercase tracking-wider text-stone-500 mt-1">Freestyle Session</p>
                </div>
            </button>
        </div>

        {/* Continue Learning Section */}
        <div className="mt-4">
            <div className="flex justify-between items-end mb-4 px-1">
                <h3 className="text-xl font-serif text-stone-900">Continue Learning</h3>
                <button onClick={() => onChangeView(AppView.AGORA)} className="text-[10px] uppercase tracking-widest text-stone-400 hover:text-stone-900 transition-colors">View All</button>
            </div>
            
            <div className="bg-white border border-stone-200 p-5 rounded-sm flex items-center gap-5 cursor-pointer hover:bg-stone-50 transition-colors group" onClick={() => onChangeView(AppView.AGORA)}>
                <div className="w-14 h-14 bg-stone-100 flex items-center justify-center text-stone-400 font-serif text-2xl font-bold group-hover:bg-stone-200 transition-colors">
                  I
                </div>
                <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="text-xs font-bold text-stone-900 uppercase tracking-widest mb-1">Ethos Pillar</h4>
                    </div>
                    <p className="text-sm text-stone-600 serif italic">Skill 2: The "Why You" Story</p>
                    
                    {/* Minimal Progress Line */}
                    <div className="w-full h-0.5 bg-stone-100 mt-4 overflow-hidden rounded-full">
                        <div className="h-full bg-emerald-500 w-1/3" />
                    </div>
                </div>
            </div>
        </div>

      </div>
    </FadeTransition>
  );
};
