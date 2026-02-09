/**
 * MoveNet-based posture detector using TensorFlow.js
 *
 * Uses a calibration-first approach (Swift-style): collects 40 frames of
 * "good posture" as baseline, then compares rolling averages against that
 * baseline with configurable sensitivity thresholds.
 */

// Dynamic imports — loaded lazily in init() to avoid bloating the main bundle
// and prevent GPU/WebGL contention with the Gemini audio pipeline on startup.
let poseDetection: typeof import('@tensorflow-models/pose-detection');
let tf: typeof import('@tensorflow/tfjs');

/** Keypoint shape re-exported so consumers don't need the heavy import */
export interface Keypoint {
  x: number;
  y: number;
  score?: number;
  name?: string;
}

// ── Keypoint indices (COCO 17-keypoint topology used by MoveNet) ───────────
export const KEYPOINT = {
  NOSE: 0,
  LEFT_EYE: 1,
  RIGHT_EYE: 2,
  LEFT_EAR: 3,
  RIGHT_EAR: 4,
  LEFT_SHOULDER: 5,
  RIGHT_SHOULDER: 6,
  LEFT_ELBOW: 7,
  RIGHT_ELBOW: 8,
  LEFT_WRIST: 9,
  RIGHT_WRIST: 10,
  LEFT_HIP: 11,
  RIGHT_HIP: 12,
  LEFT_KNEE: 13,
  RIGHT_KNEE: 14,
  LEFT_ANKLE: 15,
  RIGHT_ANKLE: 16,
} as const;

// Skeleton edges for drawing (body only — no face)
export const SKELETON_EDGES: [number, number][] = [
  // Torso
  [KEYPOINT.LEFT_SHOULDER, KEYPOINT.RIGHT_SHOULDER],
  [KEYPOINT.LEFT_SHOULDER, KEYPOINT.LEFT_HIP],
  [KEYPOINT.RIGHT_SHOULDER, KEYPOINT.RIGHT_HIP],
  [KEYPOINT.LEFT_HIP, KEYPOINT.RIGHT_HIP],
  // Left arm
  [KEYPOINT.LEFT_SHOULDER, KEYPOINT.LEFT_ELBOW],
  [KEYPOINT.LEFT_ELBOW, KEYPOINT.LEFT_WRIST],
  // Right arm
  [KEYPOINT.RIGHT_SHOULDER, KEYPOINT.RIGHT_ELBOW],
  [KEYPOINT.RIGHT_ELBOW, KEYPOINT.RIGHT_WRIST],
  // Left leg
  [KEYPOINT.LEFT_HIP, KEYPOINT.LEFT_KNEE],
  [KEYPOINT.LEFT_KNEE, KEYPOINT.LEFT_ANKLE],
  // Right leg
  [KEYPOINT.RIGHT_HIP, KEYPOINT.RIGHT_KNEE],
  [KEYPOINT.RIGHT_KNEE, KEYPOINT.RIGHT_ANKLE],
];

// Face keypoint indices to skip when drawing dots
export const FACE_KEYPOINT_IDS = new Set([0, 1, 2, 3, 4]);

// ── Internal types ─────────────────────────────────────────────────────────
interface CalibrationBaseline {
  shoulderDistanceX: number;
  shoulderDistanceY: number;
  headShoulderDistanceY: number;
}

interface FrameMetrics {
  shoulderXDiff: number;
  shoulderYDiff: number;
  headShoulderYDiff: number;
}

// ── Posture analysis result ────────────────────────────────────────────────
export interface PostureFrame {
  /** 0–100 overall posture score */
  score: number;
  /** Individual checks */
  shouldersLevel: boolean;
  headCentered: boolean;
  notSlouching: boolean;
  /** Human-readable actionable tip, e.g. "Shoulders back!" */
  tip: string | null;
  /** Raw keypoints for skeleton drawing */
  keypoints: Keypoint[];
  /** Whether the detector is still calibrating */
  calibrating: boolean;
  /** Calibration progress 0–40 */
  calibrationProgress: number;
  /** Timestamp */
  timestamp: number;
}

