/**
 * Pitch Detector
 * Uses autocorrelation on raw audio from the microphone to detect the
 * fundamental frequency (F0). Lightweight — no AI required.
 *
 * Usage:
 *   const pd = new PitchDetector();
 *   await pd.start();               // requests mic access
 *   pd.onPitch = (hz) => { … };     // called ~30 fps with hz (0 = silence)
 *   pd.stop();
 */

export interface PitchFrame {
  /** Detected frequency in Hz, or 0 when silent / unvoiced */
  frequency: number;
  /** RMS volume 0-1 */
  volume: number;
  /** Confidence of the pitch estimate 0-1 */
  confidence: number;
}

export class PitchDetector {
  // ── Public callback ────────────────────────────────────────────────
  onPitch: ((frame: PitchFrame) => void) | null = null;

  // ── Internals ──────────────────────────────────────────────────────
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private rafId: number | null = null;
  private buffer: Float32Array | null = null;

  /** Minimum RMS below which we report silence */
  private readonly SILENCE_THRESHOLD = 0.01;
  /** Autocorrelation confidence threshold */
  private readonly CONFIDENCE_THRESHOLD = 0.85;

  // ── Lifecycle ──────────────────────────────────────────────────────

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false, // we want the raw pitch
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    this.audioCtx = new AudioContext();
    this.source = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.source.connect(this.analyser);

    this.buffer = new Float32Array(this.analyser.fftSize);
    this.tick();
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.analyser = null;
    this.buffer = null;
  }

  // ── Main loop ──────────────────────────────────────────────────────

  private tick = (): void => {
    this.rafId = requestAnimationFrame(this.tick);

    if (!this.analyser || !this.buffer || !this.audioCtx) return;

    this.analyser.getFloatTimeDomainData(this.buffer);

    // RMS volume
    let sumSq = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      sumSq += this.buffer[i] * this.buffer[i];
    }
    const rms = Math.sqrt(sumSq / this.buffer.length);

    if (rms < this.SILENCE_THRESHOLD) {
      this.onPitch?.({ frequency: 0, volume: rms, confidence: 0 });
      return;
    }

    const { frequency, confidence } = this.autoCorrelate(
      this.buffer,
      this.audioCtx.sampleRate,
    );

    this.onPitch?.({ frequency, volume: rms, confidence });
  };

  // ── Autocorrelation pitch detection ────────────────────────────────
  // Based on the classic ACF algorithm (McLeod & Wyvill style).

  private autoCorrelate(
    buf: Float32Array,
    sampleRate: number,
  ): { frequency: number; confidence: number } {
    const SIZE = buf.length;

    // Find first zero-crossing to skip the initial attack
    let start = 0;
    for (let i = 0; i < SIZE / 2; i++) {
      if (buf[i] < 0) { start = i; break; }
    }

    // Compute normalised autocorrelation
    const correlations = new Float32Array(SIZE / 2);
    let bestOffset = -1;
    let bestCorrelation = 0;

    for (let offset = start; offset < SIZE / 2; offset++) {
      let correlation = 0;
      let norm1 = 0;
      let norm2 = 0;
      for (let i = 0; i < SIZE / 2; i++) {
        correlation += buf[i] * buf[i + offset];
        norm1 += buf[i] * buf[i];
        norm2 += buf[i + offset] * buf[i + offset];
      }
      const norm = Math.sqrt(norm1 * norm2);
      correlation = norm > 0 ? correlation / norm : 0;
      correlations[offset] = correlation;

      if (correlation > this.CONFIDENCE_THRESHOLD && correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    }

    if (bestOffset === -1) {
      return { frequency: 0, confidence: 0 };
    }

    // Parabolic interpolation around the peak for sub-sample accuracy
    const prev = correlations[bestOffset - 1] ?? bestCorrelation;
    const next = correlations[bestOffset + 1] ?? bestCorrelation;
    const shift = (prev - next) / (2 * (prev - 2 * bestCorrelation + next));
    const refinedOffset = bestOffset + (Number.isFinite(shift) ? shift : 0);

    const frequency = sampleRate / refinedOffset;

    // Sanity: human voice range 50-1000 Hz
    if (frequency < 50 || frequency > 1000) {
      return { frequency: 0, confidence: 0 };
    }

    return { frequency, confidence: bestCorrelation };
  }
}
