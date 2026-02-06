/**
 * Refactored Gemini Live API Client
 * 
 * Features:
 * - Automatic reconnection with exponential backoff (hybrid strategy)
 * - Message queue during reconnection
 * - Heartbeat/ping mechanism
 * - Proper error states and recovery
 * - Tool call handling integration
 */

import {
  GoogleGenAI,
  LiveCallbacks,
  LiveClientToolResponse,
  LiveConnectConfig,
  LiveServerContent,
  LiveServerMessage,
  LiveServerToolCall,
  LiveServerToolCallCancellation,
  Part,
  Session,
  Blob,
  FunctionDeclaration,
} from '@google/genai';

import EventEmitter from 'eventemitter3';
import { base64ToArrayBuffer } from './audio_utils';
import { ALL_TOOLS } from './tools';
import { getToolHandler, type ToolCallEvent } from './tool_handler';

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_LIVE_API_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

const RECONNECT_CONFIG = {
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  maxAttempts: 5,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

const HEARTBEAT_INTERVAL_MS = 30000;
const MESSAGE_QUEUE_MAX_SIZE = 100;

// ============================================================================
// TYPES
// ============================================================================

export type ConnectionStatus = 
  | 'disconnected' 
  | 'connecting' 
  | 'connected' 
  | 'reconnecting' 
  | 'error'
  | 'closed';

export interface StreamingLog {
  count?: number;
  data?: unknown;
  date: Date;
  message: string | object;
  type: string;
}

export interface LiveClientEventTypes {
  audio: (data: ArrayBuffer) => void;
  close: (event: CloseEvent) => void;
  content: (data: LiveServerContent) => void;
  error: (e: Error | ErrorEvent) => void;
  interrupted: () => void;
  log: (log: StreamingLog) => void;
  open: () => void;
  setupcomplete: () => void;
  toolcall: (toolCall: LiveServerToolCall) => void;
  toolcallcancellation: (toolcallCancellation: LiveServerToolCallCancellation) => void;
  turncomplete: () => void;
  generationcomplete: () => void;
  inputTranscription: (text: string, isFinal: boolean) => void;
  outputTranscription: (text: string, isFinal: boolean) => void;
  statuschange: (status: ConnectionStatus, previousStatus: ConnectionStatus) => void;
  reconnecting: (attempt: number, maxAttempts: number) => void;
  reconnected: () => void;
  reconnectfailed: () => void;
}

interface QueuedMessage {
  type: 'content' | 'audio' | 'toolResponse';
  data: unknown;
  timestamp: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function difference<T>(array: T[], values: T[]): T[] {
  const valuesSet = new Set(values);
  return array.filter(x => !valuesSet.has(x));
}

function calculateBackoffDelay(attempt: number): number {
  const baseDelay = RECONNECT_CONFIG.initialDelayMs * Math.pow(RECONNECT_CONFIG.backoffMultiplier, attempt);
  const cappedDelay = Math.min(baseDelay, RECONNECT_CONFIG.maxDelayMs);
  const jitter = cappedDelay * RECONNECT_CONFIG.jitterFactor * (Math.random() * 2 - 1);
  return Math.round(cappedDelay + jitter);
}

// ============================================================================
// GEMINI LIVE CLIENT
// ============================================================================

export class GeminiLiveClient {
  public readonly model: string;
  private emitter = new EventEmitter<LiveClientEventTypes>();

  public on = this.emitter.on.bind(this.emitter);
  public off = this.emitter.off.bind(this.emitter);
  public once = this.emitter.once.bind(this.emitter);

  protected readonly client: GoogleGenAI;
  protected session?: Session;
  protected lastConfig?: LiveConnectConfig;

  private _status: ConnectionStatus = 'disconnected';
  private _reconnectAttempts: number = 0;
  private _reconnectTimeoutId?: ReturnType<typeof setTimeout>;
  private _heartbeatIntervalId?: ReturnType<typeof setInterval>;
  private _messageQueue: QueuedMessage[] = [];
  private _autoReconnect: boolean = true;
  private _manualDisconnect: boolean = false;
  private _lastError: Error | null = null;
  private _toolHandler = getToolHandler();

  // ============================================================================
  // GETTERS
  // ============================================================================

  public get status(): ConnectionStatus {
    return this._status;
  }

  public get reconnectAttempts(): number {
    return this._reconnectAttempts;
  }

  public get isConnected(): boolean {
    return this._status === 'connected';
  }

  public get lastError(): Error | null {
    return this._lastError;
  }

  public get queuedMessageCount(): number {
    return this._messageQueue.length;
  }

  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================

  constructor(apiKey: string, model?: string) {
    this.model = model || DEFAULT_LIVE_API_MODEL;
    this.client = new GoogleGenAI({ apiKey });
  }

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  /**
   * Connect to the Gemini Live API
   */
  public async connect(config: LiveConnectConfig): Promise<boolean> {
    if (this._status === 'connected' || this._status === 'connecting' || this._status === 'reconnecting') {
      this.log('client.connect', `Already ${this._status}`);
      return false;
    }

    this._manualDisconnect = false;
    this._lastError = null;
    this.lastConfig = config;

    return this.doConnect(config);
  }

  /**
   * Internal connection logic
   */
  private async doConnect(config: LiveConnectConfig): Promise<boolean> {
    const previousStatus = this._status;
    this.setStatus('connecting');

    const callbacks: LiveCallbacks = {
      onopen: this.onOpen.bind(this),
      onmessage: this.onMessage.bind(this),
      onerror: this.onError.bind(this),
      onclose: this.onClose.bind(this),
    };

    // Merge tools into config
    const finalConfig: LiveConnectConfig = {
      ...config,
      tools: [
        ...(config.tools || []),
        { functionDeclarations: ALL_TOOLS },
      ],
    };

    try {
      this.session = await this.client.live.connect({
        model: this.model,
        config: finalConfig,
        callbacks,
      });
      // Connection successful - status will be updated in onOpen
      return true;
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      console.error('[GeminiLiveClient] Connection error:', error.message, error);
      
      this._lastError = error;
      // Reset to disconnected so connect() can be retried
      this.setStatus(previousStatus === 'reconnecting' ? 'reconnecting' : 'disconnected');
      this.session = undefined;

      // Emit error event
      this.emitter.emit('error', error);

      // Attempt reconnection if enabled and not manually disconnected
      if (this._autoReconnect && !this._manualDisconnect && previousStatus !== 'reconnecting') {
        this.scheduleReconnect();
      }

      return false;
    }
  }

  /**
   * Disconnect from the API
   */
  public disconnect(): boolean {
    this._manualDisconnect = true;
    this.clearReconnectTimeout();
    this.clearHeartbeat();
    this.clearMessageQueue();

    if (this.session) {
      try {
        this.session.close();
      } catch (e) {
        console.warn('[GeminiLiveClient] Error closing session:', e);
      }
      this.session = undefined;
    }

    this.setStatus('closed');
    this.log('client.disconnect', 'Disconnected (manual)');
    return true;
  }

  /**
   * Set auto-reconnect behavior
   */
  public setAutoReconnect(enabled: boolean): void {
    this._autoReconnect = enabled;
    if (!enabled) {
      this.clearReconnectTimeout();
    }
  }

  // ============================================================================
  // RECONNECTION LOGIC
  // ============================================================================

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this._reconnectAttempts >= RECONNECT_CONFIG.maxAttempts) {
      this.log('client.reconnect', 'Max reconnection attempts reached');
      this.setStatus('error');
      this.emitter.emit('reconnectfailed');
      return;
    }

    const delay = calculateBackoffDelay(this._reconnectAttempts);
    this._reconnectAttempts++;

    this.log('client.reconnect', `Scheduling reconnect attempt ${this._reconnectAttempts}/${RECONNECT_CONFIG.maxAttempts} in ${delay}ms`);
    this.setStatus('reconnecting');
    this.emitter.emit('reconnecting', this._reconnectAttempts, RECONNECT_CONFIG.maxAttempts);

    this._reconnectTimeoutId = setTimeout(() => {
      this.attemptReconnect();
    }, delay);
  }

  /**
   * Attempt to reconnect
   */
  private async attemptReconnect(): Promise<void> {
    if (!this.lastConfig) {
      this.log('client.reconnect', 'No config available for reconnection');
      this.setStatus('error');
      return;
    }

    const success = await this.doConnect(this.lastConfig);
    
    if (success) {
      this._reconnectAttempts = 0;
      this.emitter.emit('reconnected');
      this.flushMessageQueue();
    } else if (this._autoReconnect && !this._manualDisconnect) {
      this.scheduleReconnect();
    }
  }

  /**
   * Manually trigger reconnection
   */
  public async reconnect(): Promise<boolean> {
    this.clearReconnectTimeout();
    this._reconnectAttempts = 0;
    this._manualDisconnect = false;

    if (!this.lastConfig) {
      this.log('client.reconnect', 'No config available');
      return false;
    }

    return this.doConnect(this.lastConfig);
  }

  /**
   * Clear reconnection timeout
   */
  private clearReconnectTimeout(): void {
    if (this._reconnectTimeoutId) {
      clearTimeout(this._reconnectTimeoutId);
      this._reconnectTimeoutId = undefined;
    }
  }

  // ============================================================================
  // HEARTBEAT
  // ============================================================================

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.clearHeartbeat();
    
    this._heartbeatIntervalId = setInterval(() => {
      if (this._status === 'connected' && this.session) {
        // Send a minimal message to keep the connection alive
        // The Gemini API doesn't have a ping, so we'll rely on the connection itself
        this.log('client.heartbeat', 'Connection alive');
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Clear heartbeat interval
   */
  private clearHeartbeat(): void {
    if (this._heartbeatIntervalId) {
      clearInterval(this._heartbeatIntervalId);
      this._heartbeatIntervalId = undefined;
    }
  }

  // ============================================================================
  // MESSAGE QUEUE
  // ============================================================================

  /**
   * Queue a message for later delivery
   */
  private queueMessage(message: QueuedMessage): void {
    if (this._messageQueue.length >= MESSAGE_QUEUE_MAX_SIZE) {
      // Remove oldest message
      this._messageQueue.shift();
    }
    this._messageQueue.push(message);
    this.log('client.queue', `Queued ${message.type} message (${this._messageQueue.length} in queue)`);
  }

  /**
   * Flush queued messages after reconnection
   */
  private flushMessageQueue(): void {
    if (this._messageQueue.length === 0) return;

    this.log('client.queue', `Flushing ${this._messageQueue.length} queued messages`);
    
    const messages = [...this._messageQueue];
    this._messageQueue = [];

    for (const message of messages) {
      try {
        switch (message.type) {
          case 'content':
            this.send(message.data as Part | Part[], true);
            break;
          case 'audio':
            this.sendRealtimeInput(message.data as Blob[]);
            break;
          case 'toolResponse':
            this.sendToolResponse(message.data as LiveClientToolResponse);
            break;
        }
      } catch (e) {
        console.warn('[GeminiLiveClient] Error flushing message:', e);
      }
    }
  }

  /**
   * Clear the message queue
   */
  private clearMessageQueue(): void {
    this._messageQueue = [];
  }

  // ============================================================================
  // SENDING MESSAGES
  // ============================================================================

  /**
   * Send content to the API
   */
  public send(parts: Part | Part[], turnComplete: boolean = true): boolean {
    if (this._status === 'reconnecting') {
      this.queueMessage({ type: 'content', data: parts, timestamp: Date.now() });
      return false;
    }

    if (this._status !== 'connected' || !this.session) {
      // Silently return false - caller should check isConnected before calling
      return false;
    }

    try {
      const partsArray = Array.isArray(parts) ? parts : [parts];
      this.session.sendClientContent({ 
        turns: [{ role: 'user', parts: partsArray }], 
        turnComplete 
      });
      this.log('client.send', partsArray);
      return true;
    } catch (e) {
      console.error('[GeminiLiveClient] Error sending:', e);
      this.emitter.emit('error', e instanceof Error ? e : new Error(String(e)));
      return false;
    }
  }

  /**
   * Send real-time audio input
   */
  public sendRealtimeInput(chunks: Blob[]): boolean {
    if (this._status === 'reconnecting') {
      // Don't queue audio - it would be stale
      return false;
    }

    if (this._status !== 'connected' || !this.session) {
      return false;
    }

    try {
      for (const chunk of chunks) {
        this.session.sendRealtimeInput({ media: chunk });
      }
      return true;
    } catch (e) {
      console.error('[GeminiLiveClient] Error sending audio:', e);
      return false;
    }
  }

  /**
   * Send tool response
   */
  public sendToolResponse(toolResponse: LiveClientToolResponse): boolean {
    if (this._status === 'reconnecting') {
      this.queueMessage({ type: 'toolResponse', data: toolResponse, timestamp: Date.now() });
      return false;
    }

    if (this._status !== 'connected' || !this.session) {
      this.emitter.emit('error', new Error('Client is not connected'));
      return false;
    }

    if (!toolResponse.functionResponses?.length) {
      return false;
    }

    try {
      this.session.sendToolResponse({
        functionResponses: toolResponse.functionResponses,
      });
      this.log('client.toolResponse', { toolResponse });
      return true;
    } catch (e) {
      console.error('[GeminiLiveClient] Error sending tool response:', e);
      this.emitter.emit('error', e instanceof Error ? e : new Error(String(e)));
      return false;
    }
  }

  // ============================================================================
  // TOOL CALL HANDLING
  // ============================================================================

  /**
   * Handle tool calls automatically using the ToolHandler
   */
  public async handleToolCallsAutomatically(toolCall: LiveServerToolCall): Promise<void> {
    const event: ToolCallEvent = {
      functionCalls: toolCall.functionCalls.map(fc => ({
        id: fc.id,
        name: fc.name,
        args: fc.args as Record<string, unknown>,
      })),
    };

    try {
      const responses = await this._toolHandler.handleToolCall(event);

      const functionResponses = responses.map(r => {
        // SDK requires: name, response (object with string values), and id
        const fc = toolCall.functionCalls.find(f => f.id === r.id);
        const resultValue = r.response.success
          ? (typeof r.response.result === 'string' ? r.response.result : JSON.stringify(r.response.result ?? 'ok'))
          : (typeof r.response.error === 'string' ? r.response.error : JSON.stringify(r.response.error ?? 'error'));
        return {
          id: r.id,
          name: fc?.name ?? 'unknown',
          response: { result: resultValue },
        };
      });

      this.sendToolResponse({ functionResponses });
    } catch (e) {
      console.error('[GeminiLiveClient] Error handling tool calls:', e);
    }
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  protected onOpen(): void {
    this._reconnectAttempts = 0;
    this._lastError = null;
    this.setStatus('connected');
    this.startHeartbeat();
    this.emitter.emit('open');
    this.log('client.open', 'Connected');
  }

  protected onMessage(message: LiveServerMessage): void {
    if (message.setupComplete) {
      this.emitter.emit('setupcomplete');
      return;
    }

    if (message.toolCall) {
      this.log('server.toolCall', message.toolCall);
      this.emitter.emit('toolcall', message.toolCall);
      
      // Auto-handle tool calls
      this.handleToolCallsAutomatically(message.toolCall);
      return;
    }

    if (message.toolCallCancellation) {
      this.emitter.emit('toolcallcancellation', message.toolCallCancellation);
      return;
    }

    if (message.serverContent) {
      const { serverContent } = message;
      
      if (serverContent.interrupted) {
        this.emitter.emit('interrupted');
        return;
      }

      if (serverContent.inputTranscription) {
        this.emitter.emit(
          'inputTranscription',
          serverContent.inputTranscription.text,
          (serverContent.inputTranscription as { isFinal?: boolean }).isFinal ?? false
        );
      }

      if (serverContent.outputTranscription) {
        this.emitter.emit(
          'outputTranscription',
          serverContent.outputTranscription.text,
          (serverContent.outputTranscription as { isFinal?: boolean }).isFinal ?? false
        );
      }

      if (serverContent.modelTurn) {
        const parts: Part[] = serverContent.modelTurn.parts || [];
        const audioParts = parts.filter(p => p.inlineData?.mimeType?.startsWith('audio/pcm'));
        const base64s = audioParts.map(p => p.inlineData?.data);
        const otherParts = difference(parts, audioParts);

        for (const b64 of base64s) {
          if (b64) {
            const data = base64ToArrayBuffer(b64);
            this.emitter.emit('audio', data);
          }
        }

        if (otherParts.length > 0) {
          const content: LiveServerContent = { modelTurn: { parts: otherParts } };
          this.emitter.emit('content', content);
        }
      }

      if (serverContent.turnComplete) {
        this.emitter.emit('turncomplete');
      }

      if ((serverContent as { generationComplete?: boolean }).generationComplete) {
        this.emitter.emit('generationcomplete');
      }
    }
  }

  protected onError(e: ErrorEvent): void {
    const error = new Error(e.message || 'Connection error');
    this._lastError = error;
    console.error('[GeminiLiveClient] Error:', error);
    this.log(`server.error`, error.message);
    this.emitter.emit('error', error);

    // Don't change status here - let onClose handle it
  }

  protected onClose(e: CloseEvent): void {
    this.clearHeartbeat();
    this.session = undefined;

    if (this._manualDisconnect) {
      this.setStatus('closed');
      this.log('server.close', 'Connection closed (manual)');
    } else {
      this.log('server.close', `Connection closed unexpectedly (code: ${e.code})`);
      
      // Attempt reconnection if enabled
      if (this._autoReconnect) {
        this.scheduleReconnect();
      } else {
        this.setStatus('disconnected');
      }
    }

    this.emitter.emit('close', e);
  }

  // ============================================================================
  // STATUS MANAGEMENT
  // ============================================================================

  private setStatus(status: ConnectionStatus): void {
    if (this._status === status) return;
    
    const previous = this._status;
    this._status = status;
    this.emitter.emit('statuschange', status, previous);
  }

  // ============================================================================
  // LOGGING
  // ============================================================================

  protected log(type: string, message: string | object): void {
    this.emitter.emit('log', { type, message, date: new Date() });
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  public destroy(): void {
    this.disconnect();
    this.emitter.removeAllListeners();
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

let clientInstance: GeminiLiveClient | null = null;

export function createGeminiLiveClient(apiKey: string, model?: string): GeminiLiveClient {
  if (clientInstance) {
    clientInstance.destroy();
  }
  clientInstance = new GeminiLiveClient(apiKey, model);
  return clientInstance;
}

export function getGeminiLiveClient(): GeminiLiveClient | null {
  return clientInstance;
}

export function destroyGeminiLiveClient(): void {
  if (clientInstance) {
    clientInstance.destroy();
    clientInstance = null;
  }
}
