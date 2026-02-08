/**
 * Rhetor - AI-Powered Pitch Coaching PWA
 * 
 * Main application component with Zustand state management,
 * Gemini Live AI integration, and gamification.
 */

import React, { useState, useEffect, useCallback, useRef, Component, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Wifi, WifiOff, RefreshCw } from 'lucide-react';

// Views
import { ViewHome } from './components/ViewHome';
import { ViewAgora } from './components/ViewAgora';
import { ViewSymposium } from './components/ViewSymposium';
import { ViewProfile } from './components/ViewProfile';
import { ViewLesson } from './components/ViewLesson';
import { ViewWarmUp } from './components/ViewWarmUp';
import { ViewInput } from './components/ViewInput';
import { ViewPrep } from './components/ViewPrep';
import { ViewPractice } from './components/ViewPractice';
import { ViewReview } from './components/ViewReview';
import { ViewKillFillers } from './components/ViewKillFillers';
import { ViewPaceController } from './components/ViewPaceController';
import { BottomNav } from './components/BottomNav';
import { AIStatusOrb } from './components/AIStatusOrb';

// Types and State
import { AppView, type Lesson, type PitchOption, type SessionResult } from './types';
import { useRhetorStore } from './stores/useRhetorStore';
import { useRhetorContext, RhetorProvider } from './lib/useRhetor';
import { getToolHandler } from './lib/tool_handler';
import { lessons as academyLessons } from './src/data/lessons';

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-stone-50 text-stone-900 p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-600 mb-4" />
          <h2 className="font-serif text-xl font-medium mb-2">Something went wrong</h2>
          <p className="text-stone-600 text-sm mb-6 max-w-md">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children || null;
  }
}

// ============================================================================
// CONNECTION STATUS BAR
// ============================================================================

interface ConnectionStatusBarProps {
  status: string;
  onReconnect: () => void;
}

function ConnectionStatusBar({ status, onReconnect }: ConnectionStatusBarProps) {
  if (status === 'connected') return null;

  const statusConfig = {
    disconnected: { icon: WifiOff, text: 'Disconnected', color: 'bg-stone-500' },
    connecting: { icon: Wifi, text: 'Connecting...', color: 'bg-amber-500' },
    reconnecting: { icon: RefreshCw, text: 'Reconnecting...', color: 'bg-amber-500' },
    error: { icon: AlertTriangle, text: 'Connection Error', color: 'bg-red-500' },
    closed: { icon: WifiOff, text: 'Session Ended', color: 'bg-stone-500' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.disconnected;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -50, opacity: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 ${config.color} text-white px-4 py-2 flex items-center justify-between text-sm`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${status === 'reconnecting' ? 'animate-spin' : ''}`} />
        <span>{config.text}</span>
      </div>
      {(status === 'error' || status === 'disconnected') && (
        <button
          onClick={onReconnect}
          className="px-3 py-1 bg-white/20 rounded hover:bg-white/30 transition-colors"
        >
          Reconnect
        </button>
      )}
    </motion.div>
  );
}

// ============================================================================
// CELEBRATION OVERLAY
// ============================================================================

function CelebrationOverlay() {
  const celebrationPending = useRhetorStore(s => s.celebrationPending);
  const clearCelebration = useRhetorStore(s => s.clearCelebration);

  useEffect(() => {
    if (celebrationPending) {
      const timer = setTimeout(clearCelebration, 3000);
      return () => clearTimeout(timer);
    }
  }, [celebrationPending, clearCelebration]);

  if (!celebrationPending) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 pointer-events-none z-40 flex items-center justify-center"
    >
      {celebrationPending === 'confetti' && (
        <div className="text-6xl animate-bounce">🎉</div>
      )}
      {celebrationPending === 'coins' && (
        <div className="text-6xl animate-bounce">💰</div>
      )}
      {celebrationPending === 'stars' && (
        <div className="text-6xl animate-bounce">⭐</div>
      )}
      {celebrationPending === 'achievement' && (
        <div className="text-6xl animate-bounce">🏆</div>
      )}
      {celebrationPending === 'streak' && (
        <div className="text-6xl animate-bounce">🔥</div>
      )}
    </motion.div>
  );
}

