/**
 * RhetorContext — Compatibility bridge
 *
 * All components import `useRhetor` from this file.
 * It wraps the new system (lib/useRhetor.ts + Zustand store)
 * and exposes the legacy API shape so existing components work unchanged.
 */

import { useRhetorContext } from '../lib/useRhetor';
export { RhetorProvider } from '../lib/useRhetor';
import { useRhetorStore } from '../stores/useRhetorStore';
import { AgentMode, type RhetorContextType } from '../types';
import type { AIMode } from '../stores/useRhetorStore';

// ============================================================================
// MODE MAPPING: old AgentMode enum → new AIMode string
// ============================================================================

const MODE_MAP: Record<string, AIMode> = {
  [AgentMode.WELCOMER]: 'welcomer',
  [AgentMode.COACH_WARMUP]: 'coach_warmup',
  [AgentMode.COACH_LESSON]: 'coach_lesson',
  [AgentMode.COACH_PRACTICE]: 'coach_practice',
  [AgentMode.INTERVIEWER]: 'interviewer',
  [AgentMode.ANALYST]: 'analyst',
  [AgentMode.CONTENT_BUILDER]: 'content_builder',
  [AgentMode.IDLE]: 'idle',
};

// ============================================================================
// useRhetor — the hook every component calls
// ============================================================================

export const useRhetor = (): RhetorContextType => {
  const ctx = useRhetorContext();
  const store = useRhetorStore();

  return {
    // Connection
    isConnected: ctx.isConnected,
    isConnecting: ctx.connectionStatus === 'connecting',
    isSpeaking: ctx.isSpeaking,
    volume: ctx.volume,
    connect: ctx.connect as unknown as () => Promise<void>,
    disconnect: ctx.disconnect,

    // Mode
    setMode: (mode: AgentMode, contextData?: any) => {
      ctx.setMode(MODE_MAP[mode] ?? 'idle', contextData);
    },

    // AI output
    aiResponse: ctx.aiTranscript,
    lastTranscript: ctx.userTranscript,

    // Pitch state (now in Zustand store)
    talkingPoints: store.talkingPoints,
    setTalkingPoints: store.setTalkingPoints,
    pitchTopic: store.pitchTopic,
    setPitchTopic: store.setPitchTopic,

    // User profile (assembled from Zustand slices)
    user: {
      name: 'Speaker',
      drachmas: store.drachmas,
      streak: store.currentStreak,
      completedLessons: store.completedLessons.map((l) => l.lessonId),
      lastPracticeDate: store.lastPracticeDate ?? '',
      badges: store.achievements.map((a) => a.id),
    },

    // Gamification (delegate to store)
    addDrachmas: (amount: number) => store.awardDrachmas(amount),
    completeLesson: (lessonId: string) => store.completeLesson(lessonId),
    updateStreak: () => store.updateStreak(),
  };
};
