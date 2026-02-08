
import React, { useEffect } from 'react';
import { FadeTransition } from './FadeTransition.tsx';
import { AppView, AgentMode } from '../types.ts';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { Mic, Sparkles, Flame, Coins, Zap, Wind, FileText, BookOpen, Target, Play } from 'lucide-react';
import { useRhetorStore } from '../stores/useRhetorStore';

interface ViewHomeProps {
  onChangeView: (view: AppView) => void;
}

export const ViewHome: React.FC<ViewHomeProps> = ({ onChangeView }) => {
  const { connect, isConnected, isConnecting, setMode, user } = useRhetor();
  const sessionHistory = useRhetorStore((s) => s.sessionHistory);

  useEffect(() => {
    if (isConnected) {
        setMode(AgentMode.WELCOMER);
    }
  }, [isConnected]);

  // Connect before warm up action
  const handleWarmUp = async () => {
    if (!isConnected) await connect();
    onChangeView(AppView.WARMUP);
  };
  
  // Connect before practice
  const handlePractice = async () => {
    if (!isConnected) await connect();
    onChangeView(AppView.PRACTICE);
  };

  return (
    <FadeTransition className="flex flex-col min-h-screen pb-20 bg-stone-50 text-stone-900">
      
      <div className="px-6 pt-10 flex-1 flex flex-col gap-6">
        
        {/* Today's Challenge */}
        <div className="bg-stone-100 border border-stone-200 p-4 rounded-lg flex items-center justify-between cursor-pointer hover:bg-stone-200 transition-colors" onClick={handleWarmUp}>
            <div>
                 <div className="flex items-center gap-2 mb-1">
                     <Target className="w-3 h-3 text-stone-500" />
                     <span className="text-[10px] uppercase tracking-widest font-bold text-stone-500">Today's Challenge</span>
                 </div>
                 <h3 className="font-serif text-lg text-stone-900">Complete "Box Breathing"</h3>
            </div>
            <span className="px-2 py-1 bg-stone-200 rounded text-xs font-mono font-bold text-stone-600">+20 Δ</span>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-4">
            <button onClick={handleWarmUp} className="p-4 bg-white border border-stone-200 rounded-lg shadow-sm hover:border-stone-400 transition-all text-left flex flex-col justify-between h-32">
                <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center">
                    <Wind className="w-4 h-4 text-stone-600" />
                </div>
                <div>
                    <h4 className="font-serif text-lg leading-none mb-1">Warm Up</h4>
                    <p className="text-xs text-stone-500">Breathe & focus</p>
                </div>
            </button>

            <button onClick={() => onChangeView(AppView.PREP)} className="p-4 bg-white border border-stone-200 rounded-lg shadow-sm hover:border-stone-400 transition-all text-left flex flex-col justify-between h-32">
                <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-stone-600" />
                </div>
                <div>
                    <h4 className="font-serif text-lg leading-none mb-1">Prepare</h4>
                    <p className="text-xs text-stone-500">Build content</p>
                </div>
            </button>

            <button onClick={handlePractice} className="p-4 bg-white border border-stone-200 rounded-lg shadow-sm hover:border-stone-400 transition-all text-left flex flex-col justify-between h-32">
                <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center">
                    <Mic className="w-4 h-4 text-stone-600" />
                </div>
                <div>
                    <h4 className="font-serif text-lg leading-none mb-1">Practice</h4>
                    <p className="text-xs text-stone-500">Deliver your talk</p>
                </div>
            </button>

            <button onClick={() => onChangeView(AppView.AGORA)} className="p-4 bg-white border border-stone-200 rounded-lg shadow-sm hover:border-stone-400 transition-all text-left flex flex-col justify-between h-32">
                <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-stone-600" />
                </div>
                <div>
                    <h4 className="font-serif text-lg leading-none mb-1">Academy</h4>
                    <p className="text-xs text-stone-500">Learn skills</p>
                </div>
            </button>
        </div>

        {/* Recent Sessions */}
        {sessionHistory && sessionHistory.length > 0 && (
            <div className="mt-2">
                <div className="flex justify-between items-end mb-4">
                    <h3 className="text-lg serif text-stone-900">Recent Sessions</h3>
                    <button onClick={() => onChangeView(AppView.PROFILE)} className="text-xs uppercase tracking-widest text-stone-400">View All</button>
                </div>
                
                <div className="flex flex-col gap-3">
                    {sessionHistory.slice(-2).reverse().map(session => (
                        <div key={session.id} className="bg-white border border-stone-200 p-4 rounded-lg flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-bold text-stone-900 truncate max-w-[150px]">{session.topic || 'Freestyle Session'}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-stone-500">Score: {session.score}</span>
                                    <span className="text-stone-300">•</span>
                                    <span className="text-xs text-stone-500 font-mono">{Math.floor(session.duration/60)}:{String(session.duration%60).padStart(2,'0')}</span>
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center">
                                <Play className="w-3 h-3 text-stone-400 ml-0.5" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

      </div>
    </FadeTransition>
  );
};
