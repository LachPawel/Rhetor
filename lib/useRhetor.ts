/**
 * useRhetor - Main hook for Rhetor AI integration
 * 
 * This hook wires together:
 * - Gemini Live client (voice AI)
 * - Tool handler (app control)
 * - Filler detector (real-time analysis)
 * - Audio streaming (playback)
 * - Audio recording (microphone)
 * - Zustand store (state)
 */

import React, { useEffect, useRef, useCallback, useState, createContext, useContext, type ReactNode } from 'react';
import { useRhetorStore } from '../stores/useRhetorStore';
import { GeminiLiveClient, createGeminiLiveClient, type ConnectionStatus } from './gemini_client';
import { getToolHandler } from './tool_handler';
import { useFillerDetector } from './filler_detector';
import { AudioStreamer } from './audio_streamer';
import { AudioRecorder } from './audio_recorder';
import { RHETOR_SYSTEM_INSTRUCTION, VOICE_CONFIG, buildWelcomerContext, buildLessonContext, buildWarmupContext, buildAnalystContext, buildPracticeContext, buildContentBuilderContext } from './prompts';
import type { AIMode } from '../stores/useRhetorStore';
import { Modality } from '@google/genai';

// ============================================================================
// TYPES
// ============================================================================

export interface UseRhetorOptions {
  apiKey: string;
  autoConnect?: boolean;
  enableFillerDetection?: boolean;
}

export interface UseRhetorReturn {
  // Connection
  connect: () => Promise<boolean>;
  disconnect: () => void;
  reconnect: () => Promise<boolean>;
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  lastError: string | null;
  
  // Audio
  startListening: () => Promise<boolean>;
  stopListening: () => void;
  isListening: boolean;
  isSpeaking: boolean;
  volume: number;
  
  // AI Interaction
  sendMessage: (text: string) => void;
  setMode: (mode: AIMode, context?: Record<string, unknown>) => void;
  interruptAI: () => void;
  
  // Filler Detection
  fillerStats: ReturnType<typeof useFillerDetector>['stats'];
  lastFiller: ReturnType<typeof useFillerDetector>['lastFiller'];
  
  // Transcript
  userTranscript: string;
  aiTranscript: string;
  resetTranscript: () => void;
  
