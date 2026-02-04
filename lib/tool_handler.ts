/**
 * Tool Handler - Central dispatcher for Gemini function calls
 * 
 * This class receives tool calls from Gemini, validates them,
 * executes the appropriate app actions, and returns responses.
 */

import { useRhetorStore, type RhetorStore } from '../stores/useRhetorStore';
import {
  type ToolName,
  type NavigateToArgs,
  type ShowVisualArgs,
  type HideVisualArgs,
  type StartTimerArgs,
  type StopTimerArgs,
  type AwardDrachmasArgs,
  type CompleteLessonArgs,
  type CompleteDrillArgs,
  type NextStepArgs,
  type StartExerciseArgs,
  type ShowFeedbackArgs,
  type ShowCelebrationArgs,
  type PlaySoundArgs,
  type SavePitchArgs,
  type StartSessionArgs,
  type EndSessionArgs,
} from './tools';

// ============================================================================
// TYPES
// ============================================================================

export interface ToolCallResult {
  success: boolean;
  result?: string;
  error?: string;
  data?: Record<string, unknown>;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

export interface FunctionCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolCallEvent {
  functionCalls: FunctionCall[];
}

export type SoundPlayer = (soundId: string, volume?: number) => void;
export type PitchSaver = (pitch: SavePitchArgs) => void;

// ============================================================================
// TOOL HANDLER CLASS
// ============================================================================

export class ToolHandler {
  private store: typeof useRhetorStore;
  private soundPlayer: SoundPlayer | null = null;
  private pitchSaver: PitchSaver | null = null;
  private pendingConfirmations: Map<string, { toolName: string; args: unknown; resolve: (confirmed: boolean) => void }> = new Map();

  constructor() {
    this.store = useRhetorStore;
  }

  /**
   * Register a sound player function
   */
  setSoundPlayer(player: SoundPlayer): void {
    this.soundPlayer = player;
  }

  /**
   * Register a pitch saver function
   */
  setPitchSaver(saver: PitchSaver): void {
    this.pitchSaver = saver;
  }

  /**
   * Handle a tool call event from Gemini
   */
  async handleToolCall(event: ToolCallEvent): Promise<Array<{ id: string; response: ToolCallResult }>> {
    const responses: Array<{ id: string; response: ToolCallResult }> = [];

    for (const functionCall of event.functionCalls) {
      const result = await this.executeToolCall(functionCall);
      responses.push({ id: functionCall.id, response: result });
    }

    return responses;
  }

