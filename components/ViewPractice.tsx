import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  MessageSquare,
} from 'lucide-react';
import { FadeTransition } from './FadeTransition.tsx';
import { SessionResult, AgentMode } from '../types.ts';
import { useRhetor } from '../contexts/RhetorContext.tsx';
import { useRhetorStore } from '../stores/useRhetorStore.ts';
import { createTeleprompterMatcher } from '../src/lib/teleprompter_matcher.ts';
import {
  buildDeckPreviewUrl,
  isImageDeck,
  isPowerPointDeck,
  isPptxDeck,
  isPdfDeck,
  renderPptxSlidesFromBuffer,
} from '../lib/pitch_deck.ts';
import { PostureDetector, PostureFrame } from '../lib/posture_detector.ts';
import { PostureSkeleton } from './PostureSkeleton.tsx';

interface ViewPracticeProps {
  onEnd: (result: SessionResult) => void;
}

const getWpmColor = (wpm: number): string => {
  if (wpm === 0) return 'text-stone-400';
  if (wpm >= 130 && wpm <= 160) return 'text-emerald-600';
  if ((wpm >= 110 && wpm < 130) || (wpm > 160 && wpm <= 180)) return 'text-amber-500';
  return 'text-red-500';
};

const snapPreviewDimension = (value: number): number => {
  const snapped = Math.round(value / 4) * 4;
  return Math.max(1, snapped);
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

  const pitchDeck = useRhetorStore((s) => s.pitchDeck);
  const currentDeckSlide = useRhetorStore((s) => s.currentDeckSlide);
  const setCurrentDeckSlide = useRhetorStore((s) => s.setCurrentDeckSlide);

  const [deckError, setDeckError] = useState<string | null>(null);
  const [fillerFlash, setFillerFlash] = useState(false);
  const duration = suggestedDuration > 0 ? suggestedDuration : 120;
  const [timeLeft, setTimeLeft] = useState(duration);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const pptxPreviewRef = useRef<HTMLDivElement>(null);
  const pptxBufferCacheRef = useRef(new Map<string, ArrayBuffer>());
  const [pptxViewport, setPptxViewport] = useState({ width: 0, height: 0 });
  const [renderedPptxHtmlSlides, setRenderedPptxHtmlSlides] = useState<string[]>([]);
  const [isPptxRendering, setIsPptxRendering] = useState(false);

  const hasDeck = Boolean(pitchDeck);
  const isDeckPdf = isPdfDeck(pitchDeck);
  const isDeckImage = isImageDeck(pitchDeck);
  const isDeckPowerPoint = isPowerPointDeck(pitchDeck);
  const isDeckPptx = isPptxDeck(pitchDeck);
  const pptxTextSlides = isDeckPptx ? pitchDeck?.slideTexts ?? [] : [];
  const cachedPptxHtmlSlides = isDeckPptx ? pitchDeck?.slideHtml ?? [] : [];
  const activePptxHtmlSlides = renderedPptxHtmlSlides.length > 0 ? renderedPptxHtmlSlides : cachedPptxHtmlSlides;
  const pptxSlideCount = Math.max(
    pitchDeck?.totalSlides ?? 0,
    activePptxHtmlSlides.length,
    pptxTextSlides.length,
  );
  const currentPptxSlideIndex = Math.max(0, Math.min(currentDeckSlide, Math.max(pptxSlideCount, 1)) - 1);
  const maxDeckSlide = isDeckPdf
    ? pitchDeck?.totalSlides ?? null
    : isDeckPptx
      ? (pptxSlideCount > 0 ? pptxSlideCount : null)
      : null;
  const canGoToNextSlide =
    (isDeckPdf && (maxDeckSlide ? currentDeckSlide < maxDeckSlide : true)) ||
    (isDeckPptx && maxDeckSlide !== null && currentDeckSlide < maxDeckSlide);
  const canGoToPrevSlide = (isDeckPdf || isDeckPptx) && currentDeckSlide > 1;
  const layoutMaxWidthClass = hasDeck ? 'max-w-7xl' : 'max-w-4xl';

  const deckPreviewUrl = useMemo(() => {
    if (!pitchDeck) return '';
    return buildDeckPreviewUrl(pitchDeck, currentDeckSlide);
  }, [pitchDeck, currentDeckSlide]);

  const jumpToSlide = useCallback(
    (slideNumber: number) => {
      if (!pitchDeck || (!isDeckPdf && !isDeckPptx)) return;
      const upperBound = maxDeckSlide ?? (isDeckPdf ? Number.POSITIVE_INFINITY : 1);
      const nextSlide = Math.max(1, Math.min(Math.floor(slideNumber), upperBound));
      setCurrentDeckSlide(nextSlide);
    },
    [pitchDeck, isDeckPdf, isDeckPptx, maxDeckSlide, setCurrentDeckSlide],
  );

  useEffect(() => {
    setRenderedPptxHtmlSlides([]);
    setIsPptxRendering(false);
  }, [pitchDeck?.objectUrl]);

  useEffect(() => {
    if (!isDeckPptx) return;
    const target = pptxPreviewRef.current;
    if (!target) return;

    const updateViewport = (width: number, height: number) => {
      const nextWidth = snapPreviewDimension(width);
      const nextHeight = snapPreviewDimension(height);
      setPptxViewport((prev) => {
        if (prev.width === nextWidth && prev.height === nextHeight) {
          return prev;
        }
        return { width: nextWidth, height: nextHeight };
      });
    };

    updateViewport(target.clientWidth, target.clientHeight);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      updateViewport(entry.contentRect.width, entry.contentRect.height);
    });

    observer.observe(target);
    return () => observer.disconnect();
  }, [isDeckPptx, pitchDeck?.objectUrl]);

  useEffect(() => {
    if (!isDeckPptx || !pitchDeck?.objectUrl) return;
    if (pptxViewport.width <= 0 || pptxViewport.height <= 0) return;

    let cancelled = false;

    const renderForViewport = async () => {
      setIsPptxRendering(true);
      try {
        let raw = pptxBufferCacheRef.current.get(pitchDeck.objectUrl);
        if (!raw) {
          const response = await fetch(pitchDeck.objectUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch uploaded PPTX (${response.status})`);
          }
          raw = await response.arrayBuffer();
          pptxBufferCacheRef.current.set(pitchDeck.objectUrl, raw);
        }

        const slides = await renderPptxSlidesFromBuffer(raw, {
          width: pptxViewport.width,
          height: pptxViewport.height,
          scaleToFit: true,
          letterbox: true,
        });

        if (cancelled) return;
        setRenderedPptxHtmlSlides(slides ?? []);
      } catch (error) {
        if (!cancelled) {
          console.error('[ViewPractice] Could not render PPTX for preview viewport:', error);
          setRenderedPptxHtmlSlides([]);
        }
      } finally {
        if (!cancelled) {
          setIsPptxRendering(false);
        }
      }
    };

    void renderForViewport();

    return () => {
      cancelled = true;
    };
  }, [isDeckPptx, pitchDeck?.objectUrl, pptxViewport.width, pptxViewport.height]);

  useEffect(() => {
    if (!pitchDeck || (!isDeckPdf && !isDeckPptx)) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        jumpToSlide(currentDeckSlide - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        jumpToSlide(currentDeckSlide + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pitchDeck, isDeckPdf, isDeckPptx, currentDeckSlide, jumpToSlide]);

  // ── Posture detection state ──────────────────────────────────
  const postureDetectorRef = useRef<PostureDetector | null>(null);
  const [postureFrame, setPostureFrame] = useState<PostureFrame | null>(null);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [postureReady, setPostureReady] = useState(false);
  const postureScoresRef = useRef<number[]>([]);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });

  // ── Start metrics session on mount, enable nav guard ─────────────
  useEffect(() => {
    resetTranscript(); // Clear stale transcript from previous sessions
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
    // When AI stops speaking (transition from speaking -> not speaking), snapshot the response
    if (prevSpeakingRef.current && !isSpeaking && aiResponse) {
      // Strip any ctrl tokens that may have leaked through
      const clean = aiResponse.replace(/<\/?ctrl\d+>/gi, '').trim();
      setLastCoachMessage(clean || null);
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
        console.log('[ViewPractice] onAdvance ->', newIndex);
        // Only advance if matcher is ahead of (or equal to) current manual position
        setPrompterIndex((prev) => {
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
      console.log('[ViewPractice] Feeding delta to matcher:', delta.length, 'chars ->', JSON.stringify(delta.slice(0, 120)));
      matcherRef.current.feedTranscript(delta);
      prevTranscriptLenRef.current = lastTranscript.length;
    }
  }, [lastTranscript]);

  // Set mode when connected - reset on disconnect so it re-fires after reconnection
  const modeSetRef = useRef(false);
  useEffect(() => {
    if (isConnected && !modeSetRef.current) {
      modeSetRef.current = true;
      setMode(AgentMode.COACH_PRACTICE, {
        talkingPoints,
        pitchDeck: pitchDeck
          ? {
              fileName: pitchDeck.fileName,
              totalSlides: pitchDeck.totalSlides,
              currentSlide: currentDeckSlide,
            }
          : undefined,
      });
    } else if (!isConnected) {
      modeSetRef.current = false;
    }
  }, [isConnected, setMode, talkingPoints, pitchDeck, currentDeckSlide]);

  // Start local camera for self-view
  useEffect(() => {
    let localStream: MediaStream | null = null;
    let mounted = true;

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((s) => {
        if (!mounted) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        localStream = s;
        setStream(s);
      })
      .catch(console.error);

    return () => {
      mounted = false;
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Wire srcObject once the <video> element renders and stream is available
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // ── Posture detector lifecycle (deferred until Gemini is connected) ──
  useEffect(() => {
    // Wait until the AI connection + mic are established before loading
    // TensorFlow.js — the heavy GPU init can interfere with audio setup.
    if (!isConnected) return;

    let cancelled = false;
    const detector = new PostureDetector({
      intervalMs: 300,
      minKeypointScore: 0.3,
      onFrame: (frame: PostureFrame) => {
        if (cancelled) return;
        setPostureFrame(frame);
        postureScoresRef.current.push(frame.score);
      },
    });
    postureDetectorRef.current = detector;

    // Extra 2 s delay so the mic/audio pipeline is fully warmed up
    const initTimer = setTimeout(() => {
      if (cancelled) return;
      detector.init().then(() => {
        if (cancelled) return;
        setPostureReady(true);
        console.log('[ViewPractice] PostureDetector ready');
      }).catch((err) => {
        console.warn('[ViewPractice] PostureDetector init failed:', err);
      });
    }, 2000);

    return () => {
      cancelled = true;
      clearTimeout(initTimer);
      detector.dispose();
    };
  }, [isConnected]);   // only fire once connection is up

  // Start posture detection once both detector and video are ready
  useEffect(() => {
    if (!postureReady || !videoRef.current || !stream) return;
    const video = videoRef.current;

    const tryStart = () => {
      if (video.readyState >= 2 && postureDetectorRef.current?.ready) {
        // Capture intrinsic video dimensions for canvas sizing
        setVideoDimensions({ width: video.videoWidth, height: video.videoHeight });
        postureDetectorRef.current.start(video);
      }
    };

    if (video.readyState >= 2) {
      tryStart();
    } else {
      video.addEventListener('loadeddata', tryStart, { once: true });
    }

    return () => {
      postureDetectorRef.current?.stop();
      video.removeEventListener('loadeddata', tryStart);
    };
  }, [postureReady, stream]);

  // Guard against double-firing finishSession
  const sessionEndedRef = useRef(false);

  const finishSession = useCallback(() => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    // Finalize the metrics session so endTime & duration are set
    endSession();
    const actualElapsed = Math.floor((Date.now() - statsRef.current.startTime) / 1000);
    // Compute average posture score over the session
    const scores = postureScoresRef.current;
    const avgPosture = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
    onEnd({
      durationSeconds: actualElapsed,
      postureScore: avgPosture,
      eyeContactScore: 0,
      fillersCount: useRhetorStore.getState().currentMetrics?.fillerCount ?? 0,
      wpm: useRhetorStore.getState().currentMetrics?.wpm ?? 0,
      targetDurationSeconds: duration,
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
        setPrompterIndex((prev) => prev + 1);
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
          <div className="w-px h-4 bg-stone-200" />
          <div className={`text-sm font-mono ${
            postureFrame
              ? (postureFrame.calibrating ? 'text-stone-400' : postureFrame.score >= 80 ? 'text-emerald-600' : postureFrame.score >= 50 ? 'text-amber-500' : 'text-red-500')
              : 'text-stone-400'
          }`}>
            {postureFrame
              ? (postureFrame.calibrating
                ? `Calibrating… ${postureFrame.calibrationProgress}/40`
                : `${postureFrame.score}% posture`)
              : (postureReady ? 'Detecting…' : 'Loading AI…')}
          </div>
          <div className={`text-xl font-mono ${timeLeft <= 10 ? 'text-amber-600' : 'text-stone-900'}`}>
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center relative w-full">
        <div
          className={
            hasDeck
              ? `w-full ${layoutMaxWidthClass} mx-auto grid grid-cols-1 xl:grid-cols-2 gap-4 xl:gap-6`
              : `w-full ${layoutMaxWidthClass} mx-auto`
          }
        >
          <div className="w-full aspect-video bg-black rounded-sm overflow-hidden relative shadow-2xl">
            {stream && (
              <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover transform -scale-x-100" />
            )}

            {/* POSTURE SKELETON OVERLAY */}
            {showSkeleton && postureFrame && videoDimensions.width > 0 && (
              <PostureSkeleton
                keypoints={postureFrame.keypoints}
                videoWidth={videoDimensions.width}
                videoHeight={videoDimensions.height}
                score={postureFrame.score}
              />
            )}

            {/* POSTURE TIP / CALIBRATION BADGE */}
            {postureFrame?.calibrating && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-black/60 backdrop-blur-sm text-white/70 text-xs font-mono px-4 py-1.5 rounded-full tracking-wider">
                Hold good posture — calibrating…
              </div>
            )}
            {!postureFrame?.calibrating && postureFrame?.tip && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-black/70 backdrop-blur-sm text-white text-xs font-mono px-4 py-1.5 rounded-full tracking-wider animate-pulse">
                {postureFrame.tip}
              </div>
            )}

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
                      <span className="line-through decoration-white/20">{talkingPoints[prompterIndex - 1]}</span>
                    </div>
                  )}

                  {/* Current bullet — large & bright */}
                  <div className="flex items-start gap-2 border-l-4 border-emerald-500 pl-3 transition-all duration-500">
                    <span className="text-white text-xl font-medium serif leading-snug">{talkingPoints[prompterIndex]}</span>
                  </div>

                  {/* Next bullet — smaller & dimmed */}
                  {prompterIndex < talkingPoints.length - 1 && (
                    <div className="flex items-start gap-2 pl-5 transition-all duration-500">
                      <span className="text-white/35 text-sm leading-snug truncate">{talkingPoints[prompterIndex + 1]}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {hasDeck && pitchDeck && (
            <div className="w-full aspect-video rounded-sm overflow-hidden border border-stone-200 bg-white shadow-2xl relative">
              <div className="absolute top-0 left-0 right-0 z-10 px-3 py-2 bg-black/70 text-white flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-widest text-white/70">Deck Preview</div>
                  <div className="text-xs truncate">{pitchDeck.fileName}</div>
                </div>
                <div className="text-xs font-mono text-white/90 shrink-0">
                  {isDeckPdf
                    ? `${currentDeckSlide}${pitchDeck.totalSlides ? `/${pitchDeck.totalSlides}` : ''}`
                    : isDeckImage
                      ? 'Image'
                      : isDeckPptx
                        ? `${currentDeckSlide}${maxDeckSlide ? `/${maxDeckSlide}` : ''}`
                        : 'File'}
                </div>
              </div>

              <div className="absolute inset-0 pt-11 pb-12 bg-stone-100">
                {isDeckPdf ? (
                  <iframe
                    title="Pitch deck preview"
                    src={deckPreviewUrl}
                    className="w-full h-full border-0 bg-white"
                    loading="eager"
                  />
                ) : isDeckImage ? (
                  <img src={pitchDeck.objectUrl} alt="Pitch deck slide" className="w-full h-full object-contain bg-white" />
                ) : isDeckPptx ? (
                  <div ref={pptxPreviewRef} className="w-full h-full relative overflow-hidden bg-black">
                    {activePptxHtmlSlides.length > 0 ? (
                      <div
                        className="w-full h-full"
                        // HTML is generated locally from the uploaded file.
                        dangerouslySetInnerHTML={{ __html: activePptxHtmlSlides[currentPptxSlideIndex] ?? '' }}
                      />
                    ) : pptxTextSlides.length > 0 ? (
                      <div className="w-full h-full flex flex-col text-left overflow-y-auto px-6 py-4 bg-white text-sm text-stone-500">
                        <div className="text-[11px] uppercase tracking-widest text-stone-400 mb-3">Slide {currentPptxSlideIndex + 1}</div>
                        {pptxTextSlides[currentPptxSlideIndex]
                          ?.split('\n')
                          .map((line) => line.trim())
                          .filter((line) => line.length > 0)
                          .map((line, index) => (
                            <p key={`${line}-${index}`} className="text-sm leading-relaxed text-stone-700 mb-2">
                              {line}
                            </p>
                          ))}
                        {!pptxTextSlides[currentPptxSlideIndex] && (
                          <p className="text-sm text-stone-400 italic">No text detected on this slide.</p>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-center gap-4 px-6 text-sm text-stone-500 bg-white">
                        <p>Could not parse this PPTX for inline preview.</p>
                        <a
                          href={pitchDeck.objectUrl}
                          target="_blank"
                          rel="noreferrer"
                          download={pitchDeck.fileName}
                          className="px-3 py-1.5 rounded border border-stone-300 text-stone-700 hover:border-stone-500 transition-colors"
                        >
                          Open / Download {pitchDeck.fileName}
                        </a>
                      </div>
                    )}
                    {isPptxRendering && activePptxHtmlSlides.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/35 text-white/80 text-xs font-mono tracking-wide">
                        Rendering slide preview…
                      </div>
                    )}
                  </div>
                ) : isDeckPowerPoint ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center gap-4 px-6 text-sm text-stone-500 bg-white">
                    <p>Legacy .ppt files cannot be parsed for inline preview. Save as .pptx for slide preview.</p>
                    <a
                      href={pitchDeck.objectUrl}
                      target="_blank"
                      rel="noreferrer"
                      download={pitchDeck.fileName}
                      className="px-3 py-1.5 rounded border border-stone-300 text-stone-700 hover:border-stone-500 transition-colors"
                    >
                      Open / Download {pitchDeck.fileName}
                    </a>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-center px-6 text-sm text-stone-500 bg-white">
                    This file cannot be previewed inline.
                  </div>
                )}
              </div>

              <div className="absolute bottom-0 left-0 right-0 z-10 px-3 py-2 bg-black/70 text-white flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => jumpToSlide(currentDeckSlide - 1)}
                    disabled={!canGoToPrevSlide}
                    className="p-1 rounded border border-white/25 hover:border-white/50 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Previous slide"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => jumpToSlide(currentDeckSlide + 1)}
                    disabled={!canGoToNextSlide}
                    className="p-1 rounded border border-white/25 hover:border-white/50 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Next slide"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-[11px] uppercase tracking-widest text-white/70">
                  {isDeckPdf || isDeckPptx ? 'Use Left/Right keys' : 'Single slide'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {deckError && (
        <div className={`w-full ${layoutMaxWidthClass} mx-auto mt-3 text-xs text-rose-600`}>{deckError}</div>
      )}

      {/* Coach Feedback Floating — positioned between video and transcript */}
      {lastCoachMessage && !isSpeaking && (
        <div className={`w-full ${layoutMaxWidthClass} mx-auto mt-3 flex justify-center z-10`}>
          <div className="bg-white/90 backdrop-blur px-6 py-3 rounded-full border border-stone-200 text-stone-900 text-base serif italic shadow-lg max-w-xl truncate">
            "{lastCoachMessage}"
          </div>
        </div>
      )}

      {/* ── LIVE TRANSCRIPT PANEL ──────────────────────────────────── */}
      {showTranscript && (
        <div className={`w-full ${layoutMaxWidthClass} mx-auto mt-4 z-10`}>
          <div className="bg-white/80 backdrop-blur border border-stone-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-stone-100 flex items-center justify-between">
              <span className="text-xs font-mono text-stone-400 uppercase tracking-widest">Live Transcript</span>
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

      <div className={`mt-8 flex justify-between items-center z-10 w-full ${layoutMaxWidthClass} mx-auto`}>
        <div className="flex items-center gap-6">
          {talkingPoints.length > 0 && (
            <button
              onClick={() => setShowPrompter(!showPrompter)}
              className="text-stone-400 hover:text-stone-900 transition-colors"
              title="Toggle prompter"
            >
              {showPrompter ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className={`transition-colors ${showTranscript ? 'text-stone-900' : 'text-stone-400 hover:text-stone-900'}`}
            title="Toggle transcript"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowSkeleton(!showSkeleton)}
            className={`transition-colors ${showSkeleton ? 'text-emerald-600' : 'text-stone-400 hover:text-stone-900'}`}
            title="Toggle posture skeleton"
          >
            <Activity className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={finishSession}
          className="text-stone-900 hover:text-red-600 tracking-widest uppercase text-xs border-b border-stone-200 hover:border-red-600 pb-1 transition-all"
        >
          End Session
        </button>
      </div>
    </FadeTransition>
  );
};
