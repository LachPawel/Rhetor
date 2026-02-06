
import React, { useEffect, useRef, useState } from 'react';
import { Mic, Eye, EyeOff } from 'lucide-react';
import { FadeTransition } from './FadeTransition.tsx';
import { PitchOption, SessionResult, AgentMode } from '../types.ts';
import { useRhetor } from '../contexts/RhetorContext.tsx';

interface ViewPracticeProps {
  pitchOption: PitchOption | null;
  onEnd: (result: SessionResult) => void;
}

export const ViewPractice: React.FC<ViewPracticeProps> = ({ pitchOption, onEnd }) => {
  const { setMode, isConnected, talkingPoints, aiResponse } = useRhetor();
  const duration = pitchOption?.durationSeconds || 120;
  const [timeLeft, setTimeLeft] = useState(duration);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  // Stats Ref
  const statsRef = useRef({
    startTime: Date.now(),
    fillers: 0,
  });

  // Teleprompter State
  const [prompterIndex, setPrompterIndex] = useState(0);
  const [showPrompter, setShowPrompter] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Set mode once when connected
  const modeSetRef = useRef(false);
  useEffect(() => {
    if (isConnected && !modeSetRef.current) {
      modeSetRef.current = true;
      setMode(AgentMode.COACH_PRACTICE, { talkingPoints });
    }
  }, [isConnected, setMode, talkingPoints]);
  
  // Start local camera for self-view
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true }).then(s => {
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
    });

    return () => {
        if (stream) stream.getTracks().forEach(t => t.stop());
    }
  }, []);

  const finishSession = () => {
    const actualElapsed = Math.floor((Date.now() - statsRef.current.startTime) / 1000);
    onEnd({
      durationSeconds: actualElapsed,
      postureScore: 85, // Mocked for this refactor as focus is on Voice AI
      eyeContactScore: 70,
      fillersCount: statsRef.current.fillers, // In a full implementation, we'd parse the transcript for fillers
      wpm: 140, 
      targetDurationSeconds: duration
    });
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          finishSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []); 

  const handlePrompterClick = () => {
      if (talkingPoints.length > 0) {
          if (prompterIndex < talkingPoints.length - 1) {
              setPrompterIndex(prev => prev + 1);
          }
      }
  };

  return (
    <FadeTransition className="flex flex-col min-h-screen p-6 relative bg-stone-50 text-stone-900">
      <div className="flex justify-between items-start w-full mb-4 z-10">
        <div className="flex flex-col gap-1">
          <div className="text-sm text-stone-500 font-mono uppercase tracking-widest">Coach Active</div>
        </div>
        <div className={`text-xl font-mono ${timeLeft <= 10 ? 'text-amber-600' : 'text-stone-900'}`}>{Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2,'0')}</div>
      </div>
      
      <div className="flex-1 flex items-center justify-center relative w-full">
        <div className="w-full aspect-video max-w-4xl bg-black rounded-sm overflow-hidden relative shadow-2xl">
          {stream && <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover transform -scale-x-100" />}
          
          {/* TELEPROMPTER OVERLAY */}
          {talkingPoints && talkingPoints.length > 0 && showPrompter && (
              <div 
                onClick={handlePrompterClick}
                className="absolute bottom-[10%] left-0 right-0 mx-auto max-w-xl bg-black/60 backdrop-blur-md p-6 rounded-lg cursor-pointer hover:bg-black/70 transition-colors border-l-4 border-emerald-500"
              >
                 <div className="space-y-4">
                     <div className="text-white text-2xl font-medium serif leading-snug">
                         {talkingPoints[prompterIndex]}
                     </div>
                     {prompterIndex < talkingPoints.length - 1 && (
                         <div className="text-white/40 text-sm truncate">
                             Next: {talkingPoints[prompterIndex + 1]}
                         </div>
                     )}
                 </div>
              </div>
          )}
        </div>
      </div>
      
      {/* Coach Feedback Floating */}
      <div className="absolute bottom-24 left-0 w-full flex justify-center pointer-events-none z-20">
        {aiResponse && <div className="bg-white/90 backdrop-blur px-8 py-4 rounded-full border border-stone-200 text-stone-900 text-lg serif italic shadow-xl animate-fade-in-up">"{aiResponse}"</div>}
      </div>

      <div className="mt-8 flex justify-between items-center z-10 w-full max-w-4xl mx-auto">
        <div className="flex items-center gap-6">
            {talkingPoints.length > 0 && (
                <button onClick={() => setShowPrompter(!showPrompter)} className="text-stone-400 hover:text-stone-900 transition-colors">
                    {showPrompter ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
            )}
        </div>
        <button onClick={finishSession} className="text-stone-900 hover:text-red-600 tracking-widest uppercase text-xs border-b border-stone-200 hover:border-red-600 pb-1 transition-all">End Session</button>
      </div>
    </FadeTransition>
  );
};