  /**
   * Execute a single tool call
   */
  private async executeToolCall(call: FunctionCall): Promise<ToolCallResult> {
    const toolName = call.name as ToolName;
    const args = call.args as unknown;

    try {
      switch (toolName) {
        case 'navigate_to':
          return this.handleNavigateTo(args as NavigateToArgs);
        
        case 'show_visual':
          return this.handleShowVisual(args as ShowVisualArgs);
        
        case 'hide_visual':
          return this.handleHideVisual(args as HideVisualArgs);
        
        case 'start_timer':
          return this.handleStartTimer(args as StartTimerArgs);
        
        case 'stop_timer':
          return this.handleStopTimer(args as StopTimerArgs);
        
        case 'award_drachmas':
          return this.handleAwardDrachmas(args as AwardDrachmasArgs);
        
        case 'complete_lesson':
          return this.handleCompleteLesson(args as CompleteLessonArgs);
        
        case 'complete_drill':
          return this.handleCompleteDrill(args as CompleteDrillArgs);
        
        case 'next_step':
          return this.handleNextStep(args as NextStepArgs);
        
        case 'start_exercise':
          return this.handleStartExercise(args as StartExerciseArgs);
        
        case 'show_feedback':
          return this.handleShowFeedback(args as ShowFeedbackArgs);
        
        case 'show_celebration':
          return this.handleShowCelebration(args as ShowCelebrationArgs);
        
        case 'play_sound':
          return this.handlePlaySound(args as PlaySoundArgs);
        
        case 'save_pitch':
          return this.handleSavePitch(args as SavePitchArgs);
        
        case 'start_session':
          return this.handleStartSession(args as StartSessionArgs);
        
        case 'end_session':
          return this.handleEndSession(args as EndSessionArgs);
        
        default:
          return {
            success: false,
            error: `Unknown tool: ${toolName}`,
          };
      }
    } catch (error) {
      console.error(`[ToolHandler] Error executing ${toolName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // ============================================================================
  // NAVIGATION HANDLERS
  // ============================================================================

  private handleNavigateTo(args: NavigateToArgs): ToolCallResult {
    const state = this.store.getState();
    const { view, context } = args;

    // Check if we're in an active session and navigation should be blocked
    if (state.isSessionActive && state.navigationBlocked) {
      // Store pending navigation for confirmation
      this.store.getState().navigate(view);
      
      if (state.pendingNavigation) {
        return {
          success: false,
          requiresConfirmation: true,
          confirmationMessage: `User is in an active session. Navigating to ${view} requires confirmation. Ask the user if they want to leave the current session.`,
        };
      }
    }

    // Store context if provided (for lesson navigation)
    if (context) {
      if (context.lessonId) {
        this.store.setState({ currentLessonContext: context.lessonId } as Partial<RhetorStore>);
      }
    }

    // Execute navigation
    this.store.getState().navigate(view);

    return {
      success: true,
      result: `Navigated to ${view}`,
      data: { view, context },
    };
  }

  // ============================================================================
  // UI CONTROL HANDLERS
  // ============================================================================

  private handleShowVisual(args: ShowVisualArgs): ToolCallResult {
    const { visualId, data } = args;
    
    this.store.getState().showVisual(visualId, data);

    // Auto-hide if duration specified
    if (data?.duration) {
      setTimeout(() => {
        this.store.getState().hideVisual(visualId);
      }, data.duration * 1000);
    }

    return {
      success: true,
      result: `Showing visual: ${visualId}`,
    };
  }

  private handleHideVisual(args: HideVisualArgs): ToolCallResult {
    const { visualId } = args;
    
    this.store.getState().hideVisual(visualId);

    return {
      success: true,
      result: `Hidden visual: ${visualId}`,
    };
  }

  // ============================================================================
  // TIMER HANDLERS
  // ============================================================================

  private handleStartTimer(args: StartTimerArgs): ToolCallResult {
    const { duration, label } = args;
    
    this.store.getState().startTimer(duration, label);

    return {
      success: true,
      result: `Timer started: ${duration}s${label ? ` (${label})` : ''}`,
    };
  }

  private handleStopTimer(args: StopTimerArgs): ToolCallResult {
    this.store.getState().stopTimer();

    return {
      success: true,
      result: `Timer stopped${args.reason ? `: ${args.reason}` : ''}`,
    };
  }

  // ============================================================================
  // GAMIFICATION HANDLERS
  // ============================================================================

  private handleAwardDrachmas(args: AwardDrachmasArgs): ToolCallResult {
    const { amount, reason, showAnimation = true } = args;
    
    this.store.getState().awardDrachmas(amount, reason);

    if (showAnimation) {
      this.store.getState().triggerCelebration('coins');
      // Auto-clear celebration
      setTimeout(() => {
        this.store.getState().clearCelebration();
      }, 2000);
    }

    const newTotal = this.store.getState().drachmas;

    return {
      success: true,
      result: `Awarded ${amount} drachmas for: ${reason}. Total: ${newTotal}`,
      data: { amount, newTotal },
    };
  }

  // ============================================================================
  // PROGRESS HANDLERS
  // ============================================================================

  private handleCompleteLesson(args: CompleteLessonArgs): ToolCallResult {
    const { lessonId, score } = args;
    
    this.store.getState().completeLesson(lessonId, score);

    // Trigger celebration
    this.store.getState().triggerCelebration('confetti');
    setTimeout(() => {
      this.store.getState().clearCelebration();
    }, 3000);

    // Play completion sound
    if (this.soundPlayer) {
      this.soundPlayer('complete', 0.7);
    }

    const completedCount = this.store.getState().completedLessons.length;

    return {
      success: true,
      result: `Lesson "${lessonId}" completed${score !== undefined ? ` with score ${score}` : ''}! Congratulate the user and guide them to the next step.`,
      data: { lessonId, score, totalCompleted: completedCount },
    };
  }

  private handleCompleteDrill(args: CompleteDrillArgs): ToolCallResult {
    const { drillId, score, metrics } = args;
    
    this.store.getState().completeDrill(drillId, score);

    // Check for filler-free achievement
    if (metrics?.fillerCount === 0) {
      this.store.getState().unlockAchievement('filler_free');
    }

    // Play success sound
    if (this.soundPlayer) {
      this.soundPlayer('success', 0.5);
    }

    return {
      success: true,
      result: `Drill "${drillId}" completed${score !== undefined ? ` with score ${score}` : ''}!`,
      data: { drillId, score, metrics },
    };
  }

  // ============================================================================
  // LESSON FLOW HANDLERS
  // ============================================================================

  private handleNextStep(args: NextStepArgs): ToolCallResult {
    const { stepNumber } = args;
    
    if (stepNumber !== undefined) {
      this.store.getState().setLessonStep(stepNumber);
    } else {
      this.store.getState().nextLessonStep();
    }

    const currentStep = this.store.getState().currentLessonStep;

    return {
      success: true,
      result: `Advanced to step ${currentStep}`,
      data: { currentStep },
    };
  }

  private handleStartExercise(args: StartExerciseArgs): ToolCallResult {
    const { exerciseType, duration, config } = args;
    
    // Start session tracking
    this.store.getState().startSession();
    
    // Set up exercise-specific visuals
    this.store.getState().showVisual(`${exerciseType}_guide`, config);

    // Start timer if duration provided
    if (duration) {
      this.store.getState().startTimer(duration, exerciseType.replace('_', ' '));
    }

    // Block navigation during exercise
    this.store.getState().setNavigationBlocked(true);

    return {
      success: true,
      result: `Started ${exerciseType} exercise${duration ? ` for ${duration}s` : ''}`,
      data: { exerciseType, duration, config },
    };
  }

  // ============================================================================
  // FEEDBACK HANDLERS
  // ============================================================================

  private handleShowFeedback(args: ShowFeedbackArgs): ToolCallResult {
    const { feedbackType, message, duration = 3 } = args;
    
    this.store.getState().showFeedback(feedbackType, message);

    // Auto-clear feedback
    setTimeout(() => {
      this.store.getState().clearFeedback();
    }, duration * 1000);

    return {
      success: true,
      result: `Showing ${feedbackType} feedback: "${message}"`,
    };
  }

  private handleShowCelebration(args: ShowCelebrationArgs): ToolCallResult {
    const { celebrationType, message } = args;
    
    this.store.getState().triggerCelebration(celebrationType);

    // Play appropriate sound
    if (this.soundPlayer) {
      const soundMap: Record<string, string> = {
        confetti: 'complete',
        coins: 'coin',
        stars: 'success',
        achievement: 'complete',
        streak: 'success',
        level_up: 'complete',
      };
      this.soundPlayer(soundMap[celebrationType] || 'success', 0.6);
    }

    // Auto-clear celebration
    setTimeout(() => {
      this.store.getState().clearCelebration();
    }, 3000);

    return {
      success: true,
      result: `Triggered ${celebrationType} celebration${message ? `: "${message}"` : ''}`,
    };
  }

  // ============================================================================
  // AUDIO HANDLERS
  // ============================================================================

  private handlePlaySound(args: PlaySoundArgs): ToolCallResult {
    const { soundId, volume = 0.5 } = args;
    
    if (this.soundPlayer) {
      this.soundPlayer(soundId, volume);
      return {
        success: true,
        result: `Playing sound: ${soundId}`,
      };
    }

    return {
      success: false,
      error: 'Sound player not configured',
    };
  }

  // ============================================================================
  // PITCH BUILDER HANDLERS
  // ============================================================================

  private handleSavePitch(args: SavePitchArgs): ToolCallResult {
    if (this.pitchSaver) {
      this.pitchSaver(args);
    }

    // Store in visual for display
    this.store.getState().showVisual('pitch_bullets', {
      title: args.topic,
      items: args.bullets,
    });

    return {
      success: true,
      result: `Pitch saved: "${args.topic}" with ${args.bullets.length} talking points. The user can now practice with these bullet points.`,
      data: args as unknown as Record<string, unknown>,
    };
  }

  // ============================================================================
  // SESSION HANDLERS
  // ============================================================================

  private handleStartSession(args: StartSessionArgs): ToolCallResult {
    const { sessionType, config } = args;
    
    this.store.getState().startSession();
    this.store.getState().setNavigationBlocked(true);

    // Show relevant visuals based on config
    if (config?.trackFillers) {
      this.store.getState().showVisual('filler_counter');
    }
    if (config?.trackPosture) {
      this.store.getState().showVisual('posture_overlay');
    }

    return {
      success: true,
      result: `Started ${sessionType} session with tracking enabled`,
      data: { sessionType, config },
    };
  }

  private handleEndSession(args: EndSessionArgs): ToolCallResult {
    const { reason } = args;
    
    // Get final metrics before ending
    const metrics = this.store.getState().currentMetrics;
    
    this.store.getState().endSession();
    this.store.getState().setNavigationBlocked(false);

    // Hide session-related visuals
    this.store.getState().hideVisual('filler_counter');
    this.store.getState().hideVisual('posture_overlay');
    this.store.getState().hideVisual('timer_display');

    return {
      success: true,
      result: `Session ended: ${reason}`,
      data: { reason, metrics },
    };
  }

  // ============================================================================
  // CONFIRMATION HANDLING
  // ============================================================================

  /**
   * Confirm a pending navigation
   */
  confirmPendingNavigation(): void {
    this.store.getState().confirmNavigation();
  }

  /**
   * Cancel a pending navigation
   */
  cancelPendingNavigation(): void {
    this.store.getState().cancelNavigation();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let toolHandlerInstance: ToolHandler | null = null;

export function getToolHandler(): ToolHandler {
  if (!toolHandlerInstance) {
    toolHandlerInstance = new ToolHandler();
  }
  return toolHandlerInstance;
}

export function resetToolHandler(): void {
  toolHandlerInstance = null;
}
