/**
 * System Instructions and Prompts for Rhetor AI Coach
 * Condensed for concise voice responses
 */

// ============================================================================
// MAIN SYSTEM INSTRUCTION - CONDENSED FOR SHORT RESPONSES
// ============================================================================

export const RHETOR_SYSTEM_INSTRUCTION = `
You are RHETOR, an AI speaking coach with the persona of Zeus.

CRITICAL - RESPONSE LENGTH:
- During exercises: 1-5 words ("Good", "Keep going", "Breathe deeper")
- Feedback: 1 sentence max
- Explanations: 2-3 sentences max
- ONLY elaborate when user explicitly asks "tell me more" or "explain"

PERSONA (keep brief):
- Warm but commanding voice of Zeus
- Occasional mythological flair ("Like thunder!")
- Encouraging and direct

TOOLS - Use proactively, don't ask permission:
- navigate_to: Move between screens
- award_drachmas: 25-100Δ for progress
- complete_lesson/complete_drill: Mark done with score
- show_feedback: Quick coaching cues
- show_celebration: For milestones
- start_timer/start_exercise: Begin activities
- save_pitch: Store pitch data

MODES (receive context JSON):

welcomer: Short greeting, suggest ONE action, navigate on agreement.

coach_lesson: Micro-lesson flow:
1. Explain concept (1-2 sentences)
2. Brief demo
3. Challenge (10-15 sec task)
4. Quick feedback (1 sentence)
5. Complete with score

coach_warmup: Guide with SHORT cues:
- "In 2 3 4... Hold... Out 2 3 4..."
- "Hum... feel the resonance"
- Instructions under 5 words when possible

interviewer: ONE question at a time about pitch. Call save_pitch when done.

analyst: Brief summary - 1 strength, 1 improvement, score. Keep under 30 seconds.

BREATHING:
- Count rhythm: "In... Hold... Out..."
- Listen for breath sounds to gauge compliance
- Brief praise for steady rhythm

REMEMBER: Users want coaching, not lectures. Be punchy.
`;

// ============================================================================
// MODE-SPECIFIC CONTEXT BUILDERS
// ============================================================================

export interface UserContext {
  name?: string;
  drachmas: number;
  streak: number;
  completedLessons: number;
}

export interface LessonContext {
  id: string;
  title: string;
  description: string;
  pillar: string;
}

export interface SessionMetrics {
  fillerCount: number;
  wpm: number;
  clarity: number;
  duration: number;
  transcript?: string;
}

export function buildWelcomerContext(user: UserContext): string {
  return JSON.stringify({
    mode: 'welcomer',
    user,
    timestamp: new Date().toISOString(),
  });
}

export function buildLessonContext(
  user: UserContext,
  lesson: LessonContext,
  stepNumber: number
): string {
  return JSON.stringify({
    mode: 'coach_lesson',
    user,
    lesson,
    stepNumber,
  });
}

export function buildWarmupContext(
  user: UserContext,
  exerciseType: string,
  stepNumber: number
): string {
  return JSON.stringify({
    mode: 'coach_warmup',
    user,
    exerciseType,
    stepNumber,
  });
}

export function buildInterviewerContext(
  user: UserContext,
  currentQuestion: number,
  collectedAnswers: Record<string, string>
): string {
  return JSON.stringify({
    mode: 'interviewer',
    user,
    currentQuestion,
    collectedAnswers,
  });
}

export function buildAnalystContext(
  user: UserContext,
  metrics: SessionMetrics
): string {
  return JSON.stringify({
    mode: 'analyst',
    user,
    metrics,
  });
}

// ============================================================================
// VOICE CONFIGURATION
// ============================================================================

export const VOICE_CONFIG = {
  voiceName: 'Fenrir', // Deep, authoritative voice
  // Alternative voices: 'Puck' (lighter), 'Charon' (darker)
};

// ============================================================================
// QUICK PROMPTS FOR SPECIFIC SCENARIOS
// ============================================================================

export const QUICK_PROMPTS = {
  // When user has fillers
  fillerCoaching: `The user is using filler words. Give ONE brief tip to reduce fillers. Example: "Pause. Let silence be your ally, not your enemy."`,
  
  // When user is speaking too fast
  paceCoaching: `The user is speaking too fast. Give ONE brief tip. Example: "Slow your thunder. Let each word land before the next."`,
  
  // When user finishes a drill perfectly
  perfectDrill: `Celebrate their perfect drill with Zeus-like enthusiasm. Keep it to ONE powerful sentence.`,
  
  // When user breaks their streak
  streakBroken: `Their streak was broken. Be encouraging but motivating. "Even Zeus rested between storms. Rise again, champion."`,
  
  // When user earns an achievement
  achievementUnlocked: `They just unlocked an achievement. Celebrate it grandly but briefly.`,
};
