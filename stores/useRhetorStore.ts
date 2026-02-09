import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============================================================================
// TYPES
// ============================================================================

export type Pillar = 'ethos' | 'logos' | 'pathos' | 'kairos' | 'lexis';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: number;
}

export interface FillerEvent {
  word: string;
  timestamp: number;
  position: number; // character position in transcript
}

export interface SessionMetrics {
  startTime: number;
  endTime?: number;
  duration: number;
  wordsSpoken: number;
  fillerCount: number;
  fillerEvents: FillerEvent[];
  wpm: number;
  clarity: number;
  confidence: number;
  paceVariation: number;
}

export interface LessonProgress {
  lessonId: string;
  completedAt: number;
  score?: number;
  attempts: number;
}

export interface DrillProgress {
  drillId: string;
  completedAt: number;
  score?: number;
  bestScore?: number;
}

export interface SessionRecord {
  id: string;
  date: string; // ISO
  topic: string;
  duration: number; // seconds
  wpm: number;
  fillerCount: number;
  score: number;
  bulletsTotal: number;
  bulletsCovered: number;
}

export interface PitchDeckAsset {
  fileName: string;
  mimeType: string;
  objectUrl: string;
  totalSlides: number | null;
  uploadedAt: number;
  slideTexts?: string[];
  slideHtml?: string[];
  extractedText?: string;
}

export interface DeckNavigationEvent {
  slideNumber: number;
  timestamp: number;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'closed';

export type AIMode = 'welcomer' | 'coach_lesson' | 'coach_warmup' | 'coach_practice' | 'interviewer' | 'analyst' | 'content_builder' | 'idle';

export interface VisualState {
  id: string;
  visible: boolean;
  data?: Record<string, unknown>;
}

export interface TimerState {
  active: boolean;
  startTime?: number;
  duration?: number;
  label?: string;
}

// ============================================================================
// SLICES
// ============================================================================

interface GamificationSlice {
  drachmas: number;
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: string | null;
  achievements: Achievement[];
  
  // Actions
  awardDrachmas: (amount: number, reason?: string) => void;
  updateStreak: () => void;
  unlockAchievement: (achievementId: string) => void;
  resetGamification: () => void;
}

interface ProgressSlice {
  completedLessons: LessonProgress[];
  completedDrills: DrillProgress[];
  completedSkills: string[];
  pillarProgress: Record<Pillar, number>;
  currentLessonStep: number;
  
  // Actions
  completeLesson: (lessonId: string, score?: number) => void;
  completeDrill: (drillId: string, score?: number) => void;
  completeSkill: (skillId: string) => void;
  updatePillarProgress: (pillar: Pillar, progress: number) => void;
  setLessonStep: (step: number) => void;
  nextLessonStep: () => void;
  resetProgress: () => void;
}

interface SessionSlice {
  isSessionActive: boolean;
  currentMetrics: SessionMetrics | null;
  transcript: string;
  lastFillerTimestamp: number | null;
  recentFillerWord: string | null;
  sessionHistory: SessionRecord[];
  
  // Actions
  startSession: () => void;
  endSession: () => void;
  updateTranscript: (text: string) => void;
  addFillerEvent: (word: string, position: number) => void;
  updateMetrics: (partial: Partial<SessionMetrics>) => void;
  clearSession: () => void;
  addSessionToHistory: (record: SessionRecord) => void;
}

interface AISlice {
  connectionStatus: ConnectionStatus;
  currentMode: AIMode;
  isSpeaking: boolean;
  isListening: boolean;
  reconnectAttempts: number;
  lastError: string | null;
  
  // Actions
  setConnectionStatus: (status: ConnectionStatus) => void;
  setMode: (mode: AIMode) => void;
  setIsSpeaking: (speaking: boolean) => void;
  setIsListening: (listening: boolean) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
  setError: (error: string | null) => void;
}

interface PitchSlice {
  talkingPoints: string[];
  pitchTopic: string;
  pitchHook: string;
  pitchClosing: string;
  suggestedDuration: number;
  pitchDeck: PitchDeckAsset | null;
  currentDeckSlide: number;
  deckNavigationEvents: DeckNavigationEvent[];
  