// ── Configuration ──────────────────────────────────────────────────────────
export interface PostureDetectorConfig {
  /** Minimum confidence to consider a keypoint valid (0–1). Default 0.3 */
  minKeypointScore?: number;
  /** How often to run detection in ms. Default 200 (5 fps) */
  intervalMs?: number;
  /** Tolerance 0–100 (higher = more forgiving). Default 25 */
  tolerance?: number;
  /** Number of calibration samples. Default 40 */
  calibrationSamples?: number;
  /** Callback with each frame result */
  onFrame?: (frame: PostureFrame) => void;
}

const DEFAULT_CONFIG: Required<PostureDetectorConfig> = {
  minKeypointScore: 0.3,
  intervalMs: 300,
  tolerance: 25,
  calibrationSamples: 40,
  onFrame: () => {},
};

// ── Posture Detector Class ─────────────────────────────────────────────────
export class PostureDetector {
  private detector: any | null = null;  // poseDetection.PoseDetector — loaded dynamically
  private config: Required<PostureDetectorConfig>;
  private video: HTMLVideoElement | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private _ready = false;

  // ── Calibration state ──────────────────────────────────────────────────
  private baseline: CalibrationBaseline | null = null;
  private calibrationFrames: FrameMetrics[] = [];

  // ── Rolling frame buffer (Swift-style averaging) ───────────────────────
  private frameBuffer: FrameMetrics[] = [];
  private readonly MAX_FRAME_BUFFER = 30;

  // ── Score smoothing ────────────────────────────────────────────────────
  private scoreHistory: number[] = [];
  private readonly SCORE_HISTORY_SIZE = 12;

  // ── Tip cooldown (2 s) to avoid flickering ─────────────────────────────
  private lastTip: string | null = null;
  private lastTipChangeTime = 0;
  private readonly TIP_COOLDOWN_MS = 2000;

  private frameCounter = 0;

  constructor(config: PostureDetectorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Initialize TF backend and load MoveNet SinglePose Lightning */
  async init(): Promise<void> {
    if (this._ready) return;

    // Lazy-load TF.js + pose-detection only when needed
    [tf, poseDetection] = await Promise.all([
      import('@tensorflow/tfjs'),
      import('@tensorflow-models/pose-detection'),
    ]);

    await tf.setBackend('webgl');
    await tf.ready();

    this.detector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      }
    );