// ============================================================================
// FEEDBACK TOAST
// ============================================================================

function FeedbackToast() {
  const feedbackPending = useRhetorStore(s => s.feedbackPending);
  const clearFeedback = useRhetorStore(s => s.clearFeedback);

  useEffect(() => {
    if (feedbackPending) {
      const timer = setTimeout(clearFeedback, 3000);
      return () => clearTimeout(timer);
    }
  }, [feedbackPending, clearFeedback]);

  if (!feedbackPending) return null;

  const typeStyles = {
    positive: 'bg-emerald-500 text-white',
    improvement: 'bg-amber-500 text-white',
    warning: 'bg-orange-500 text-white',
    filler_alert: 'bg-rose-400 text-white',
    pace_alert: 'bg-blue-500 text-white',
    posture_alert: 'bg-purple-500 text-white',
  };

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 50, opacity: 0 }}
      className={`fixed bottom-24 left-4 right-4 z-40 ${typeStyles[feedbackPending.type as keyof typeof typeStyles] || 'bg-slate-600 text-white'} px-4 py-3 rounded-lg shadow-lg`}
    >
      <p className="text-sm font-medium">{feedbackPending.message}</p>
    </motion.div>
  );
}

// ============================================================================
// FILLER INDICATOR
// ============================================================================

function FillerIndicator() {
  const recentFillerWord = useRhetorStore(s => s.recentFillerWord);

  if (!recentFillerWord) return null;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      className="fixed top-20 right-4 z-30 bg-rose-100 border border-rose-300 text-rose-700 px-3 py-1 rounded-full text-sm font-medium"
    >
      "{recentFillerWord}"
    </motion.div>
  );
}

// ============================================================================
// NAVIGATION CONFIRMATION MODAL
// ============================================================================

