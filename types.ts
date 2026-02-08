
import React from 'react';

export enum AppView {
  LANDING = 'LANDING',
  HOME = 'HOME',
  AGORA = 'AGORA',
  SYMPOSIUM = 'SYMPOSIUM',
  PROFILE = 'PROFILE',
  WARMUP = 'WARMUP',
  PREP = 'PREP', // Pitch Builder
  PRACTICE = 'PRACTICE',
  SIMULATION = 'SIMULATION', // New audience simulation
  REVIEW = 'REVIEW',
  LESSON = 'LESSON',
}

export enum AgentMode {
  IDLE = 'IDLE',
  WELCOMER = 'WELCOMER',
  COACH_WARMUP = 'COACH_WARMUP',
  INTERVIEWER = 'INTERVIEWER',
  COACH_PRACTICE = 'COACH_PRACTICE',
  SIMULATION = 'SIMULATION', // New audience simulation mode
  ANALYST = 'ANALYST',
  COACH_LESSON = 'COACH_LESSON'
}

export interface UserProfile {
  name: string;
  drachmas: number;
  streak: number;
  lastPracticeDate: string; // ISO date string
  completedLessons: string[]; // IDs of completed lessons
  badges: string[]; // IDs of earned badges
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name or emoji
  color: string;
}

export interface Lesson {
  id: string;
  pillarId: string;
  title: string;
  description: string;
  type: 'LESSON' | 'DRILL' | 'CHALLENGE';
  reward: number;
  durationMinutes: number;
}

export interface LearningGuide {
  id: string;
  title: string;
  subtitle: string;
  content: React.ReactNode;
}

export interface PitchOption {
  id: string;
  label: string;
  durationLabel: string; // e.g., "60 seconds"
  durationSeconds: number;
}

export interface SessionResult {
  durationSeconds: number;
  postureScore: number; 
  eyeContactScore: number; 
  fillersCount: number;
  wpm: number;
  targetDurationSeconds: number;
}

export interface RhetorContextType {
  isConnected: boolean;
  isConnecting: boolean;
  isSpeaking: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  setMode: (mode: AgentMode, contextData?: any) => void;
  
  // Pitch State
  talkingPoints: string[];
  setTalkingPoints: (points: string[]) => void;
  pitchTopic: string;
  setPitchTopic: (topic: string) => void;
  
  // AI State
  lastTranscript: string;
  aiResponse: string;

  // Gamification State
  user: UserProfile;
  addDrachmas: (amount: number) => void;
  completeLesson: (lessonId: string) => void;
  updateStreak: () => void;
}
