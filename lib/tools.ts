/**
 * Tool Declarations for Gemini Live API
 * 
 * These tools allow the AI to control the app's UI, navigation, and state.
 * Each tool has a strict schema that Gemini will follow when calling functions.
 */

import { Type, FunctionDeclaration } from '@google/genai';

// ============================================================================
// NAVIGATION TOOLS
// ============================================================================

export const navigateToTool: FunctionDeclaration = {
  name: 'navigate_to',
  description: `Navigate the user to a different view in the app. Use this to guide the user through their learning journey.
Available views:
- HOME: Main dashboard with daily challenge and continue learning
- WARMUP: Pre-practice breathing and voice exercises
- INPUT: Content preparation screen (paste text, pick template, or start AI interview)
- PREP: AI-guided pitch interview to extract talking points
- PRACTICE: Live pitch practice session
- REVIEW: Post-practice performance review
- LESSON: Current lesson content
- AGORA: Learning path and skill tree
- SYMPOSIUM: Community and leaderboards
- PROFILE: User profile and achievements

IMPORTANT: During an active practice session, navigation will require user confirmation.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      view: {
        type: Type.STRING,
        description: 'The view to navigate to',
        enum: ['HOME', 'WARMUP', 'INPUT', 'PREP', 'PRACTICE', 'REVIEW', 'LESSON', 'AGORA', 'SYMPOSIUM', 'PROFILE'],
      },
      context: {
        type: Type.OBJECT,
        description: 'Optional context to pass to the view',
        properties: {
          lessonId: { type: Type.STRING, description: 'Lesson ID when navigating to LESSON view' },
          drillId: { type: Type.STRING, description: 'Drill ID for specific drill navigation' },
          pillar: { type: Type.STRING, description: 'Pillar name (ethos, logos, pathos, kairos, lexis)' },
        },
      },
    },
    required: ['view'],
  },
};

// ============================================================================
// UI CONTROL TOOLS
// ============================================================================

export const showVisualTool: FunctionDeclaration = {
  name: 'show_visual',
  description: `Show a visual element on screen. Use this to display tips, examples, or instructional content.
Available visual IDs:
- tip_card: Display a coaching tip
- example_video: Show an example video
- bullet_points: Display pitch bullet points
- timer_display: Show countdown timer
- progress_indicator: Show lesson progress
- filler_counter: Display filler word count
- posture_overlay: Show posture guidance
- breathing_guide: Display breathing animation
- score_breakdown: Show detailed scoring`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      visualId: {
        type: Type.STRING,
        description: 'ID of the visual element to show',
      },
      data: {
        type: Type.OBJECT,
        description: 'Data to populate the visual',
        properties: {
          title: { type: Type.STRING },
          content: { type: Type.STRING },
          items: { type: Type.ARRAY, items: { type: Type.STRING } },
          duration: { type: Type.NUMBER, description: 'Auto-hide after N seconds' },
        },
      },
    },
    required: ['visualId'],
  },
};

export const hideVisualTool: FunctionDeclaration = {
  name: 'hide_visual',
  description: 'Hide a visual element that is currently displayed.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      visualId: {
        type: Type.STRING,
        description: 'ID of the visual element to hide',
      },
    },
    required: ['visualId'],
  },
};

// ============================================================================
// TIMER TOOLS
// ============================================================================

export const startTimerTool: FunctionDeclaration = {
  name: 'start_timer',
  description: 'Start a countdown timer. Use for timed exercises, practice sessions, or breathing exercises.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      duration: {
        type: Type.NUMBER,
        description: 'Duration in seconds',
      },
      label: {
        type: Type.STRING,
        description: 'Label to display with the timer (e.g., "Breathe In", "Your Turn", "Practice Time")',
      },
      autoStart: {
        type: Type.BOOLEAN,
        description: 'Whether to start immediately (default true)',
      },
    },
    required: ['duration'],
  },
};

export const stopTimerTool: FunctionDeclaration = {
  name: 'stop_timer',
  description: 'Stop the currently running timer.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      reason: {
        type: Type.STRING,
        description: 'Reason for stopping (for logging)',
      },
    },
    required: [],
  },
};

// ============================================================================
// GAMIFICATION TOOLS
// ============================================================================

export const awardDrachmasTool: FunctionDeclaration = {
  name: 'award_drachmas',
  description: `Award drachmas (XP currency) to the user. Use this to reward:
- Completing exercises: 10-25 drachmas
- Good performance: 25-50 drachmas
- Lesson completion: 50-100 drachmas
- Perfect scores: bonus 25-50 drachmas
- Achievements: 50-200 drachmas`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      amount: {
        type: Type.NUMBER,
        description: 'Number of drachmas to award',
      },
      reason: {
        type: Type.STRING,
        description: 'Reason for the award (shown to user)',
      },
      showAnimation: {
        type: Type.BOOLEAN,
        description: 'Whether to show coin animation (default true)',
      },
    },
    required: ['amount', 'reason'],
  },
};

// ============================================================================
// PROGRESS TOOLS
// ============================================================================

export const completeLessonTool: FunctionDeclaration = {
  name: 'complete_lesson',
  description: `Mark a lesson as complete. ALWAYS call this when the user successfully finishes a lesson.
This will:
- Record completion in user progress
- Award base drachmas (50) + score bonus
- Update streak
- Check for achievements
- Unlock next lesson`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      lessonId: {
        type: Type.STRING,
        description: 'The lesson ID (e.g., "ethos-1", "logos-2")',
      },
      score: {
        type: Type.NUMBER,
        description: 'Score from 0-100 based on performance',
      },
    },
    required: ['lessonId'],
  },
};

export const completeDrillTool: FunctionDeclaration = {
  name: 'complete_drill',
  description: `Mark a drill as complete. Call this after each drill exercise.
Drills are smaller exercises within lessons.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      drillId: {
        type: Type.STRING,
        description: 'The drill ID',
      },
      score: {
        type: Type.NUMBER,
        description: 'Score from 0-100',
      },
      metrics: {
        type: Type.OBJECT,
        description: 'Performance metrics',
        properties: {
          fillerCount: { type: Type.NUMBER },
          wordsPerMinute: { type: Type.NUMBER },
          clarity: { type: Type.NUMBER },
        },
      },
    },
    required: ['drillId'],
  },
};