function NavigationConfirmModal() {
  const pendingNavigation = useRhetorStore(s => s.pendingNavigation);
  const confirmNavigation = useRhetorStore(s => s.confirmNavigation);
  const cancelNavigation = useRhetorStore(s => s.cancelNavigation);

  if (!pendingNavigation) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl"
      >
        <h3 className="font-serif text-lg font-medium mb-2">Leave Session?</h3>
        <p className="text-stone-600 text-sm mb-6">
          You're in an active session. Are you sure you want to leave?
        </p>
        <div className="flex gap-3">
          <button
            onClick={cancelNavigation}
            className="flex-1 px-4 py-2 border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50"
          >
            Stay
          </button>
          <button
            onClick={confirmNavigation}
            className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
          >
            Leave
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// MAIN APP CONTENT
// ============================================================================

function AppContent() {
  // Use the context provided by RhetorProvider — do NOT call useRhetor() here,
  // that would create a second client that destroys the provider's client.
  const rhetor = useRhetorContext();

  // Local view state (will be synced with store)
  const [localView, setLocalView] = useState<AppView>(AppView.HOME);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [selectedPitch, setSelectedPitch] = useState<PitchOption | null>(null);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const [warmupJustCompleted, setWarmupJustCompleted] = useState(false);

  // Zustand store
  const storeView = useRhetorStore(s => s.currentView);
  const navigate = useRhetorStore(s => s.navigate);
  const clearSession = useRhetorStore(s => s.clearSession);
  const addSessionToHistory = useRhetorStore(s => s.addSessionToHistory);

  // Sync store view with local view
  useEffect(() => {
    const viewMap: Record<string, AppView> = {
      HOME: AppView.HOME,
      AGORA: AppView.AGORA,
      SYMPOSIUM: AppView.SYMPOSIUM,
      PROFILE: AppView.PROFILE,
      WARMUP: AppView.WARMUP,
      INPUT: AppView.INPUT,
      PREP: AppView.PREP,
      PRACTICE: AppView.PRACTICE,
      REVIEW: AppView.REVIEW,
      LESSON: AppView.LESSON,
      KILL_FILLERS: AppView.KILL_FILLERS,
      PACE_CONTROLLER: AppView.PACE_CONTROLLER,
    };
    
    if (viewMap[storeView] !== undefined && viewMap[storeView] !== localView) {
      setLocalView(viewMap[storeView]);
    }
  }, [storeView, localView]);

  // Handle view changes
  const handleViewChange = useCallback((view: AppView) => {
    setLocalView(view);
    navigate(AppView[view]);
  }, [navigate]);

  // Full screen modes hide the bottom nav
  const isFullScreen = [
    AppView.WARMUP,
    AppView.INPUT,
    AppView.PREP,
    AppView.PRACTICE,
    AppView.REVIEW,
    AppView.LESSON,
    AppView.KILL_FILLERS,
    AppView.PACE_CONTROLLER,
  ].includes(localView);

  // Handlers
  const handleLessonSelect = useCallback((lesson: Lesson) => {
    // Special: interactive game lessons
    if (lesson.id === 'kill-the-fillers') {
      handleViewChange(AppView.KILL_FILLERS);
      return;
    }
    if (lesson.id === 'pace-controller') {
      handleViewChange(AppView.PACE_CONTROLLER);
      return;
    }
    setActiveLesson(lesson);
    handleViewChange(AppView.LESSON);
    
    // Set AI mode to lesson coach
    rhetor.setMode('coach_lesson', {
      lesson: {
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        pillar: lesson.pillarId,
      },
      stepNumber: 0,
    });
  }, [handleViewChange, rhetor]);

  const handleStartLessonById = useCallback((lessonId: string) => {
    // Special: interactive game lessons
    if (lessonId === 'kill-the-fillers') {
      handleViewChange(AppView.KILL_FILLERS);
      return;
    }
    if (lessonId === 'pace-controller') {
      handleViewChange(AppView.PACE_CONTROLLER);
      return;
    }
    const found = academyLessons.find(l => l.id === lessonId);
    if (!found) return;
    const legacy: Lesson = {
      id: found.id,
      pillarId: found.pillar,
      title: found.title,
      description: found.description,
      type: 'LESSON',
      reward: found.drachmas,
      durationMinutes: Math.ceil(found.duration / 60),
    };
    handleLessonSelect(legacy);
  }, [handleLessonSelect]);

  const handleNextLesson = useCallback((lesson: Lesson) => {
    setActiveLesson(lesson);
    rhetor.setMode('coach_lesson', {
      lesson: {
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        pillar: lesson.pillarId,
      },
      stepNumber: 0,
    });
  }, [rhetor]);

  const handleLessonExit = useCallback(() => {
    setActiveLesson(null);
    handleViewChange(AppView.AGORA);
    rhetor.setMode('welcomer');
  }, [handleViewChange, rhetor]);

  const handleKillFillersExit = useCallback(() => {
    handleViewChange(AppView.AGORA);
    rhetor.setMode('welcomer');
  }, [handleViewChange, rhetor]);

  const handlePaceControllerExit = useCallback(() => {
    handleViewChange(AppView.AGORA);
    rhetor.setMode('welcomer');
  }, [handleViewChange, rhetor]);

  const handlePracticeEnd = useCallback((result: SessionResult) => {
    setSessionResult(result);
    // Save to session history
    const topic = useRhetorStore.getState().pitchTopic || 'Freestyle';
    addSessionToHistory({
      timestamp: Date.now(),
      topic,
      durationSeconds: result.durationSeconds,
      score: Math.max(0, Math.min(100, Math.round(100 - result.fillersCount * 5))),
    });
    handleViewChange(AppView.REVIEW);
    // Note: ViewReview handles setMode(ANALYST) with context data
  }, [handleViewChange, addSessionToHistory]);

  const handleWarmupComplete = useCallback(() => {
    setWarmupJustCompleted(true);
    handleViewChange(AppView.HOME);
  }, [handleViewChange]);

  const handleWarmupExit = useCallback(() => {
    handleViewChange(AppView.HOME);
    rhetor.setMode('welcomer');
  }, [handleViewChange, rhetor]);

  // Set welcomer mode when on home - only once when connected
  const welcomerSetRef = useRef(false);
  useEffect(() => {
    if (localView === AppView.HOME && rhetor.isConnected && !welcomerSetRef.current) {
      welcomerSetRef.current = true;
      rhetor.setMode('welcomer');
    }
    // Reset the ref when leaving home
    if (localView !== AppView.HOME) {
      welcomerSetRef.current = false;
    }
  }, [localView, rhetor.isConnected, rhetor.setMode]);

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-stone-200 overflow-hidden relative">
      {/* Connection Status */}
      <AnimatePresence>
        <ConnectionStatusBar
          status={rhetor.connectionStatus}
          onReconnect={rhetor.reconnect}
        />
      </AnimatePresence>

      {/* AI Status Orb */}
      <AIStatusOrb />

      {/* Celebration Overlay */}
      <AnimatePresence>
        <CelebrationOverlay />
      </AnimatePresence>

      {/* Feedback Toast */}
      <AnimatePresence>
        <FeedbackToast />
      </AnimatePresence>

      {/* Filler Indicator */}
      <AnimatePresence>
        <FillerIndicator />
      </AnimatePresence>

      {/* Navigation Confirmation */}
      <AnimatePresence>
        <NavigationConfirmModal />
      </AnimatePresence>

      {/* Warm-up Completion Choice */}
      <AnimatePresence>
        {warmupJustCompleted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-xl p-8 max-w-sm w-full shadow-xl text-center"
            >
              <div className="text-4xl mb-4">✨</div>
              <h3 className="font-serif text-xl font-medium mb-2">Ready to speak?</h3>
              <p className="text-stone-500 text-sm mb-6">
                Your warm-up is complete. What would you like to do next?
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setWarmupJustCompleted(false);
                    handleViewChange(AppView.INPUT);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-slate-700 text-white rounded-lg font-medium text-sm hover:bg-slate-800 transition-colors"
                >
                  📝 Prepare Content
                </button>
                <button
                  onClick={() => {
                    setWarmupJustCompleted(false);
                    handleViewChange(AppView.PRACTICE);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 border border-stone-300 text-stone-700 rounded-lg font-medium text-sm hover:bg-stone-50 transition-colors"
                >
                  🎤 Quick Practice
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Views */}
      <AnimatePresence mode="wait">
        {/* Tab Views */}
        {localView === AppView.HOME && (
          <ViewHome key="home" onChangeView={handleViewChange} onStartLesson={handleStartLessonById} />
        )}
        {localView === AppView.AGORA && (
          <ViewAgora key="agora" onSelectLesson={handleLessonSelect} />
        )}
        {localView === AppView.SYMPOSIUM && (
          <ViewSymposium key="symposium" />
        )}
        {localView === AppView.PROFILE && (
          <ViewProfile key="profile" />
        )}

        {/* Full Screen Views */}
        {localView === AppView.LESSON && activeLesson && (
          <ViewLesson
            key="lesson"
            lesson={activeLesson}
            onExit={handleLessonExit}
            onNextLesson={handleNextLesson}
          />
        )}

        {localView === AppView.KILL_FILLERS && (
          <ViewKillFillers
            key="kill-fillers"
            onExit={handleKillFillersExit}
          />
        )}

        {localView === AppView.PACE_CONTROLLER && (
          <ViewPaceController
            key="pace-controller"
            onExit={handlePaceControllerExit}
          />
        )}

        {localView === AppView.WARMUP && (
          <ViewWarmUp
            key="warmup"
            onComplete={handleWarmupComplete}
            onExit={handleWarmupExit}
          />
        )}

        {localView === AppView.INPUT && (
          <ViewInput
            key="input"
            onChangeView={handleViewChange}
          />
        )}

        {localView === AppView.PREP && (
          <ViewPrep
            key="prep"
            onBegin={() => handleViewChange(AppView.PRACTICE)}
            onBack={() => handleViewChange(AppView.INPUT)}
          />
        )}

        {localView === AppView.PRACTICE && (
          <ViewPractice
            key="practice"
            pitchOption={selectedPitch}
            onEnd={handlePracticeEnd}
          />
        )}

        {localView === AppView.REVIEW && (
          <ViewReview
            key="review"
            onReset={() => {
              clearSession();
              handleViewChange(AppView.HOME);
              rhetor.setMode('welcomer');
            }}
            onPracticeAgain={() => {
              clearSession();
              handleViewChange(AppView.PRACTICE);
            }}
          />
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      {!isFullScreen && (
        <BottomNav
          currentView={localView}
          onChangeView={handleViewChange}
        />
      )}
    </main>
  );
}

// ============================================================================
// API KEY PROMPT
// ============================================================================

function ApiKeyPrompt({ onSubmit }: { onSubmit: (key: string) => void }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) {
      setError('Please enter your API key');
      return;
    }
    localStorage.setItem('rhetor_api_key', trimmed);
    onSubmit(trimmed);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-50 text-stone-900 p-6">
      <div className="w-full max-w-md">
        <h1 className="font-serif text-3xl font-medium text-center mb-2">Rhetor</h1>
        <p className="text-stone-500 text-center text-sm mb-8">
          Enter your Gemini API key to get started
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-stone-700 mb-1">
              Gemini API Key
            </label>
            <input
              id="apiKey"
              type="password"
              value={key}
              onChange={(e) => { setKey(e.target.value); setError(''); }}
              placeholder="AIza..."
              className="w-full px-4 py-3 border border-stone-300 rounded-lg bg-white text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
              autoFocus
            />
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          </div>
          <button
            type="submit"
            className="w-full px-4 py-3 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
          >
            Connect
          </button>
        </form>
        <p className="text-stone-400 text-xs text-center mt-6">
          Get a free API key at{' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-600 underline hover:text-slate-800"
          >
            aistudio.google.com/apikey
          </a>
        </p>
        <p className="text-stone-400 text-xs text-center mt-2">
          Your key is stored locally and never sent to any server besides Google.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// LANDING PAGE
// ============================================================================

function LandingPage({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-50 text-stone-900 p-6 select-none">
      {/* Decorative glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-slate-300/30 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="relative z-10 flex flex-col items-center gap-6 max-w-sm text-center"
      >
        {/* Logo / Title */}
        <h1 className="font-serif text-5xl font-medium tracking-tight">Rhetor</h1>
        <p className="text-stone-500 text-base leading-relaxed">
          Your AI-powered pitch coach.
          <br />
          Practice speaking, get real-time feedback, and master the art of rhetoric.
        </p>

        {/* Enter button */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onEnter}
          className="mt-4 px-10 py-4 bg-slate-700 text-white text-lg font-medium rounded-2xl shadow-lg hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
        >
          Enter the Agora
        </motion.button>

        <p className="text-stone-400 text-xs mt-2">
          Microphone access will be requested after you enter.
        </p>
      </motion.div>

      {/* Footer */}
      <p className="absolute bottom-6 text-stone-300 text-xs">
        Powered by Gemini
      </p>
    </div>
  );
}

// ============================================================================
// APP ROOT
// ============================================================================

function App() {
  // Get API key for provider
  const [apiKey, setApiKey] = useState(() =>
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    (window as any).GEMINI_API_KEY ||
    localStorage.getItem('rhetor_api_key') ||
    ''
  );

  // Gate: don't mount the provider / connect until user clicks Enter
  const [entered, setEntered] = useState(false);

  // Step 1: Need API key
  if (!apiKey) {
    return (
      <ErrorBoundary>
        <ApiKeyPrompt onSubmit={setApiKey} />
      </ErrorBoundary>
    );
  }

  // Step 2: Have key, show landing page until user clicks Enter
  if (!entered) {
    return (
      <ErrorBoundary>
        <LandingPage onEnter={() => setEntered(true)} />
      </ErrorBoundary>
    );
  }

  // Step 3: User clicked Enter → mount provider, auto-connect
  return (
    <ErrorBoundary>
      <RhetorProvider apiKey={apiKey} autoConnect>
        <AppContent />
      </RhetorProvider>
    </ErrorBoundary>
  );
}

export default App;
