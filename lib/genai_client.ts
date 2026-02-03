
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
} from '@google/genai';

import EventEmitter from 'eventemitter3';
import { base64ToArrayBuffer } from './audio_utils.ts';

export const DEFAULT_LIVE_API_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

// Helper to replace lodash.difference
function difference<T>(array: T[], values: T[]): T[] {
  const valuesSet = new Set(values);
  return array.filter(x => !valuesSet.has(x));
}

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
  error: (e: ErrorEvent) => void;
  interrupted: () => void;
  log: (log: StreamingLog) => void;
  open: () => void;
  setupcomplete: () => void;
  toolcall: (toolCall: LiveServerToolCall) => void;
  toolcallcancellation: (
    toolcallCancellation: LiveServerToolCallCancellation
  ) => void;
  turncomplete: () => void;
  generationcomplete: () => void;
  inputTranscription: (text: string, isFinal: boolean) => void;
  outputTranscription: (text: string, isFinal: boolean) => void;
}

export class GenAILiveClient {
  public readonly model: string = DEFAULT_LIVE_API_MODEL;
  private emitter = new EventEmitter<LiveClientEventTypes>();

  public on = this.emitter.on.bind(this.emitter);
  public off = this.emitter.off.bind(this.emitter);

  protected readonly client: GoogleGenAI;
  protected session?: Session;

  private _status: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
  public get status() {
    return this._status;
  }

  constructor(apiKey: string, model?: string) {
    if (model) this.model = model;
    this.client = new GoogleGenAI({ apiKey });
  }

  public async connect(config: LiveConnectConfig): Promise<boolean> {
    if (this._status === 'connected' || this._status === 'connecting') {
      return false;
    }

    this._status = 'connecting';
    const callbacks: LiveCallbacks = {
      onopen: this.onOpen.bind(this),
      onmessage: this.onMessage.bind(this),
      onerror: this.onError.bind(this),
      onclose: this.onClose.bind(this),
    };

    try {
      this.session = await this.client.live.connect({
        model: this.model,
        config: { ...config },
        callbacks,
      });
    } catch (e: any) {
      console.error('Error connecting to GenAI Live:', e);
      this._status = 'disconnected';
      this.session = undefined;
      const errorEvent = new ErrorEvent('error', {
        error: e,
        message: e?.message || 'Failed to connect.',
      });
      this.onError(errorEvent);
      return false;
    }

    this._status = 'connected';
    return true;
  }

  public disconnect() {
    this.session?.close();
    this.session = undefined;
    this._status = 'disconnected';
    this.log('client.close', `Disconnected`);
    return true;
  }

  public send(parts: Part | Part[], turnComplete: boolean = true) {
    if (this._status !== 'connected' || !this.session) {
      this.emitter.emit('error', new ErrorEvent('Client is not connected'));
      return;
    }
    this.session.sendClientContent({ turns: Array.isArray(parts) ? parts : [parts], turnComplete });
    this.log(`client.send`, parts);
  }

  public sendRealtimeInput(chunks: Array<Blob>) {
    if (this._status !== 'connected' || !this.session) {
      this.emitter.emit('error', new ErrorEvent('Client is not connected'));
      return;
    }
    
    chunks.forEach(chunk => {
      this.session!.sendRealtimeInput({ media: chunk });
    });
  }

  public sendToolResponse(toolResponse: LiveClientToolResponse) {
    if (this._status !== 'connected' || !this.session) {
      this.emitter.emit('error', new ErrorEvent('Client is not connected'));
      return;
    }
    if (toolResponse.functionResponses && toolResponse.functionResponses.length) {
      this.session.sendToolResponse({
        functionResponses: toolResponse.functionResponses!,
      });
    }
    this.log(`client.toolResponse`, { toolResponse });
  }

  protected onMessage(message: LiveServerMessage) {
    if (message.setupComplete) {
      this.emitter.emit('setupcomplete');
      return;
    }
    if (message.toolCall) {
      this.log('server.toolCall', message);
      this.emitter.emit('toolcall', message.toolCall);
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
          (serverContent.inputTranscription as any).isFinal ?? false,
        );
      }

      if (serverContent.outputTranscription) {
        this.emitter.emit(
          'outputTranscription',
          serverContent.outputTranscription.text,
          (serverContent.outputTranscription as any).isFinal ?? false,
        );
      }

      if (serverContent.modelTurn) {
        let parts: Part[] = serverContent.modelTurn.parts || [];
        const audioParts = parts.filter(p => p.inlineData?.mimeType?.startsWith('audio/pcm'));
        const base64s = audioParts.map(p => p.inlineData?.data);
        const otherParts = difference(parts, audioParts);

        base64s.forEach(b64 => {
          if (b64) {
            const data = base64ToArrayBuffer(b64);
            this.emitter.emit('audio', data as ArrayBuffer);
          }
        });

        if (otherParts.length > 0) {
          const content: LiveServerContent = { modelTurn: { parts: otherParts } };
          this.emitter.emit('content', content);
        }
      }

      if (serverContent.turnComplete) {
        this.emitter.emit('turncomplete');
      }

      if ((serverContent as any).generationComplete) {
        this.emitter.emit('generationcomplete');
      }
    }
  }

  protected onError(e: ErrorEvent) {
    this._status = 'disconnected';
    console.error('error:', e);
    this.log(`server.${e.type}`, `Could not connect: ${e.message}`);
    this.emitter.emit('error', e);
  }

  protected onOpen() {
    this._status = 'connected';
    this.emitter.emit('open');
  }

  protected onClose(e: CloseEvent) {
    this._status = 'disconnected';
    this.log(`server.${e.type}`, `disconnected`);
    this.emitter.emit('close', e);
  }

  protected log(type: string, message: string | object) {
    this.emitter.emit('log', { type, message, date: new Date() });
  }
}
