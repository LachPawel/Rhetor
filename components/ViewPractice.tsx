
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Eye, EyeOff, MessageSquare } from 'lucide-react';
import { FadeTransition } from './FadeTransition.tsx';
import { SessionResult, AgentMode } from '../types.ts';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { useRhetorStore } from '../stores/useRhetorStore.ts';
import { createTeleprompterMatcher } from '../src/lib/teleprompter_matcher.ts';

interface ViewPracticeProps {
  onEnd: (result: SessionResult) => void;
}

const getWpmColor = (wpm: number): string => {
  if (wpm === 0) return 'text-stone-400';
  if (wpm >= 130 && wpm <= 160) return 'text-emerald-600';
  if ((wpm >= 110 && wpm < 130) || (wpm > 160 && wpm <= 180)) return 'text-amber-500';
  return 'text-red-500';
};

export const ViewPractice: React.FC<ViewPracticeProps> = ({ onEnd }) => {
  const { setMode, isConnected, isSpeaking, talkingPoints, aiResponse, lastTranscript, resetTranscript } = useRhetor();
  const startSession = useRhetorStore((s) => s.startSession);
  const endSession = useRhetorStore((s) => s.endSession);
  const liveWpm = useRhetorStore((s) => s.currentMetrics?.wpm ?? 0);
  const fillerCount = useRhetorStore((s) => s.currentMetrics?.fillerCount ?? 0);
  const recentFillerWord = useRhetorStore((s) => s.recentFillerWord);
  const setNavigationBlocked = useRhetorStore((s) => s.setNavigationBlocked);
  const suggestedDuration = useRhetorStore((s) => s.suggestedDuration);
  const [fillerFlash, setFillerFlash] = useState(false);
  const duration = suggestedDuration > 0 ? suggestedDuration : 120;
  const [timeLeft, setTimeLeft] = useState(duration);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // ── Start metrics session on mount, enable nav guard ─────────────
  useEffect(() => {
    resetTranscript();   // Clear stale transcript from previous sessions
    startSession();
    setNavigationBlocked(true);
    return () => {
      endSession();
      setNavigationBlocked(false);
    };
  }, [resetTranscript, startSession, endSession, setNavigationBlocked]);

  // ── Teleprompter matcher (auto-advance) ──────────────────────────
  const matcherRef = useRef(createTeleprompterMatcher());
  const prevTranscriptLenRef = useRef(0);
  const [allCovered, setAllCovered] = useState(false);
  
  // Flash animation when a new filler is detected
  useEffect(() => {
    if (recentFillerWord) {
      setFillerFlash(true);
      const timeout = setTimeout(() => setFillerFlash(false), 600);
      return () => clearTimeout(timeout);
    }
  }, [recentFillerWord, fillerCount]);

  // Track the last *complete* AI coach message (not streaming text)
  const [lastCoachMessage, setLastCoachMessage] = useState<string | null>(null);
  const prevSpeakingRef = useRef(isSpeaking);
  useEffect(() => {
    // When AI stops speaking (transition from speaking → not speaking), snapshot the response
    if (prevSpeakingRef.current && !isSpeaking && aiResponse) {
      setLastCoachMessage(aiResponse);
    }
    prevSpeakingRef.current = isSpeaking;
  }, [isSpeaking, aiResponse]);
  
  // Stats Ref
  const statsRef = useRef({
    startTime: Date.now(),
  });

  // Teleprompter State
  const [prompterIndex, setPrompterIndex] = useState(0);
  const [showPrompter, setShowPrompter] = useState(true);
  const [showTranscript, setShowTranscript] = useState(true);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Initialize matcher when talking points change
  useEffect(() => {
    if (talkingPoints.length > 0) {
      const matcher = createTeleprompterMatcher();
      matcherRef.current = matcher;
      matcher.setBullets(talkingPoints);
      // Snap to current transcript length so we only match NEW speech, not old session text
      const snapLen = lastTranscript?.length ?? 0;
      prevTranscriptLenRef.current = snapLen;
      setPrompterIndex(0);
      setAllCovered(false);

      console.log('[ViewPractice] Matcher initialized with', talkingPoints.length, 'bullets, transcript snap @', snapLen);

      matcher.onAdvance((newIndex: number) => {
        console.log('[ViewPractice] onAdvance →', newIndex);
        // Only advance if matcher is ahead of (or equal to) current manual position
        setPrompterIndex(prev => {
          const next = Math.max(prev, newIndex);
          if (next >= talkingPoints.length - 1) {
            setAllCovered(true);
          }
          return next;
        });
      });
    }
  }, [talkingPoints]);

  // Feed transcript delta to the matcher
  useEffect(() => {
    if (!lastTranscript) return;
    const prev = prevTranscriptLenRef.current;
    if (lastTranscript.length > prev) {
      const delta = lastTranscript.slice(prev);
      console.log('[ViewPractice] Feeding delta to matcher:', delta.length, 'chars →', JSON.stringify(delta.slice(0, 120)));
      matcherRef.current.feedTranscript(delta);
      prevTranscriptLenRef.current = lastTranscript.length;
    }
  }, [lastTranscript]);

  // Set mode when connected — reset on disconnect so it re-fires after reconnection
  const modeSetRef = useRef(false);
  useEffect(() => {
    if (isConnected && !modeSetRef.current) {
      modeSetRef.current = true;
      setMode(AgentMode.COACH_PRACTICE, { talkingPoints });
    } else if (!isConnected) {
      modeSetRef.current = false;
    }
  }, [isConnected, setMode, talkingPoints]);
  
  // Start local camera for self-view
  useEffect(() => {
    let localStream: MediaStream | null = null;
    let mounted = true;

    navigator.mediaDevices.getUserMedia({ video: true })
      .then(s => {
        if (!mounted) {
          s.getTracks().forEach(t => t.stop());
          return;
        }
        localStream = s;
        setStream(s);
      })
      .catch(console.error);

    return () => {
      mounted = false;
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Wire srcObject once the <video> element renders and stream is available
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Guard against double-firing finishSession
  const sessionEndedRef = useRef(false);

  const finishSession = useCallback(() => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    // Finalize the metrics session so endTime & duration are set
    endSession();
    const actualElapsed = Math.floor((Date.now() - statsRef.current.startTime) / 1000);
    onEnd({
      durationSeconds: actualElapsed,
      postureScore: 0,
      eyeContactScore: 0,
      fillersCount: useRhetorStore.getState().currentMetrics?.fillerCount ?? 0,
      wpm: useRhetorStore.getState().currentMetrics?.wpm ?? 0,
      targetDurationSeconds: duration
    });
  }, [onEnd, duration, endSession]);

  // Keep a ref to finishSession so the timer interval always calls the latest version
  const finishRef = useRef(finishSession);
  finishRef.current = finishSession;

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          finishRef.current();
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

  // Auto-scroll transcript to bottom as new words arrive
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lastTranscript]);

  return (
    <FadeTransition className="flex flex-col min-h-screen p-6 relative bg-stone-50 text-stone-900">
      <div className="flex justify-between items-start w-full mb-4 z-10">
        <div className="flex items-center gap-3">
          <button onClick={finishSession} className="text-stone-400 hover:text-stone-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-sm text-stone-500 font-mono uppercase tracking-widest">Coach Active</div>
        </div>
        <div className="flex items-center gap-4">
          <div
            className={`text-sm font-mono transition-colors duration-300 ${
              fillerFlash ? 'text-red-500' : fillerCount > 0 ? 'text-amber-500' : 'text-stone-400'
            }`}
          >
            <span className={`inline-block transition-transform duration-300 ${fillerFlash ? 'scale-125' : 'scale-100'}`}>
              {fillerCount > 0 ? `${fillerCount} filler${fillerCount !== 1 ? 's' : ''}` : '0 fillers'}
            </span>
          </div>
          <div className="w-px h-4 bg-stone-200" />
          <div className={`text-sm font-mono ${getWpmColor(liveWpm)}`}>{liveWpm > 0 ? `${liveWpm} wpm` : '— wpm'}</div>
          <div className={`text-xl font-mono ${timeLeft <= 10 ? 'text-amber-600' : 'text-stone-900'}`}>{Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2,'0')}</div>
        </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center relative w-full">
        <div className="w-full aspect-video max-w-4xl bg-black rounded-sm overflow-hidden relative shadow-2xl">
          {stream && <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover transform -scale-x-100" />}
          
          {/* TELEPROMPTER OVERLAY */}
          {talkingPoints && talkingPoints.length > 0 && showPrompter && (
              <div
                onClick={handlePrompterClick}
                className="absolute bottom-[10%] left-0 right-0 mx-auto max-w-xl bg-black/60 backdrop-blur-md rounded-lg cursor-pointer hover:bg-black/70 transition-colors overflow-hidden"
              >
                {/* Progress bar */}
                <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                  <span className="text-white/50 text-xs font-mono tracking-wider uppercase">
                    {Math.min(prompterIndex + (allCovered ? 1 : 0), talkingPoints.length)}/{talkingPoints.length} points covered
                  </span>
                  {allCovered && (
                    <span className="text-emerald-400 text-xs font-mono tracking-wider uppercase flex items-center gap-1">
                      <Check className="w-3 h-3" /> All points covered!
                    </span>
                  )}
                </div>

                <div className="px-5 pb-5 space-y-3">
                  {/* Completed bullets (show last completed if any) */}
                  {prompterIndex > 0 && (
                    <div className="flex items-start gap-2 text-white/30 text-sm leading-snug transition-all duration-500">
                      <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500/60" />
                      <span className="line-through decoration-white/20">
                        {talkingPoints[prompterIndex - 1]}
                      </span>
                    </div>
                  )}

                  {/* Current bullet — large & bright */}
                  <div className="flex items-start gap-2 border-l-4 border-emerald-500 pl-3 transition-all duration-500">
                    <span className="text-white text-xl font-medium serif leading-snug">
                      {talkingPoints[prompterIndex]}
                    </span>
                  </div>

                  {/* Next bullet — smaller & dimmed */}
                  {prompterIndex < talkingPoints.length - 1 && (
                    <div className="flex items-start gap-2 pl-5 transition-all duration-500">
                      <span className="text-white/35 text-sm leading-snug truncate">
                        {talkingPoints[prompterIndex + 1]}
                      </span>
                    </div>
                  )}
                </div>
              </div>
          )}
        </div>
      </div>
      
      {/* Coach Feedback Floating — only show when AI is NOT actively speaking to avoid streaming text */}
      <div className="absolute bottom-24 left-0 w-full flex justify-center pointer-events-none z-20">
        {lastCoachMessage && !isSpeaking && (
          <div className="bg-white/90 backdrop-blur px-8 py-4 rounded-full border border-stone-200 text-stone-900 text-lg serif italic shadow-xl animate-fade-in-up max-w-xl truncate">
            "{lastCoachMessage}"
          </div>
        )}
      </div>

      {/* ── LIVE TRANSCRIPT PANEL ──────────────────────────────────── */}
      {showTranscript && (
        <div className="w-full max-w-4xl mx-auto mt-4 z-10">
          <div className="bg-white/80 backdrop-blur border border-stone-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-stone-100 flex items-center justify-between">
              <span className="text-xs font-mono text-stone-400 uppercase tracking-widest">
                Live Transcript
              </span>
              <span className={`text-xs font-mono ${isConnected ? 'text-emerald-500' : 'text-red-400'}`}>
                {isConnected ? '● Connected' : '○ Connecting…'}
              </span>
            </div>
            <div className="px-4 py-3 max-h-32 overflow-y-auto text-sm text-stone-700 leading-relaxed">
              {lastTranscript ? (
                <p>{lastTranscript}</p>
              ) : (
                <p className="text-stone-300 italic">Start speaking — your words will appear here…</p>
              )}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 flex justify-between items-center z-10 w-full max-w-4xl mx-auto">
        <div className="flex items-center gap-6">
            {talkingPoints.length > 0 && (
                <button onClick={() => setShowPrompter(!showPrompter)} className="text-stone-400 hover:text-stone-900 transition-colors" title="Toggle prompter">
                    {showPrompter ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
            )}
            <button onClick={() => setShowTranscript(!showTranscript)} className={`transition-colors ${showTranscript ? 'text-stone-900' : 'text-stone-400 hover:text-stone-900'}`} title="Toggle transcript">
                <MessageSquare className="w-4 h-4" />
            </button>
        </div>
        <button onClick={finishSession} className="text-stone-900 hover:text-red-600 tracking-widest uppercase text-xs border-b border-stone-200 hover:border-red-600 pb-1 transition-all">End Session</button>
      </div>
    </FadeTransition>
  );
};