// ============================================================================
// LESSON FLOW TOOLS
// ============================================================================

export const nextStepTool: FunctionDeclaration = {
  name: 'next_step',
  description: `Advance to the next step in the current lesson or exercise.
Use this to progress through multi-step lessons.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      stepNumber: {
        type: Type.NUMBER,
        description: 'Specific step to go to (optional, defaults to current+1)',
      },
    },
    required: [],
  },
};

export const startExerciseTool: FunctionDeclaration = {
  name: 'start_exercise',
  description: `Start a specific exercise. This prepares the UI and tracking for the exercise type.
Exercise types:
- breathing: Guided breathing exercise
- vocal_warmup: Voice exercises
- posture_check: Posture calibration
- filler_awareness: Filler word drill
- pace_control: Speaking pace exercise
- pitch_delivery: Full pitch practice`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      exerciseType: {
        type: Type.STRING,
        description: 'Type of exercise to start',
        enum: ['breathing', 'vocal_warmup', 'posture_check', 'filler_awareness', 'pace_control', 'pitch_delivery'],
      },
      duration: {
        type: Type.NUMBER,
        description: 'Duration in seconds (optional)',
      },
      config: {
        type: Type.OBJECT,
        description: 'Exercise-specific configuration',
        properties: {
          targetWPM: { type: Type.NUMBER },
          maxFillers: { type: Type.NUMBER },
          breathPattern: { type: Type.STRING },
        },
      },
    },
    required: ['exerciseType'],
  },
};

// ============================================================================
// FEEDBACK TOOLS
// ============================================================================

export const showFeedbackTool: FunctionDeclaration = {
  name: 'show_feedback',
  description: `Display coaching feedback to the user. Use this for real-time guidance during practice.
Feedback types:
- positive: Green checkmark, encouraging message
- improvement: Yellow indicator, constructive tip
- warning: Orange alert, immediate correction needed
- filler_alert: Subtle pulse when filler detected
- pace_alert: Pacing feedback (too fast/slow)
- posture_alert: Posture correction`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      feedbackType: {
        type: Type.STRING,
        description: 'Type of feedback',
        enum: ['positive', 'improvement', 'warning', 'filler_alert', 'pace_alert', 'posture_alert'],
      },
      message: {
        type: Type.STRING,
        description: 'The feedback message to display',
      },
      duration: {
        type: Type.NUMBER,
        description: 'How long to show in seconds (default 3)',
      },
    },
    required: ['feedbackType', 'message'],
  },
};

export const showCelebrationTool: FunctionDeclaration = {
  name: 'show_celebration',
  description: `Trigger a celebration animation. Use for achievements, completions, and milestones.
Celebration types:
- confetti: Colorful confetti burst
- coins: Drachma coins falling
- stars: Star burst animation
- achievement: Achievement badge reveal
- streak: Streak flame animation
- level_up: Level up fanfare`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      celebrationType: {
        type: Type.STRING,
        description: 'Type of celebration',
        enum: ['confetti', 'coins', 'stars', 'achievement', 'streak', 'level_up'],
      },
      message: {
        type: Type.STRING,
        description: 'Optional message to display with celebration',
      },
    },
    required: ['celebrationType'],
  },
};

// ============================================================================
// AUDIO TOOLS
// ============================================================================

export const playSoundTool: FunctionDeclaration = {
  name: 'play_sound',
  description: `Play a sound effect. Use sparingly for important moments.
Sound types:
- success: Positive chime
- complete: Completion sound
- coin: Drachma earned
- error: Error/warning sound
- tick: Timer tick
- bell: Attention bell
- whoosh: Transition sound`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      soundId: {
        type: Type.STRING,
        description: 'ID of sound to play',
        enum: ['success', 'complete', 'coin', 'error', 'tick', 'bell', 'whoosh'],
      },
      volume: {
        type: Type.NUMBER,
        description: 'Volume from 0-1 (default 0.5)',
      },
    },
    required: ['soundId'],
  },
};

// ============================================================================
// PITCH BUILDER TOOLS
// ============================================================================

export const savePitchTool: FunctionDeclaration = {
  name: 'save_pitch',
  description: 'Save the generated pitch talking points after interviewing the user.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      topic: {
        type: Type.STRING,
        description: 'The pitch topic/title',
      },
      hook: {
        type: Type.STRING,
        description: 'Opening hook statement',
      },
      problem: {
        type: Type.STRING,
        description: 'Problem statement',
      },
      solution: {
        type: Type.STRING,
        description: 'Solution description',
      },
      proof: {
        type: Type.STRING,
        description: 'Proof points (traction, credentials)',
      },
      ask: {
        type: Type.STRING,
        description: 'The ask/call-to-action',
      },
      bullets: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Key talking points as bullets',
      },
    },
    required: ['topic', 'bullets'],
  },
};

// ============================================================================
// SESSION CONTROL TOOLS
// ============================================================================

export const startSessionTool: FunctionDeclaration = {
  name: 'start_session',
  description: 'Start a practice session with tracking enabled.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      sessionType: {
        type: Type.STRING,
        description: 'Type of session',
        enum: ['warmup', 'lesson', 'practice', 'challenge'],
      },
      config: {
        type: Type.OBJECT,
        description: 'Session configuration',
        properties: {
          trackFillers: { type: Type.BOOLEAN },
          trackPace: { type: Type.BOOLEAN },
          trackPosture: { type: Type.BOOLEAN },
          targetDuration: { type: Type.NUMBER },
        },
      },
    },
    required: ['sessionType'],
  },
};

export const endSessionTool: FunctionDeclaration = {
  name: 'end_session',
  description: 'End the current practice session and calculate final metrics.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      reason: {
        type: Type.STRING,
        description: 'Reason for ending',
        enum: ['completed', 'user_stopped', 'timeout', 'error'],
      },
    },
    required: ['reason'],
  },
};

// ============================================================================
// EXPORT ALL TOOLS
// ============================================================================

export const ALL_TOOLS: FunctionDeclaration[] = [
  navigateToTool,
  showVisualTool,
  hideVisualTool,
  startTimerTool,
  stopTimerTool,
  awardDrachmasTool,
  completeLessonTool,
  completeDrillTool,
  nextStepTool,
  startExerciseTool,
  showFeedbackTool,
  showCelebrationTool,
  playSoundTool,
  savePitchTool,
  startSessionTool,
  endSessionTool,
];

// Tool names for type safety
export type ToolName =
  | 'navigate_to'
  | 'show_visual'
  | 'hide_visual'
  | 'start_timer'
  | 'stop_timer'
  | 'award_drachmas'
  | 'complete_lesson'
  | 'complete_drill'
  | 'next_step'
  | 'start_exercise'
  | 'show_feedback'
  | 'show_celebration'
  | 'play_sound'
  | 'save_pitch'
  | 'start_session'
  | 'end_session';

// ============================================================================
// TOOL ARGUMENT TYPES
// ============================================================================

export interface NavigateToArgs {
  view: string;
  context?: {
    lessonId?: string;
    drillId?: string;
    pillar?: string;
  };
}

export interface ShowVisualArgs {
  visualId: string;
  data?: {
    title?: string;
    content?: string;
    items?: string[];
    duration?: number;
  };
}

export interface HideVisualArgs {
  visualId: string;
}

export interface StartTimerArgs {
  duration: number;
  label?: string;
  autoStart?: boolean;
}

export interface StopTimerArgs {
  reason?: string;
}

export interface AwardDrachmasArgs {
  amount: number;
  reason: string;
  showAnimation?: boolean;
}

export interface CompleteLessonArgs {
  lessonId: string;
  score?: number;
}

export interface CompleteDrillArgs {
  drillId: string;
  score?: number;
  metrics?: {
    fillerCount?: number;
    wordsPerMinute?: number;
    clarity?: number;
  };
}

export interface NextStepArgs {
  stepNumber?: number;
}

export interface StartExerciseArgs {
  exerciseType: 'breathing' | 'vocal_warmup' | 'posture_check' | 'filler_awareness' | 'pace_control' | 'pitch_delivery';
  duration?: number;
  config?: {
    targetWPM?: number;
    maxFillers?: number;
    breathPattern?: string;
  };
}

export interface ShowFeedbackArgs {
  feedbackType: 'positive' | 'improvement' | 'warning' | 'filler_alert' | 'pace_alert' | 'posture_alert';
  message: string;
  duration?: number;
}

export interface ShowCelebrationArgs {
  celebrationType: 'confetti' | 'coins' | 'stars' | 'achievement' | 'streak' | 'level_up';
  message?: string;
}

export interface PlaySoundArgs {
  soundId: 'success' | 'complete' | 'coin' | 'error' | 'tick' | 'bell' | 'whoosh';
  volume?: number;
}

export interface SavePitchArgs {
  topic: string;
  hook?: string;
  problem?: string;
  solution?: string;
  proof?: string;
  ask?: string;
  bullets: string[];
}

export interface StartSessionArgs {
  sessionType: 'warmup' | 'lesson' | 'practice' | 'challenge';
  config?: {
    trackFillers?: boolean;
    trackPace?: boolean;
    trackPosture?: boolean;
    targetDuration?: number;
  };
}

export interface EndSessionArgs {
  reason: 'completed' | 'user_stopped' | 'timeout' | 'error';
}

export type ToolArgs = 
  | { name: 'navigate_to'; args: NavigateToArgs }
  | { name: 'show_visual'; args: ShowVisualArgs }
  | { name: 'hide_visual'; args: HideVisualArgs }
  | { name: 'start_timer'; args: StartTimerArgs }
  | { name: 'stop_timer'; args: StopTimerArgs }
  | { name: 'award_drachmas'; args: AwardDrachmasArgs }
  | { name: 'complete_lesson'; args: CompleteLessonArgs }
  | { name: 'complete_drill'; args: CompleteDrillArgs }
  | { name: 'next_step'; args: NextStepArgs }
  | { name: 'start_exercise'; args: StartExerciseArgs }
  | { name: 'show_feedback'; args: ShowFeedbackArgs }
  | { name: 'show_celebration'; args: ShowCelebrationArgs }
  | { name: 'play_sound'; args: PlaySoundArgs }
  | { name: 'save_pitch'; args: SavePitchArgs }
  | { name: 'start_session'; args: StartSessionArgs }
  | { name: 'end_session'; args: EndSessionArgs };