  // State shortcuts
  drachmas: number;
  streak: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AUDIO_SAMPLE_RATE = 24000; // Gemini output
const MIC_SAMPLE_RATE = 16000;   // Gemini input

// ============================================================================
// HOOK
// ============================================================================

export function useRhetor(options: UseRhetorOptions): UseRhetorReturn {
  const { apiKey, autoConnect = false, enableFillerDetection = true } = options;
  
  /** Strip Gemini control tokens (e.g. <ctrl46>, </ctrl46>) from transcription text. */
  const sanitizeTranscription = (text: string): string =>
    text.replace(/<\/?ctrl\d+>/gi, '').replace(/\s{2,}/g, ' ').trim();

  // Refs
  const clientRef = useRef<GeminiLiveClient | null>(null);
  const streamerRef = useRef<AudioStreamer | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const finalizedTranscriptRef = useRef('');
  const finalizedAiTranscriptRef = useRef('');
  const lastContextRef = useRef<string | null>(null);
  
  // Local state
  const [userTranscript, setUserTranscript] = useState('');
  const [aiTranscript, setAiTranscript] = useState('');
  const [volume, setVolume] = useState(0);
  const [isListening, setIsListening] = useState(false);
  
  // Zustand store
  const connectionStatus = useRhetorStore(s => s.connectionStatus);
  const setConnectionStatus = useRhetorStore(s => s.setConnectionStatus);
  const isSpeaking = useRhetorStore(s => s.isSpeaking);
  const setIsSpeaking = useRhetorStore(s => s.setIsSpeaking);
  const setIsListeningStore = useRhetorStore(s => s.setIsListening);
  const currentMode = useRhetorStore(s => s.currentMode);
  const setModeStore = useRhetorStore(s => s.setMode);
  const lastError = useRhetorStore(s => s.lastError);
  const setError = useRhetorStore(s => s.setError);
  const drachmas = useRhetorStore(s => s.drachmas);
  const streak = useRhetorStore(s => s.currentStreak);
  const updateTranscript = useRhetorStore(s => s.updateTranscript);
  const addFillerEvent = useRhetorStore(s => s.addFillerEvent);
  
  // Filler detector hook
  const { stats: fillerStats, lastFiller, processTranscript } = useFillerDetector();
  
  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  // Lazily initialise AudioContext + AudioStreamer (must happen after a user gesture)
  const ensureAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
    }
    if (!streamerRef.current) {
      streamerRef.current = new AudioStreamer(audioContextRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      // Cleanup — null the refs so fresh instances are created on remount (React Strict Mode)
      if (clientRef.current) {
        clientRef.current.destroy();
        clientRef.current = null;
      }
      if (recorderRef.current) {
        recorderRef.current.stop();
        recorderRef.current = null;
      }
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
      }
      audioContextRef.current = null;
      streamerRef.current = null;
    };
  }, []);
  
  // ============================================================================
  // CONNECTION
  // ============================================================================
  
  const connect = useCallback(async (): Promise<boolean> => {
    if (!apiKey) {
      setError('API key is required');
      return false;
    }
    
    // Create client if needed (only once)
    if (!clientRef.current) {
      const client = createGeminiLiveClient(apiKey);
      clientRef.current = client;
      
      // Set up event listeners ONCE on the fresh client
      client.on('statuschange', (status: ConnectionStatus) => {
        setConnectionStatus(status);
      });
      
      client.on('audio', (data: ArrayBuffer) => {
        setIsSpeaking(true);
        streamerRef.current?.addPCM16(new Uint8Array(data));
      });
      
      client.on('turncomplete', () => {
        // Just signal the streamer that no more chunks are incoming.
        // The streamer will call onComplete() when the queue is actually empty.
        streamerRef.current?.complete();
      });
      
      client.on('interrupted', () => {
        setIsSpeaking(false);
        streamerRef.current?.stop();
      });
      
      client.on('inputTranscription', (text: string) => {
        // Gemini Live API sends transcription fragments without an isFinal flag.
        // Each event carries a small text fragment — always accumulate.
        // Strip control tokens like <ctrl46> that leak from the audio model.
        const trimmed = sanitizeTranscription(text);
        if (!trimmed) {
          console.log('[useRhetor] inputTranscription event received but sanitized to empty, raw:', JSON.stringify(text));
          return;
        }

        const separator = finalizedTranscriptRef.current ? ' ' : '';
        finalizedTranscriptRef.current += separator + trimmed;
        setUserTranscript(finalizedTranscriptRef.current);

        console.log('[useRhetor] inputTranscription:', JSON.stringify(trimmed), '| total length:', finalizedTranscriptRef.current.length);

        // Process for fillers
        if (enableFillerDetection) {
          const detections = processTranscript(trimmed);
          detections.forEach(d => addFillerEvent(d.word, d.position));
        }

        // Update store with full accumulated transcript
        updateTranscript(finalizedTranscriptRef.current);
      });
      
      client.on('outputTranscription', (text: string) => {
        // Same as input: always accumulate each fragment.
        // Strip control tokens like <ctrl46> that leak from the audio model.
        const trimmed = sanitizeTranscription(text);
        if (!trimmed) return;

        const separator = finalizedAiTranscriptRef.current ? ' ' : '';
        finalizedAiTranscriptRef.current += separator + trimmed;
        setAiTranscript(finalizedAiTranscriptRef.current);
      });
      
      client.on('error', (e: Error) => {
        console.error('[useRhetor] Client error:', e);
        setError(e.message);
      });
      
      client.on('reconnecting', (attempt: number, max: number) => {
        console.log(`[useRhetor] Reconnecting ${attempt}/${max}`);
      });
      
      client.on('reconnected', () => {
        setError(null);
        // Re-establish mode context on the fresh session
        if (lastContextRef.current) {
          setTimeout(() => {
            if (clientRef.current?.isConnected) {
              clientRef.current.send({ text: `CONTEXT: ${lastContextRef.current}` });
              console.log('[useRhetor] Restored mode context after reconnection');
            }
          }, 500);
        }
      });
    }
    
    const client = clientRef.current;
    
    // Create AudioContext now (inside a user-gesture-initiated call path)
    ensureAudioContext();
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    
    // Set up streamer completion handler
    if (streamerRef.current) {
      streamerRef.current.onComplete = () => {
        setIsSpeaking(false);
      };
    }
    
    // Connect with configuration (flat LiveConnectConfig — no generationConfig wrapper)
    const success = await client.connect({
      systemInstruction: { parts: [{ text: RHETOR_SYSTEM_INSTRUCTION }] },
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: VOICE_CONFIG.voiceName },
        },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    });
    
    // Start microphone if we just connected OR if already connected
    // (handles the case where client.connect() returns false because it's
    // already connected, but the mic isn't running — e.g. after reconnect)
    const isNowConnected = success || (clientRef.current?.isConnected ?? false);
    if (isNowConnected) {
      // Start microphone immediately (no timeout) to preserve user gesture context
      // which is often required to resume/start AudioContext on webkit browsers.
      (async () => {
        try {
          // If recorder exists but isn't recording, tear it down so we get a fresh one
          if (recorderRef.current && !recorderRef.current.recording) {
            recorderRef.current.stop();
            recorderRef.current = null;
          }
          
          // Skip if mic is already running
          if (recorderRef.current?.recording) {
            console.log('[useRhetor] Mic already running, skipping start');
            setIsListening(true);
            setIsListeningStore(true);
            return;
          }
          
          // Create fresh recorder
          recorderRef.current = new AudioRecorder(MIC_SAMPLE_RATE);
          
          recorderRef.current.on('data', (base64: string) => {
            clientRef.current?.sendRealtimeInput([{
              mimeType: 'audio/pcm;rate=16000',
              data: base64,
            }]);
          });
          
          recorderRef.current.on('volume', (vol: number) => {
            setVolume(vol);
          });
          
          await recorderRef.current.start();
          console.log('[useRhetor] Microphone started successfully');
          setIsListening(true);
          setIsListeningStore(true);
        } catch (e) {
          console.error('[useRhetor] Error starting microphone:', e);
          setError(e instanceof Error ? e.message : 'Microphone access denied');
        }
      })();
    }
    
    return success;
  }, [apiKey, enableFillerDetection, ensureAudioContext, processTranscript, setConnectionStatus, setIsSpeaking, setError, updateTranscript, addFillerEvent, setIsListeningStore]);
  
  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;  // Force fresh recorder on next connect
    }
    setIsListening(false);
    setIsListeningStore(false);
  }, [setIsListeningStore]);
  
  const reconnect = useCallback(async (): Promise<boolean> => {
    return clientRef.current?.reconnect() ?? false;
  }, []);
  
  // Auto-connect if enabled (fire once on mount, not on every connect ref change)
  const connectRef = useRef(connect);
  connectRef.current = connect;
  useEffect(() => {
    if (autoConnect && apiKey) {
      connectRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, apiKey]);
  
  // ============================================================================
  // TRANSCRIPT RESET
  // ============================================================================

  const resetTranscript = useCallback(() => {
    finalizedTranscriptRef.current = '';
    finalizedAiTranscriptRef.current = '';
    setUserTranscript('');
    setAiTranscript('');
    console.log('[useRhetor] Transcript reset');
  }, []);

  // ============================================================================
  // AUDIO RECORDING
  // ============================================================================
  
  const startListening = useCallback(async (): Promise<boolean> => {
    if (!clientRef.current?.isConnected) {
      console.warn('[useRhetor] Cannot start listening: not connected');
      return false;
    }
    
    try {
      // Create recorder if needed
      if (!recorderRef.current) {
        recorderRef.current = new AudioRecorder(MIC_SAMPLE_RATE);
        
        recorderRef.current.on('data', (base64: string) => {
          clientRef.current?.sendRealtimeInput([{
            mimeType: 'audio/pcm;rate=16000',
            data: base64,
          }]);
        });
        
        recorderRef.current.on('volume', (vol: number) => {
          setVolume(vol);
        });
      }
      
      await recorderRef.current.start();
      setIsListening(true);
      setIsListeningStore(true);
      finalizedTranscriptRef.current = '';
      finalizedAiTranscriptRef.current = '';
      setUserTranscript('');
      setAiTranscript('');
      
      return true;
    } catch (e) {
      console.error('[useRhetor] Error starting recording:', e);
      setError(e instanceof Error ? e.message : 'Microphone access denied');
      return false;
    }
  }, [setIsListeningStore, setError]);
  
  const stopListening = useCallback(() => {
    recorderRef.current?.stop();
    setIsListening(false);
    setIsListeningStore(false);
    setVolume(0);
  }, [setIsListeningStore]);
  
  // ============================================================================
  // AI INTERACTION
  // ============================================================================
  
  const sendMessage = useCallback((text: string) => {
    if (!clientRef.current?.isConnected) {
      console.warn('[useRhetor] Cannot send message: not connected');
      return;
    }
    
    clientRef.current.send({ text });
  }, []);
  
  const setMode = useCallback((mode: AIMode, context?: Record<string, unknown>) => {
    setModeStore(mode);
    
    if (!clientRef.current?.isConnected) return;
    
    // Build context based on mode
    const user = {
      drachmas: useRhetorStore.getState().drachmas,
      streak: useRhetorStore.getState().currentStreak,
      completedLessons: useRhetorStore.getState().completedLessons.length,
    };
    
    let contextJson: string;
    
    switch (mode) {
      case 'welcomer':
        contextJson = buildWelcomerContext(user);
        break;
      case 'coach_lesson':
        contextJson = buildLessonContext(
          user,
          context?.lesson as { id: string; title: string; description: string; pillar: string },
          (context?.stepNumber as number) ?? 0,
          context?.step as { index: number; total: number; type: string; aiPrompt: string; expectedAction?: string; duration?: number } | undefined
        );
        break;
      case 'coach_warmup':
        contextJson = buildWarmupContext(
          user,
          (context?.exerciseType as string) ?? 'breathing',
          (context?.stepNumber as number) ?? 0,
          (context?.stage as string) ?? undefined,
          context?.detail as { exerciseName?: string; instruction?: string; poseMatched?: boolean; poseHint?: string | null } | undefined
        );
        break;
      case 'coach_practice':
        contextJson = buildPracticeContext(
          user,
          (context?.talkingPoints as string[]) ?? useRhetorStore.getState().talkingPoints,
          useRhetorStore.getState().pitchTopic,
          {
            fillerCount: useRhetorStore.getState().currentMetrics?.fillerCount ?? 0,
            wpm: useRhetorStore.getState().currentMetrics?.wpm ?? 0,
            clarity: useRhetorStore.getState().currentMetrics?.clarity ?? 100,
            duration: useRhetorStore.getState().currentMetrics?.duration ?? 0,
          }
        );
        break;
      case 'analyst':
        contextJson = buildAnalystContext(user, {
          fillerCount: useRhetorStore.getState().currentMetrics?.fillerCount ?? 0,
          wpm: useRhetorStore.getState().currentMetrics?.wpm ?? 0,
          clarity: useRhetorStore.getState().currentMetrics?.clarity ?? 100,
          duration: useRhetorStore.getState().currentMetrics?.duration ?? 0,
          transcript: useRhetorStore.getState().transcript,
          talkingPoints: useRhetorStore.getState().talkingPoints,
        });
        break;
      case 'content_builder':
        contextJson = buildContentBuilderContext(
          user,
          (context?.sourceText as string) ?? '',
          (context?.requestType as 'extract' | 'improve') ?? 'extract'
        );
        break;
      default:
        contextJson = JSON.stringify({ mode, user, ...context });
    }
    
    // Track for reconnection restoration and send to AI
    lastContextRef.current = contextJson;
    clientRef.current.send({ text: `CONTEXT: ${contextJson}` });
  }, [setModeStore]);
  
  const interruptAI = useCallback(() => {
    if (!clientRef.current?.isConnected) return;
    
    // Stop audio playback
    streamerRef.current?.stop();
    setIsSpeaking(false);
    
    // Send interrupt signal (speaking while AI is talking)
    // The API handles this automatically when receiving audio
  }, [setIsSpeaking]);
  
  // ============================================================================
  // RETURN
  // ============================================================================
  
  return {
    // Connection
    connect,
    disconnect,
    reconnect,
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    lastError,
    
    // Audio
    startListening,
    stopListening,
    isListening,
    isSpeaking,
    volume,
    
    // AI Interaction
    sendMessage,
    setMode,
    interruptAI,
    
    // Filler Detection
    fillerStats,
    lastFiller,
    
    // Transcript
    userTranscript,
    aiTranscript,
    resetTranscript,
    
    // State shortcuts
    drachmas,
    streak,
  };
}

// ============================================================================
// PROVIDER COMPONENT (optional, for context-based usage)
// ============================================================================

const RhetorContext = createContext<UseRhetorReturn | null>(null);

export interface RhetorProviderProps {
  children: ReactNode;
  apiKey: string;
  autoConnect?: boolean;
}

export function RhetorProvider({ children, apiKey, autoConnect }: RhetorProviderProps): React.JSX.Element {
  const rhetor = useRhetor({ apiKey, autoConnect });
  
  return React.createElement(RhetorContext.Provider, { value: rhetor }, children);
}

export function useRhetorContext(): UseRhetorReturn {
  const context = useContext(RhetorContext);
  if (!context) {
    throw new Error('useRhetorContext must be used within a RhetorProvider');
  }
  return context;
}
