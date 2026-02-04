
import React, { useState, Component, ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AppView, PitchOption, SessionResult, Lesson } from './types.ts';
import { ViewHome } from './components/ViewHome.tsx';
import { ViewAgora } from './components/ViewAgora.tsx';
import { ViewSymposium } from './components/ViewSymposium.tsx';
import { ViewProfile } from './components/ViewProfile.tsx';
import { ViewLesson } from './components/ViewLesson.tsx';
import { ViewWarmUp } from './components/ViewWarmUp.tsx';
import { ViewPrep } from './components/ViewPrep.tsx';
import { ViewPractice } from './components/ViewPractice.tsx';
import { ViewReview } from './components/ViewReview.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { AlertTriangle } from 'lucide-react';
import { RhetorProvider } from './contexts/RhetorContext.tsx';
import { AIStatusOrb } from './components/AIStatusOrb.tsx';

// Error Boundary (Keep existing)
interface ErrorBoundaryProps { children?: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-stone-50 text-stone-900 p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-600 mb-4" />
          <h2 className="text-xl serif font-medium mb-2">Something went wrong</h2>
          <button onClick={() => window.location.reload()} className="mt-8 px-6 py-2 border border-stone-300 rounded-sm">Reload App</button>
        </div>
      );
    }
    return this.props.children || null;
  }
}

const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.HOME);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [selectedPitch, setSelectedPitch] = useState<PitchOption | null>(null);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);

  // Full screen modes hide the bottom nav
  const isFullScreen = [
      AppView.WARMUP, 
      AppView.PREP, 
      AppView.PRACTICE, 
      AppView.REVIEW, 
      AppView.LESSON
  ].includes(currentView);

  const handleLessonSelect = (lesson: Lesson) => {
      setActiveLesson(lesson);
      setCurrentView(AppView.LESSON);
  };

  const handleLessonExit = () => {
      setActiveLesson(null);
      setCurrentView(AppView.AGORA);
  };

  const handlePracticeEnd = (result: SessionResult) => {
      setSessionResult(result);
      setCurrentView(AppView.REVIEW);
  };

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-stone-200 overflow-hidden relative">
        <AIStatusOrb />

        <AnimatePresence mode="wait">
            {/* Tab Views */}
            {currentView === AppView.HOME && <ViewHome key="home" onChangeView={setCurrentView} />}
            {currentView === AppView.AGORA && <ViewAgora key="agora" onSelectLesson={handleLessonSelect} />}
            {currentView === AppView.SYMPOSIUM && <ViewSymposium key="symposium" />}
            {currentView === AppView.PROFILE && <ViewProfile key="profile" />}

            {/* Full Screen Views */}
            {currentView === AppView.LESSON && activeLesson && (
                <ViewLesson key="lesson" lesson={activeLesson} onExit={handleLessonExit} />
            )}
            
            {currentView === AppView.WARMUP && (
                <ViewWarmUp key="warmup" onComplete={() => setCurrentView(AppView.PREP)} onExit={() => setCurrentView(AppView.HOME)} />
            )}
            
            {currentView === AppView.PREP && (
                <ViewPrep key="prep" onBegin={() => setCurrentView(AppView.PRACTICE)} onBack={() => setCurrentView(AppView.HOME)} />
            )}
            
            {currentView === AppView.PRACTICE && (
                <ViewPractice key="practice" pitchOption={selectedPitch} onEnd={handlePracticeEnd} />
            )}
            
            {currentView === AppView.REVIEW && (
                <ViewReview key="review" result={sessionResult} onReset={() => setCurrentView(AppView.HOME)} />
            )}
        </AnimatePresence>

        {!isFullScreen && (
            <BottomNav currentView={currentView} onChangeView={setCurrentView} />
        )}
    </main>
  );
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <RhetorProvider>
        <AppContent />
      </RhetorProvider>
    </ErrorBoundary>
  );
};

export default App;
