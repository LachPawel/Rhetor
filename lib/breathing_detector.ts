/**
 * Breathing Detector
 * Analyzes microphone input to detect breath patterns (inhale/hold/exhale)
 * Uses volume levels and rhythm analysis
 */

export type BreathPhase = 'inhale' | 'hold' | 'exhale' | 'idle';

export interface BreathEvent {
  phase: BreathPhase;
  timestamp: number;
  volume: number;
  duration: number;
}

export interface BreathingMetrics {
  cycles: number;
  avgInhaleDuration: number;
  avgHoldDuration: number;
  avgExhaleDuration: number;
  rhythmScore: number; // 0-100 - how consistent was the rhythm
  compliance: number; // 0-100 - how well they followed the target pattern
}

export interface BreathingDetectorOptions {
  sampleRate?: number; // How often to sample volume (ms)
  volumeThreshold?: number; // Min volume to detect breath sounds (0-1)
  inhalePattern?: number[]; // Target pattern [inhale, hold, exhale] in seconds
  onPhaseChange?: (phase: BreathPhase, volume: number) => void;
  onCycleComplete?: (cycleNumber: number, metrics: Partial<BreathingMetrics>) => void;
}

const DEFAULT_OPTIONS: Required<Omit<BreathingDetectorOptions, 'onPhaseChange' | 'onCycleComplete'>> = {
  sampleRate: 100,
  volumeThreshold: 0.05,
  inhalePattern: [4, 4, 4], // 4-4-4 box breathing
};

export class BreathingDetector {
  private options: Required<Omit<BreathingDetectorOptions, 'onPhaseChange' | 'onCycleComplete'>> & 
                   Pick<BreathingDetectorOptions, 'onPhaseChange' | 'onCycleComplete'>;
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private intervalId: number | null = null;
  
  private currentPhase: BreathPhase = 'idle';
  private phaseStartTime: number = 0;
  private events: BreathEvent[] = [];
  private cycleCount: number = 0;
  
  // Volume tracking for pattern detection
  private volumeHistory: number[] = [];
  private readonly historyLength = 30; // ~3 seconds at 100ms sample rate

  constructor(options: BreathingDetectorOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
  }

  /**
   * Start analyzing breath from a media stream
   */
  async start(stream: MediaStream): Promise<void> {
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;
    
    this.source = this.audioContext.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
    
    this.reset();
    this.startSampling();
  }

  /**
   * Start analyzing from an existing analyser node
   */
  startFromAnalyser(analyser: AnalyserNode): void {
    this.analyser = analyser;
    this.reset();
    this.startSampling();
  }

  /**
   * Start in external-feed mode (no AnalyserNode or sampling interval).
   * Volume must be fed manually via feedVolume().
   */
  startExternal(): void {
    this.reset();
    // No sampling interval — caller will push volume via feedVolume()
  }

  /**
   * Feed an externally-measured volume value (0-1).
   * Use this when the mic's VU meter already provides volume data
   * so we don't need a duplicate AnalyserNode.
   */
  feedVolume(volume: number): void {
    this.volumeHistory.push(volume);
    if (this.volumeHistory.length > this.historyLength) {
      this.volumeHistory.shift();
    }

    const detectedPhase = this.detectPhase(volume);

    if (detectedPhase !== this.currentPhase) {
      const now = Date.now();
      const duration = now - this.phaseStartTime;

      if (this.currentPhase !== 'idle') {
        this.events.push({
          phase: this.currentPhase,
          timestamp: this.phaseStartTime,
          volume,
          duration,
        });
      }

      // Check for cycle completion (exhale -> inhale transition)
      if (this.currentPhase === 'exhale' && detectedPhase === 'inhale') {
        this.cycleCount++;
        this.options.onCycleComplete?.(this.cycleCount, this.calculateMetrics());
      }

      this.currentPhase = detectedPhase;
      this.phaseStartTime = now;
      this.options.onPhaseChange?.(detectedPhase, volume);
    }
  }

  /**
   * Stop detection
   */
  stop(): BreathingMetrics {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    return this.calculateMetrics();
  }

  /**
   * Reset detector state
   */
  reset(): void {
    this.currentPhase = 'idle';
    this.phaseStartTime = Date.now();
    this.events = [];
    this.cycleCount = 0;
    this.volumeHistory = [];
  }