    this._ready = true;
    console.log('[PostureDetector] MoveNet Lightning loaded');
  }

  get ready(): boolean {
    return this._ready;
  }

  get isCalibrating(): boolean {
    return this.baseline === null;
  }

  /** Start detection loop on the given video element */
  start(video: HTMLVideoElement): void {
    if (!this._ready || !this.detector) {
      console.warn('[PostureDetector] Not initialized – call init() first');
      return;
    }
    this.video = video;
    this.running = true;
    this.resetCalibration();
    this.loop();
    console.log('[PostureDetector] Started — calibrating…');
  }

  /** Reset calibration so the user can re-calibrate */
  resetCalibration(): void {
    this.baseline = null;
    this.calibrationFrames = [];
    this.frameBuffer = [];
    this.scoreHistory = [];
    this.frameCounter = 0;
    this.lastTip = null;
    this.lastTipChangeTime = 0;
  }

  /** Stop detection loop */
  stop(): void {
    this.running = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    console.log('[PostureDetector] Stopped');
  }

  /** Clean up model resources */
  async dispose(): Promise<void> {
    this.stop();
    if (this.detector) {
      this.detector.dispose();
      this.detector = null;
    }
    this._ready = false;
  }

  // ── Internal loop (sequential: detect → wait → detect) ───────────────────
  private loop = async (): Promise<void> => {
    if (!this.running) return;
    await this.detect();
    if (!this.running) return;
    this.timerId = setTimeout(this.loop, this.config.intervalMs);
  };

  private async detect(): Promise<void> {
    if (!this.detector || !this.video) return;
    if (this.video.readyState < 2) return;

    try {
      const poses = await this.detector.estimatePoses(this.video);
      if (poses.length === 0) return;

      const kps = poses[0].keypoints;
      const frame = this.analyzePosture(kps);
      this.config.onFrame(frame);
    } catch (_e) {
      // Silently skip frame errors (tab switch, etc.)
    }
  }

  // ── Keypoint helper ──────────────────────────────────────────────────────
  private kp(keypoints: Keypoint[], idx: number) {
    const k = keypoints[idx];
    return k && (k.score ?? 0) >= this.config.minKeypointScore ? k : null;
  }

  // ── Sensitivity thresholds (derived from tolerance) ──────────────────────
  private get thresholds() {
    const sensitivity = (100 - this.config.tolerance) / 100; // 0–1
    return {
      shoulderXThreshold: 0.15 * (1 + sensitivity),
      shoulderYThreshold: 0.12 * (1 + sensitivity),
      headDropThreshold: 0.12 * (1 + sensitivity),
    };
  }

  // ── Core analysis ────────────────────────────────────────────────────────
  private analyzePosture(keypoints: Keypoint[]): PostureFrame {
    this.frameCounter++;

    const lShoulder = this.kp(keypoints, KEYPOINT.LEFT_SHOULDER);
    const rShoulder = this.kp(keypoints, KEYPOINT.RIGHT_SHOULDER);
    const nose = this.kp(keypoints, KEYPOINT.NOSE);
    const lHip = this.kp(keypoints, KEYPOINT.LEFT_HIP);
    const rHip = this.kp(keypoints, KEYPOINT.RIGHT_HIP);

    // ── Need at least shoulders + nose to do anything meaningful ────────
    if (!lShoulder || !rShoulder || !nose) {
      return {
        score: 0,
        shouldersLevel: true,
        headCentered: true,
        notSlouching: true,
        tip: null,
        keypoints,
        calibrating: this.isCalibrating,
        calibrationProgress: this.calibrationFrames.length,
        timestamp: Date.now(),
      };
    }

    // Current frame metrics
    const current: FrameMetrics = {
      shoulderXDiff: Math.abs(lShoulder.x - rShoulder.x),
      shoulderYDiff: Math.abs(lShoulder.y - rShoulder.y),
      headShoulderYDiff: ((lShoulder.y + rShoulder.y) / 2) - nose.y,
    };

    // ── CALIBRATION PHASE ───────────────────────────────────────────────
    if (!this.baseline) {
      this.calibrationFrames.push(current);

      if (this.calibrationFrames.length >= this.config.calibrationSamples) {
        const n = this.calibrationFrames.length;
        this.baseline = {
          shoulderDistanceX: this.calibrationFrames.reduce((s, f) => s + f.shoulderXDiff, 0) / n,
          shoulderDistanceY: this.calibrationFrames.reduce((s, f) => s + f.shoulderYDiff, 0) / n,
          headShoulderDistanceY: this.calibrationFrames.reduce((s, f) => s + f.headShoulderYDiff, 0) / n,
        };
        console.log('[PostureDetector] Calibration complete:', this.baseline);
      }

      return {
        score: 100,
        shouldersLevel: true,
        headCentered: true,
        notSlouching: true,
        tip: null,
        keypoints,
        calibrating: true,
        calibrationProgress: this.calibrationFrames.length,
        timestamp: Date.now(),
      };
    }

    // ── Add frame to rolling buffer ────────────────────────────────────
    this.frameBuffer.push(current);
    if (this.frameBuffer.length > this.MAX_FRAME_BUFFER) {
      this.frameBuffer.shift();
    }

    // ── Rolling averages ───────────────────────────────────────────────
    const n = this.frameBuffer.length;
    const avgShoulderX = this.frameBuffer.reduce((s, f) => s + f.shoulderXDiff, 0) / n;
    const avgShoulderY = this.frameBuffer.reduce((s, f) => s + f.shoulderYDiff, 0) / n;
    const avgHeadShoulderY = this.frameBuffer.reduce((s, f) => s + f.headShoulderYDiff, 0) / n;

    const base = this.baseline;
    const thr = this.thresholds;
    const tips: string[] = [];
    let shouldersLevel = true;
    let headCentered = true;
    let notSlouching = true;

    // 1. Shoulder height balance — one side noticeably higher
    if (avgShoulderY > base.shoulderDistanceY + thr.shoulderYThreshold * base.shoulderDistanceX) {
      shouldersLevel = false;
      tips.push('Level your shoulders');
    }

    // 2. Slouch detection — head drops toward shoulders (distance shrinks)
    //    This is the primary slouch signal: when you slouch, your nose
    //    moves closer to your shoulder midpoint in Y.
    const headDropLimit = base.headShoulderDistanceY * thr.headDropThreshold;
    if (avgHeadShoulderY < base.headShoulderDistanceY - headDropLimit) {
      notSlouching = false;
      tips.push('Sit up straight!');
    }

    // 3. Shoulder-width compression — hunching forward narrows apparent
    //    shoulder span in camera. Also catches leaning far back.
    const shoulderXChange = Math.abs(avgShoulderX - base.shoulderDistanceX);
    const shoulderXLimit = base.shoulderDistanceX * thr.shoulderXThreshold;
    if (shoulderXChange > shoulderXLimit) {
      if (avgShoulderX < base.shoulderDistanceX) {
        // Shoulders appear narrower → hunching forward
        if (notSlouching) {
          // Don't double-penalize if we already flagged head-drop slouch
          notSlouching = false;
          tips.push('Shoulders back!');
        }
      } else {
        // Shoulders appear wider → leaning back
        headCentered = false;
        tips.push('Lean forward a bit');
      }
    }

    // 4. Bonus: if hips are visible, check torso compression ratio
    if (lHip && rHip && notSlouching) {
      const avgShoulderYPos = (lShoulder.y + rShoulder.y) / 2;
      const avgHipYPos = (lHip.y + rHip.y) / 2;
      const torsoLength = avgHipYPos - avgShoulderYPos;
      const shoulderSpan = Math.abs(lShoulder.x - rShoulder.x);
      // When slouching, torso appears compressed relative to shoulder width
      if (shoulderSpan > 0 && torsoLength / shoulderSpan < 0.55) {
        notSlouching = false;
        tips.push('Straighten your back');
      }
    }

    // ── Score calculation ──────────────────────────────────────────────
    let rawScore = 100;
    if (!shouldersLevel) rawScore -= 30;
    if (!headCentered) rawScore -= 25;
    if (!notSlouching) rawScore -= 35;

    this.scoreHistory.push(rawScore);
    if (this.scoreHistory.length > this.SCORE_HISTORY_SIZE) {
      this.scoreHistory.shift();
    }
    const smoothedScore = Math.round(
      this.scoreHistory.reduce((a, b) => a + b, 0) / this.scoreHistory.length
    );

    // ── Tip with cooldown ──────────────────────────────────────────────
    const now = Date.now();
    const newTip = tips.length > 0 ? tips[0] : null;
    if (newTip !== this.lastTip) {
      if (now - this.lastTipChangeTime >= this.TIP_COOLDOWN_MS) {
        this.lastTip = newTip;
        this.lastTipChangeTime = now;
      }
    }

    return {
      score: Math.max(0, Math.min(100, smoothedScore)),
      shouldersLevel,
      headCentered,
      notSlouching,
      tip: this.lastTip,
      keypoints,
      calibrating: false,
      calibrationProgress: this.config.calibrationSamples,
      timestamp: now,
    };
  }
}
