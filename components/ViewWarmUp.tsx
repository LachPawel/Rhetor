
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeTransition } from './FadeTransition.tsx';
import { X, Camera, Loader2 } from 'lucide-react';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { AgentMode } from '../types.ts';

interface ViewWarmUpProps {
  onComplete: () => void;
  onExit: () => void;
}

const STAGES = [
  { id: 'breathe', title: 'Breathe', duration: 90 },
  { id: 'voice', title: 'Voice', duration: 90 },
  { id: 'body', title: 'Body', duration: 90 }
];

export const ViewWarmUp: React.FC<ViewWarmUpProps> = ({ onComplete, onExit }) => {
  const { setMode, isConnected } = useRhetor();
  const [stageIndex, setStageIndex] = useState(0);
  const currentStage = STAGES[stageIndex];
  
  // Vision state (keep local as it's view-specific visual feedback)
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (isConnected) {
        setMode(AgentMode.COACH_WARMUP);
    }
  }, [isConnected]);

  // Camera Logic for BODY stage only
  useEffect(() => {
    if (currentStage.id === 'body') {
        navigator.mediaDevices.getUserMedia({ video: true }).then(setStream).catch(console.error);
    } else {
        stream?.getTracks().forEach(t => t.stop());
        setStream(null);
    }
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [currentStage.id]);

  useEffect(() => {
      if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  const handleNext = () => {
    if (stageIndex < STAGES.length - 1) {
      setStageIndex(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  return (
    <FadeTransition className="flex flex-col items-center justify-center min-h-screen p-6 relative bg-stone-50 text-stone-900 overflow-hidden">
      <button onClick={onExit} className="absolute top-6 right-6 text-stone-400 hover:text-stone-900 transition-colors z-20">
        <X className="w-6 h-6" />
      </button>

      <div className="absolute top-12 flex gap-2 z-10">
        {STAGES.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === stageIndex ? 'bg-stone-900' : 'bg-stone-300'}`} />
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg z-10 text-center">
         <AnimatePresence mode="wait">
             {currentStage.id === 'breathe' && (
                 <motion.div key="breathe" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                    <h2 className="text-4xl serif font-light mb-2">Breathe</h2>
                    <p className="text-stone-500 font-serif italic mb-12">Listen to Rhetor's count.</p>
                    <div className="w-48 h-48 border-4 border-stone-200 rounded-full mx-auto animate-[pulse_4s_infinite]" />
                 </motion.div>
             )}
             {currentStage.id === 'voice' && (
                 <motion.div key="voice" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                    <h2 className="text-4xl serif font-light mb-2">Voice</h2>
                    <p className="text-stone-500 font-serif italic mb-12">Repeat the warm-ups.</p>
                 </motion.div>
             )}
             {currentStage.id === 'body' && (
                 <motion.div key="body" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="w-full">
                    <div className="relative w-full aspect-video bg-black rounded-sm overflow-hidden mb-8">
                        {stream && <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />}
                    </div>
                    <h2 className="text-4xl serif font-light mb-2">Body</h2>
                    <p className="text-stone-500 font-serif italic">Stand tall.</p>
                 </motion.div>
             )}
         </AnimatePresence>
      </div>

      <div className="w-full max-w-md z-20 flex flex-col items-center gap-4">
          <p className="text-xs text-stone-400 uppercase tracking-widest animate-pulse">Rhetor is guiding you...</p>
          <button onClick={handleNext} className="text-stone-900 border-b border-stone-900 pb-1 text-sm uppercase tracking-widest">
              Next Stage →
          </button>
      </div>
    </FadeTransition>
  );
};