  // Actions
  setTalkingPoints: (points: string[]) => void;
  setPitchTopic: (topic: string) => void;
  setPitchHook: (hook: string) => void;
  setPitchClosing: (closing: string) => void;
  setSuggestedDuration: (duration: number) => void;
  setPitchDeck: (deck: PitchDeckAsset) => void;
  clearPitchDeck: () => void;
  setCurrentDeckSlide: (slideNumber: number) => void;
  resetDeckNavigationEvents: () => void;
}

interface UISlice {
  currentView: string;
  previousView: string | null;
  visuals: Record<string, VisualState>;
  timer: TimerState;
  celebrationPending: string | null;
  feedbackPending: { type: string; message: string; data?: unknown } | null;
  navigationBlocked: boolean;
  pendingNavigation: string | null;
  teleprompterAdvanceCounter: number;
  
  // Actions
  navigate: (view: string) => void;
  showVisual: (id: string, data?: Record<string, unknown>) => void;
  hideVisual: (id: string) => void;
  startTimer: (duration: number, label?: string) => void;
  stopTimer: () => void;
  triggerCelebration: (type: string) => void;
  clearCelebration: () => void;
  showFeedback: (type: string, message: string, data?: unknown) => void;
  clearFeedback: () => void;
  setNavigationBlocked: (blocked: boolean) => void;
  confirmNavigation: () => void;
  cancelNavigation: () => void;
  advanceTeleprompter: () => void;
}

// ============================================================================
// COMBINED STORE TYPE
// ============================================================================

export type RhetorStore = GamificationSlice & ProgressSlice & SessionSlice & AISlice & PitchSlice & UISlice;

// ============================================================================
// INITIAL STATE
// ============================================================================

const INITIAL_PILLAR_PROGRESS: Record<Pillar, number> = {
  ethos: 0,
  logos: 0,
  pathos: 0,
  kairos: 0,
  lexis: 0,
};

const INITIAL_METRICS: SessionMetrics = {
  startTime: 0,
  duration: 0,
  wordsSpoken: 0,
  fillerCount: 0,
  fillerEvents: [],
  wpm: 0,
  clarity: 100,
  confidence: 100,
  paceVariation: 0,
};

// ============================================================================
// ACHIEVEMENTS DEFINITIONS
// ============================================================================

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_lesson', name: 'First Steps', description: 'Complete your first lesson', icon: '' },
  { id: 'streak_3', name: 'Consistent Orator', description: 'Practice 3 days in a row', icon: '' },
  { id: 'streak_7', name: 'Week Warrior', description: 'Practice 7 days in a row', icon: '' },
  { id: 'streak_30', name: 'Monthly Master', description: 'Practice 30 days in a row', icon: '' },
  { id: 'filler_free', name: 'Filler Free', description: 'Complete a drill with no fillers', icon: '' },
  { id: 'perfect_score', name: 'Perfection', description: 'Score 100% on any drill', icon: '' },
  { id: 'ethos_master', name: 'Ethos Master', description: 'Complete all Ethos lessons', icon: '' },
  { id: 'logos_master', name: 'Logos Master', description: 'Complete all Logos lessons', icon: '' },
  { id: 'pathos_master', name: 'Pathos Master', description: 'Complete all Pathos lessons', icon: '' },
  { id: 'kairos_master', name: 'Kairos Master', description: 'Complete all Kairos lessons', icon: '' },
  { id: 'lexis_master', name: 'Lexis Master', description: 'Complete all Lexis lessons', icon: '' },
  { id: 'drachmas_100', name: 'Bronze Collector', description: 'Earn 100 drachmas', icon: '' },
  { id: 'drachmas_500', name: 'Silver Collector', description: 'Earn 500 drachmas', icon: '' },
  { id: 'drachmas_1000', name: 'Gold Collector', description: 'Earn 1000 drachmas', icon: '' },
  { id: 'warmup_warrior', name: 'Warmup Warrior', description: 'Complete 10 warmup sessions', icon: '' },
];

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useRhetorStore = create<RhetorStore>()(
  persist(
    immer((set, get) => ({
      // ========================================================================
      // GAMIFICATION SLICE
      // ========================================================================
      drachmas: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastPracticeDate: null,
      achievements: [],

      awardDrachmas: (amount: number, _reason?: string) => {
        set((state) => {
          state.drachmas += amount;
          
          // Check drachma achievements
          const totalDrachmas = state.drachmas;
          if (totalDrachmas >= 100 && !state.achievements.find(a => a.id === 'drachmas_100')) {
            const achievement = ACHIEVEMENTS.find(a => a.id === 'drachmas_100')!;
            state.achievements.push({ ...achievement, unlockedAt: Date.now() });
          }
          if (totalDrachmas >= 500 && !state.achievements.find(a => a.id === 'drachmas_500')) {
            const achievement = ACHIEVEMENTS.find(a => a.id === 'drachmas_500')!;
            state.achievements.push({ ...achievement, unlockedAt: Date.now() });
          }
          if (totalDrachmas >= 1000 && !state.achievements.find(a => a.id === 'drachmas_1000')) {
            const achievement = ACHIEVEMENTS.find(a => a.id === 'drachmas_1000')!;
            state.achievements.push({ ...achievement, unlockedAt: Date.now() });
          }
        });
      },

      updateStreak: () => {
        set((state) => {
          const today = new Date().toDateString();
          const yesterday = new Date(Date.now() - 86400000).toDateString();
          
          if (state.lastPracticeDate === today) {
            return; // Already practiced today
          }
          
          if (state.lastPracticeDate === yesterday) {
            state.currentStreak += 1;
          } else if (state.lastPracticeDate !== today) {
            state.currentStreak = 1;
          }
          
          state.lastPracticeDate = today;
          
          if (state.currentStreak > state.longestStreak) {
            state.longestStreak = state.currentStreak;
          }
          
          // Check streak achievements
          if (state.currentStreak >= 3 && !state.achievements.find(a => a.id === 'streak_3')) {
            const achievement = ACHIEVEMENTS.find(a => a.id === 'streak_3')!;
            state.achievements.push({ ...achievement, unlockedAt: Date.now() });
          }
          if (state.currentStreak >= 7 && !state.achievements.find(a => a.id === 'streak_7')) {
            const achievement = ACHIEVEMENTS.find(a => a.id === 'streak_7')!;
            state.achievements.push({ ...achievement, unlockedAt: Date.now() });
          }
          if (state.currentStreak >= 30 && !state.achievements.find(a => a.id === 'streak_30')) {
            const achievement = ACHIEVEMENTS.find(a => a.id === 'streak_30')!;
            state.achievements.push({ ...achievement, unlockedAt: Date.now() });
          }
        });
      },

      unlockAchievement: (achievementId: string) => {
        set((state) => {
          if (state.achievements.find(a => a.id === achievementId)) return;
          const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
          if (achievement) {
            state.achievements.push({ ...achievement, unlockedAt: Date.now() });
          }
        });
      },

      resetGamification: () => {
        set((state) => {
          state.drachmas = 0;
          state.currentStreak = 0;
          state.longestStreak = 0;
          state.lastPracticeDate = null;
          state.achievements = [];
        });
      },

      // ========================================================================
      // PROGRESS SLICE
      // ========================================================================
      completedLessons: [],
      completedDrills: [],
      completedSkills: [],
      pillarProgress: { ...INITIAL_PILLAR_PROGRESS },
      currentLessonStep: 0,

      completeLesson: (lessonId: string, score?: number) => {
        set((state) => {
          const existing = state.completedLessons.find(l => l.lessonId === lessonId);
          if (existing) {
            existing.attempts += 1;
            if (score !== undefined && (existing.score === undefined || score > existing.score)) {
              existing.score = score;
            }
          } else {
            state.completedLessons.push({
              lessonId,
              completedAt: Date.now(),
              score,
              attempts: 1,
            });
            
            // First lesson achievement
            if (state.completedLessons.length === 1) {
              const achievement = ACHIEVEMENTS.find(a => a.id === 'first_lesson')!;
              if (!state.achievements.find(a => a.id === 'first_lesson')) {
                state.achievements.push({ ...achievement, unlockedAt: Date.now() });
              }
            }
          }
          
          // Perfect score achievement
          if (score === 100 && !state.achievements.find(a => a.id === 'perfect_score')) {
            const achievement = ACHIEVEMENTS.find(a => a.id === 'perfect_score')!;
            state.achievements.push({ ...achievement, unlockedAt: Date.now() });
          }
        });
        
        // Award drachmas
        const baseReward = 50;
        const bonusReward = score ? Math.floor(score / 10) : 0;
        get().awardDrachmas(baseReward + bonusReward, `Completed ${lessonId}`);
        get().updateStreak();
      },

      completeDrill: (drillId: string, score?: number) => {
        set((state) => {
          const existing = state.completedDrills.find(d => d.drillId === drillId);
          if (existing) {
            if (score !== undefined) {
              if (existing.bestScore === undefined || score > existing.bestScore) {
                existing.bestScore = score;
              }
            }
            existing.score = score;
            existing.completedAt = Date.now();
          } else {
            state.completedDrills.push({
              drillId,
              completedAt: Date.now(),
              score,
              bestScore: score,
            });
          }
        });
        
        const baseReward = 25;
        const bonusReward = score ? Math.floor(score / 20) : 0;
        get().awardDrachmas(baseReward + bonusReward, `Completed drill ${drillId}`);
      },

      completeSkill: (skillId: string) => {
        set((state) => {
          if (!state.completedSkills.includes(skillId)) {
            state.completedSkills.push(skillId);
          }
        });
        get().awardDrachmas(100, `Mastered skill ${skillId}`);
      },

      updatePillarProgress: (pillar: Pillar, progress: number) => {
        set((state) => {
          state.pillarProgress[pillar] = Math.min(100, Math.max(0, progress));
          
          // Check pillar mastery achievements
          if (progress >= 100) {
            const achievementId = `${pillar}_master`;
            if (!state.achievements.find(a => a.id === achievementId)) {
              const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
              if (achievement) {
                state.achievements.push({ ...achievement, unlockedAt: Date.now() });
              }
            }
          }
        });
      },

      setLessonStep: (step: number) => {
        set((state) => {
          state.currentLessonStep = step;
        });
      },

      nextLessonStep: () => {
        set((state) => {
          state.currentLessonStep += 1;
        });
      },

      resetProgress: () => {
        set((state) => {
          state.completedLessons = [];
          state.completedDrills = [];
          state.completedSkills = [];
          state.pillarProgress = { ...INITIAL_PILLAR_PROGRESS };
          state.currentLessonStep = 0;
        });
      },

      // ========================================================================
      // SESSION SLICE
      // ========================================================================
      isSessionActive: false,
      currentMetrics: null,
      transcript: '',
      lastFillerTimestamp: null,
      recentFillerWord: null,

      startSession: () => {
        set((state) => {
          const now = Date.now();
          state.isSessionActive = true;
          state.currentMetrics = {
            ...INITIAL_METRICS,
            startTime: now,
          };
          state.transcript = '';
          state.lastFillerTimestamp = null;
          state.recentFillerWord = null;
          state.deckNavigationEvents = [];
          if (state.pitchDeck) {
            state.deckNavigationEvents.push({
              slideNumber: state.currentDeckSlide,
              timestamp: now,
            });
          }
        });
      },

      endSession: () => {
        set((state) => {
          if (state.currentMetrics) {
            state.currentMetrics.endTime = Date.now();
            state.currentMetrics.duration = state.currentMetrics.endTime - state.currentMetrics.startTime;
          }
          state.isSessionActive = false;
        });
      },

      updateTranscript: (text: string) => {
        set((state) => {
          state.transcript = text;
          if (state.currentMetrics) {
            state.currentMetrics.wordsSpoken = text.split(/\s+/).filter(Boolean).length;
            // Calculate duration live from startTime (don't wait for endSession)
            const liveDuration = Date.now() - state.currentMetrics.startTime;
            if (liveDuration > 0) {
              state.currentMetrics.duration = liveDuration;
              state.currentMetrics.wpm = Math.round(
                (state.currentMetrics.wordsSpoken / liveDuration) * 60000
              );
            }
          }
        });
      },

      addFillerEvent: (word: string, position: number) => {
        set((state) => {
          const event: FillerEvent = {
            word,
            timestamp: Date.now(),
            position,
          };
          
          if (state.currentMetrics) {
            state.currentMetrics.fillerEvents.push(event);
            state.currentMetrics.fillerCount = state.currentMetrics.fillerEvents.length;
            
            // Update clarity score based on filler ratio
            const fillerRatio = state.currentMetrics.fillerCount / Math.max(1, state.currentMetrics.wordsSpoken);
            state.currentMetrics.clarity = Math.max(0, Math.round(100 - fillerRatio * 200));
          }
          
          state.lastFillerTimestamp = event.timestamp;
          state.recentFillerWord = word;
          
          // Clear recent filler word after animation
          setTimeout(() => {
            const store = useRhetorStore.getState();
            if (store.lastFillerTimestamp === event.timestamp) {
              useRhetorStore.setState({ recentFillerWord: null });
            }
          }, 1500);
        });
      },

      updateMetrics: (partial: Partial<SessionMetrics>) => {
        set((state) => {
          if (state.currentMetrics) {
            Object.assign(state.currentMetrics, partial);
          }
        });
      },

      clearSession: () => {
        set((state) => {
          state.isSessionActive = false;
          state.currentMetrics = null;
          state.transcript = '';
          state.lastFillerTimestamp = null;
          state.recentFillerWord = null;
          state.deckNavigationEvents = [];
        });
      },

      sessionHistory: [],

      addSessionToHistory: (record: SessionRecord) => {
        set((state) => {
          state.sessionHistory.push(record);
          // Keep only last 20 sessions
          if (state.sessionHistory.length > 20) {
            state.sessionHistory = state.sessionHistory.slice(-20);
          }
        });
      },

      // ========================================================================
      // AI SLICE
      // ========================================================================
      connectionStatus: 'disconnected',
      currentMode: 'idle',
      isSpeaking: false,
      isListening: false,
      reconnectAttempts: 0,
      lastError: null,

      setConnectionStatus: (status: ConnectionStatus) => {
        set((state) => {
          state.connectionStatus = status;
          if (status === 'connected') {
            state.lastError = null;
          }
        });
      },

      setMode: (mode: AIMode) => {
        set((state) => {
          state.currentMode = mode;
        });
      },

      setIsSpeaking: (speaking: boolean) => {
        set((state) => {
          state.isSpeaking = speaking;
        });
      },

      setIsListening: (listening: boolean) => {
        set((state) => {
          state.isListening = listening;
        });
      },

      incrementReconnectAttempts: () => {
        set((state) => {
          state.reconnectAttempts += 1;
        });
      },

      resetReconnectAttempts: () => {
        set((state) => {
          state.reconnectAttempts = 0;
        });
      },

      setError: (error: string | null) => {
        set((state) => {
          state.lastError = error;
          if (error) {
            state.connectionStatus = 'error';
          }
        });
      },

      // ========================================================================
      // PITCH SLICE
      // ========================================================================
      talkingPoints: [],
      pitchTopic: '',
      pitchHook: '',
      pitchClosing: '',
      suggestedDuration: 60,
      pitchDeck: null,
      currentDeckSlide: 1,
      deckNavigationEvents: [],

      setTalkingPoints: (points: string[]) => {
        set((state) => {
          state.talkingPoints = points
            .map((point) => point.trim())
            .filter((point) => point.length > 0);
        });
      },

      setPitchTopic: (topic: string) => {
        set((state) => {
          state.pitchTopic = topic;
        });
      },

      setPitchHook: (hook: string) => {
        set((state) => {
          state.pitchHook = hook;
        });
      },

      setPitchClosing: (closing: string) => {
        set((state) => {
          state.pitchClosing = closing;
        });
      },

      setSuggestedDuration: (duration: number) => {
        set((state) => {
          state.suggestedDuration = duration;
        });
      },

      setPitchDeck: (deck: PitchDeckAsset) => {
        set((state) => {
          state.pitchDeck = deck;
          state.currentDeckSlide = 1;
          state.deckNavigationEvents = [];
          if (state.isSessionActive) {
            state.deckNavigationEvents.push({
              slideNumber: 1,
              timestamp: Date.now(),
            });
          }
        });
      },

      clearPitchDeck: () => {
        set((state) => {
          state.pitchDeck = null;
          state.currentDeckSlide = 1;
          state.deckNavigationEvents = [];
        });
      },

      setCurrentDeckSlide: (slideNumber: number) => {
        set((state) => {
          if (!state.pitchDeck) return;
          const maxSlides = state.pitchDeck.totalSlides ?? Number.POSITIVE_INFINITY;
          const nextSlide = Math.max(1, Math.min(slideNumber, maxSlides));
          if (nextSlide === state.currentDeckSlide) return;
          state.currentDeckSlide = nextSlide;
          if (state.isSessionActive) {
            state.deckNavigationEvents.push({
              slideNumber: nextSlide,
              timestamp: Date.now(),
            });
          }
        });
      },

      resetDeckNavigationEvents: () => {
        set((state) => {
          state.deckNavigationEvents = [];
          if (state.isSessionActive && state.pitchDeck) {
            state.deckNavigationEvents.push({
              slideNumber: state.currentDeckSlide,
              timestamp: Date.now(),
            });
          }
        });
      },

      // ========================================================================
      // UI SLICE
      // ========================================================================
      currentView: 'LANDING',
      previousView: null,
      visuals: {},
      timer: { active: false },
      celebrationPending: null,
      feedbackPending: null,
      navigationBlocked: false,
      pendingNavigation: null,
      teleprompterAdvanceCounter: 0,

      navigate: (view: string) => {
        const state = get();
        
        // Check if navigation should be blocked (during active session)
        if (state.navigationBlocked && state.isSessionActive) {
          set((s) => {
            s.pendingNavigation = view;
          });
          return;
        }
        
        set((s) => {
          s.previousView = s.currentView;
          s.currentView = view;
          s.pendingNavigation = null;
        });
      },

      showVisual: (id: string, data?: Record<string, unknown>) => {
        set((state) => {
          state.visuals[id] = { id, visible: true, data };
        });
      },

      hideVisual: (id: string) => {
        set((state) => {
          if (state.visuals[id]) {
            state.visuals[id].visible = false;
          }
        });
      },

      startTimer: (duration: number, label?: string) => {
        set((state) => {
          state.timer = {
            active: true,
            startTime: Date.now(),
            duration,
            label,
          };
        });
      },

      stopTimer: () => {
        set((state) => {
          state.timer = { active: false };
        });
      },

      triggerCelebration: (type: string) => {
        set((state) => {
          state.celebrationPending = type;
        });
      },

      clearCelebration: () => {
        set((state) => {
          state.celebrationPending = null;
        });
      },

      showFeedback: (type: string, message: string, data?: unknown) => {
        set((state) => {
          state.feedbackPending = { type, message, data };
        });
      },

      clearFeedback: () => {
        set((state) => {
          state.feedbackPending = null;
        });
      },

      setNavigationBlocked: (blocked: boolean) => {
        set((state) => {
          state.navigationBlocked = blocked;
        });
      },

      confirmNavigation: () => {
        const pending = get().pendingNavigation;
        if (pending) {
          set((state) => {
            state.navigationBlocked = false;
            state.previousView = state.currentView;
            state.currentView = pending;
            state.pendingNavigation = null;
          });
        }
      },

      cancelNavigation: () => {
        set((state) => {
          state.pendingNavigation = null;
        });
      },

      advanceTeleprompter: () => {
        set((state) => {
          state.teleprompterAdvanceCounter += 1;
        });
      },
    })),
    {
      name: 'rhetor-storage',
      storage: createJSONStorage(() => {
        // Wrap localStorage to handle private browsing
        try {
          const testKey = '__rhetor_test__';
          localStorage.setItem(testKey, testKey);
          localStorage.removeItem(testKey);
          return localStorage;
        } catch {
          // Fallback to in-memory storage
          let data: Record<string, string> = {};
          return {
            getItem: (name: string) => data[name] ?? null,
            setItem: (name: string, value: string) => { data[name] = value; },
            removeItem: (name: string) => { delete data[name]; },
          };
        }
      }),
      partialize: (state) => ({
        // Only persist user progress, not session state
        drachmas: state.drachmas,
        currentStreak: state.currentStreak,
        longestStreak: state.longestStreak,
        lastPracticeDate: state.lastPracticeDate,
        achievements: state.achievements,
        completedLessons: state.completedLessons,
        completedDrills: state.completedDrills,
        completedSkills: state.completedSkills,
        pillarProgress: state.pillarProgress,
        sessionHistory: state.sessionHistory,
      }),
    }
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

export const selectTotalLessonsCompleted = (state: RhetorStore) => state.completedLessons.length;
export const selectTotalDrillsCompleted = (state: RhetorStore) => state.completedDrills.length;
export const selectIsLessonCompleted = (lessonId: string) => (state: RhetorStore) =>
  state.completedLessons.some(l => l.lessonId === lessonId);
export const selectLessonScore = (lessonId: string) => (state: RhetorStore) =>
  state.completedLessons.find(l => l.lessonId === lessonId)?.score;
export const selectPillarProgress = (pillar: Pillar) => (state: RhetorStore) =>
  state.pillarProgress[pillar];
export const selectHasAchievement = (achievementId: string) => (state: RhetorStore) =>
  state.achievements.some(a => a.id === achievementId);
export const selectRecentAchievements = (count: number) => (state: RhetorStore) =>
  [...state.achievements]
    .sort((a, b) => (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0))
    .slice(0, count);
export const selectIsConnected = (state: RhetorStore) => state.connectionStatus === 'connected';
export const selectCanNavigate = (state: RhetorStore) => !state.navigationBlocked || !state.isSessionActive;
