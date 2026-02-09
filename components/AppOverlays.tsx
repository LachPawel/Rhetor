import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Wifi, WifiOff, RefreshCw, Sparkles, Coins, Star, Trophy, Flame } from 'lucide-react';
import { useRhetorStore } from '../stores/useRhetorStore';
import { useRhetorContext } from '../lib/useRhetor';

// ============================================================================
// CONNECTION STATUS BAR
// ============================================================================

export function ConnectionStatusBar() {
  const { connectionStatus, reconnect } = useRhetorContext();
  const hasConnectedOnce = React.useRef(false);

  // Track whether a connection has ever been attempted
  if (connectionStatus === 'connecting' || connectionStatus === 'connected' || connectionStatus === 'reconnecting') {
    hasConnectedOnce.current = true;
  }

  // Don't show the bar before the user has ever connected (initial 'disconnected' state)
  if (connectionStatus === 'connected') return null;
  if (!hasConnectedOnce.current && connectionStatus === 'disconnected') return null;

  const statusConfig: Record<string, { icon: any, text: string, color: string }> = {
    disconnected: { icon: WifiOff, text: 'Disconnected', color: 'bg-stone-500' },
    connecting: { icon: Wifi, text: 'Connecting...', color: 'bg-stone-800' },
    reconnecting: { icon: RefreshCw, text: 'Reconnecting...', color: 'bg-stone-800' },
    error: { icon: AlertTriangle, text: 'Connection Error', color: 'bg-red-900' },
    closed: { icon: WifiOff, text: 'Session Ended', color: 'bg-stone-500' },
  };

  const config = statusConfig[connectionStatus] || statusConfig.disconnected;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -50, opacity: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 ${config.color} text-white px-4 py-2 flex items-center justify-between text-xs font-mono uppercase tracking-widest`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-3 h-3 ${connectionStatus === 'reconnecting' ? 'animate-spin' : ''}`} />
        <span>{config.text}</span>
      </div>
      {(connectionStatus === 'error' || connectionStatus === 'disconnected') && (
        <button
          onClick={reconnect}
          className="px-3 py-1 bg-white/10 rounded hover:bg-white/20 transition-colors"
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

export function CelebrationOverlay() {
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
    <>
      {/* {celebrationPending === 'confetti' && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-24 h-24 rounded-full bg-white border-2 border-stone-900 flex items-center justify-center animate-bounce shadow-xl">
          <Sparkles className="w-12 h-12 text-stone-900" />
        </motion.div>
      )}
      {celebrationPending === 'coins' && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-24 h-24 rounded-full bg-white border-2 border-stone-900 flex items-center justify-center animate-bounce shadow-xl">
          <Coins className="w-12 h-12 text-stone-900" />
        </motion.div>
      )}
      {celebrationPending === 'stars' && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-24 h-24 rounded-full bg-white border-2 border-stone-900 flex items-center justify-center animate-bounce shadow-xl">
          <Star className="w-12 h-12 text-stone-900" />
        </motion.div>
      )}
      {celebrationPending === 'achievement' && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-24 h-24 rounded-full bg-white border-2 border-stone-900 flex items-center justify-center animate-bounce shadow-xl">
          <Trophy className="w-12 h-12 text-stone-900" />
        </motion.div>
      )}
      {celebrationPending === 'streak' && (
         <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-24 h-24 rounded-full bg-white border-2 border-stone-900 flex items-center justify-center animate-bounce shadow-xl">
          <Flame className="w-12 h-12 text-stone-900" />
        </motion.div>
      )} */}
    </>
  );
}

// ============================================================================
// FEEDBACK TOAST
// ============================================================================

export function FeedbackToast() {
  const feedbackPending = useRhetorStore(s => s.feedbackPending);
  const clearFeedback = useRhetorStore(s => s.clearFeedback);

  useEffect(() => {
    if (feedbackPending) {
      const timer = setTimeout(clearFeedback, 3000);
      return () => clearTimeout(timer);
    }
  }, [feedbackPending, clearFeedback]);

  if (!feedbackPending) return null;

  // Minimal monochrome styles
  const typeStyles: Record<string, string> = {
    positive: 'bg-stone-900 text-white border-stone-700',
    improvement: 'bg-white text-stone-900 border-stone-300',
    warning: 'bg-white text-stone-900 border-stone-300',
    filler_alert: 'bg-white text-stone-900 border-stone-300',
    pace_alert: 'bg-white text-stone-900 border-stone-300',
    posture_alert: 'bg-white text-stone-900 border-stone-300',
  };

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 50, opacity: 0 }}
      className={`fixed bottom-24 left-4 right-4 z-40 ${typeStyles[feedbackPending.type] || 'bg-stone-900 text-white'} px-6 py-4 rounded-sm shadow-xl border flex items-center justify-center`}
    >
      <p className="text-sm font-serif font-medium tracking-wide">{feedbackPending.message}</p>
    </motion.div>
  );
}

// ============================================================================
// FILLER INDICATOR
// ============================================================================

export function FillerIndicator() {
  const recentFillerWord = useRhetorStore(s => s.recentFillerWord);

  if (!recentFillerWord) return null;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      className="fixed top-24 right-6 z-30 bg-white border border-stone-900 text-stone-900 px-4 py-2 rounded-full text-xs font-mono uppercase tracking-widest shadow-lg"
    >
      "{recentFillerWord}"
    </motion.div>
  );
}

// ============================================================================
// NAVIGATION CONFIRMATION MODAL
// ============================================================================

export function NavigationConfirmModal() {
  const pendingNavigation = useRhetorStore(s => s.pendingNavigation);
  const confirmNavigation = useRhetorStore(s => s.confirmNavigation);
  const cancelNavigation = useRhetorStore(s => s.cancelNavigation);

  if (!pendingNavigation) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-stone-50/90 backdrop-blur-sm flex items-center justify-center p-6"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-sm p-8 max-w-sm w-full shadow-2xl border border-stone-200 text-center"
      >
        <h3 className="font-serif text-2xl text-stone-900 mb-2">Depart Session?</h3>
        <p className="text-stone-500 text-sm mb-8 font-mono">
          Progress will be lost.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={cancelNavigation}
            className="w-full px-6 py-3 bg-stone-900 text-white text-xs uppercase tracking-widest hover:bg-black transition-colors"
          >
            Stay
          </button>
          <button
            onClick={confirmNavigation}
            className="w-full px-6 py-3 bg-white border border-stone-200 text-stone-500 text-xs uppercase tracking-widest hover:text-stone-900 hover:border-stone-900 transition-colors"
          >
            Leave
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