  /**
   * Get current volume level (0-1)
   */
  getCurrentVolume(): number {
    if (!this.analyser) return 0;
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    
    // Calculate RMS volume
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length);
    return rms / 255; // Normalize to 0-1
  }

  /**
   * Get current detected phase
   */
  getCurrentPhase(): BreathPhase {
    return this.currentPhase;
  }

  /**
   * Get cycle count
   */
  getCycleCount(): number {
    return this.cycleCount;
  }

  private startSampling(): void {
    this.intervalId = window.setInterval(() => {
      this.sample();
    }, this.options.sampleRate);
  }

  private sample(): void {
    const volume = this.getCurrentVolume();
    this.volumeHistory.push(volume);
    if (this.volumeHistory.length > this.historyLength) {
      this.volumeHistory.shift();
    }

    const detectedPhase = this.detectPhase(volume);
    
    if (detectedPhase !== this.currentPhase) {
      // Phase changed - record event
      const now = Date.now();
      const duration = now - this.phaseStartTime;
      
      if (this.currentPhase !== 'idle') {
        this.events.push({
          phase: this.currentPhase,
          timestamp: this.phaseStartTime,
          volume,
          duration,
        });
      }
      
      // Check for cycle completion (exhale -> inhale transition)
      if (this.currentPhase === 'exhale' && detectedPhase === 'inhale') {
        this.cycleCount++;
        this.options.onCycleComplete?.(this.cycleCount, this.calculateMetrics());
      }
      
      this.currentPhase = detectedPhase;
      this.phaseStartTime = now;
      this.options.onPhaseChange?.(detectedPhase, volume);
    }
  }

  private detectPhase(currentVolume: number): BreathPhase {
    if (this.volumeHistory.length < 5) return 'idle';
    
    const threshold = this.options.volumeThreshold;
    const recentAvg = this.getRecentAverage(5);
    const olderAvg = this.getOlderAverage(10);
    
    // Breath detection heuristics:
    // - Inhale: Volume rising, above threshold (breath sound)
    // - Hold: Volume low/stable (silence)
    // - Exhale: Volume present, decreasing from peak (breath out sound)
    
    const isLoud = currentVolume > threshold;
    const isRising = recentAvg > olderAvg * 1.2;
    const isFalling = recentAvg < olderAvg * 0.8;
    const isQuiet = currentVolume < threshold * 0.5;

    // State machine with hysteresis
    switch (this.currentPhase) {
      case 'idle':
        if (isLoud && isRising) return 'inhale';
        break;
        
      case 'inhale':
        if (isQuiet) return 'hold';
        if (isFalling && isLoud) return 'exhale';
        break;
        
      case 'hold':
        if (isLoud) return 'exhale';
        // Auto-transition after expected hold duration
        if (Date.now() - this.phaseStartTime > this.options.inhalePattern[1] * 1000 + 500) {
          return 'exhale';
        }
        break;
        
      case 'exhale':
        if (isQuiet && Date.now() - this.phaseStartTime > 1000) {
          // Quiet after exhale - might be starting new cycle
          if (isRising) return 'inhale';
          return 'idle';
        }
        break;
    }
    
    return this.currentPhase;
  }

  private getRecentAverage(samples: number): number {
    const recent = this.volumeHistory.slice(-samples);
    return recent.reduce((a, b) => a + b, 0) / recent.length;
  }

  private getOlderAverage(samples: number): number {
    const startIdx = Math.max(0, this.volumeHistory.length - samples * 2);
    const endIdx = Math.max(samples, this.volumeHistory.length - samples);
    const older = this.volumeHistory.slice(startIdx, endIdx);
    return older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : 0;
  }

  private calculateMetrics(): BreathingMetrics {
    const inhales = this.events.filter(e => e.phase === 'inhale');
    const holds = this.events.filter(e => e.phase === 'hold');
    const exhales = this.events.filter(e => e.phase === 'exhale');

    const avgDuration = (events: BreathEvent[]) => 
      events.length > 0 
        ? events.reduce((sum, e) => sum + e.duration, 0) / events.length / 1000
        : 0;

    const avgInhale = avgDuration(inhales);
    const avgHold = avgDuration(holds);
    const avgExhale = avgDuration(exhales);

    // Calculate rhythm score based on consistency
    const stdDev = (events: BreathEvent[]) => {
      if (events.length < 2) return 0;
      const avg = avgDuration(events);
      const variance = events.reduce((sum, e) => sum + Math.pow(e.duration / 1000 - avg, 2), 0) / events.length;
      return Math.sqrt(variance);
    };

    const rhythmScore = Math.max(0, 100 - (
      stdDev(inhales) * 10 +
      stdDev(holds) * 10 +
      stdDev(exhales) * 10
    ));

    // Calculate compliance with target pattern
    const [targetInhale, targetHold, targetExhale] = this.options.inhalePattern;
    const inhaleDiff = Math.abs(avgInhale - targetInhale) / targetInhale;
    const holdDiff = Math.abs(avgHold - targetHold) / targetHold;
    const exhaleDiff = Math.abs(avgExhale - targetExhale) / targetExhale;
    const compliance = Math.max(0, 100 - (inhaleDiff + holdDiff + exhaleDiff) * 33);

    return {
      cycles: this.cycleCount,
      avgInhaleDuration: avgInhale,
      avgHoldDuration: avgHold,
      avgExhaleDuration: avgExhale,
      rhythmScore: Math.round(rhythmScore),
      compliance: Math.round(compliance),
    };
  }
}

/**
 * Utility: Create a simple breath indicator for UI
 */
export function getBreathPhaseEmoji(phase: BreathPhase): string {
  switch (phase) {
    case 'inhale': return '🌬️';
    case 'hold': return '⏸️';
    case 'exhale': return '💨';
    default: return '😌';
  }
}

/**
 * Utility: Get coaching message for breath phase
 */
export function getBreathPhaseMessage(phase: BreathPhase): string {
  switch (phase) {
    case 'inhale': return 'Breathe in...';
    case 'hold': return 'Hold...';
    case 'exhale': return 'Release...';
    default: return 'Ready when you are';
  }
}
