
import React, { useEffect } from 'react';
import { FadeTransition } from './FadeTransition.tsx';
import { AppView, AgentMode } from '../types.ts';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { Target } from 'lucide-react';
import { useRhetorStore } from '../stores/useRhetorStore';

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

  // Connect before simulation
  const handleSimulation = async () => {
    if (!isConnected) await connect();
    onChangeView(AppView.SIMULATION);
  };

  return (
    <FadeTransition className="flex flex-col min-h-screen pb-20 bg-stone-50 text-stone-900">
      
      <div className="px-6 pt-12 flex-1 flex flex-col justify-start gap-8">
        
        {/* Header */}
        <div className="flex items-center justify-center mb-4">
             <h1 className="font-serif text-3xl tracking-tight text-stone-800">Rhetor</h1>
        </div>

        {/* Today's Challenge */}
        <div className="bg-white/60 backdrop-blur-md border border-stone-200 p-4 rounded-lg flex items-center justify-between cursor-pointer hover:bg-white/80 transition-all" onClick={handleWarmUp}>
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
            <button onClick={handleWarmUp} className="p-4 bg-white/60 backdrop-blur-md border border-stone-200 rounded-lg shadow-sm hover:border-stone-400 hover:bg-white/80 transition-all text-left flex flex-col justify-end h-32">
                <div>
                    <h4 className="font-serif text-lg leading-none mb-1">Warm Up</h4>
                    <p className="text-xs text-stone-500">Breathe & focus</p>
                </div>
            </button>

            <button onClick={() => onChangeView(AppView.PREP)} className="p-4 bg-white/60 backdrop-blur-md border border-stone-200 rounded-lg shadow-sm hover:border-stone-400 hover:bg-white/80 transition-all text-left flex flex-col justify-end h-32">
                <div>
                    <h4 className="font-serif text-lg leading-none mb-1">Prepare</h4>
                    <p className="text-xs text-stone-500">Build content</p>
                </div>
            </button>

            <button onClick={handlePractice} className="p-4 bg-white/60 backdrop-blur-md border border-stone-200 rounded-lg shadow-sm hover:border-stone-400 hover:bg-white/80 transition-all text-left flex flex-col justify-end h-32">
                <div>
                    <h4 className="font-serif text-lg leading-none mb-1">Practice</h4>
                    <p className="text-xs text-stone-500">Deliver your talk</p>
                </div>
            </button>

            <button onClick={handleSimulation} className="p-4 bg-white/60 backdrop-blur-md border border-stone-200 rounded-lg shadow-sm hover:border-stone-400 hover:bg-white/80 transition-all text-left flex flex-col justify-end h-32">
                <div>
                    <h4 className="font-serif text-lg leading-none mb-1">Simulation</h4>
                    <p className="text-xs text-stone-500">Face the audience</p>
                </div>
            </button>
        </div>

      </div>
    </FadeTransition>
  );
};
