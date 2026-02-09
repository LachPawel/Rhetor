/**
 * pose_verifier.ts — Simple keypoint-based pose verification for warm-up exercises.
 *
 * Uses the COCO-17 keypoints from MoveNet to check whether the user's body
 * roughly matches the target pose.  No ML — just geometric comparisons
 * (y-comparisons, distances, ratios).
 */

import type { Keypoint } from './posture_detector.ts';
import { KEYPOINT as CK } from './posture_detector.ts';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Return keypoint only if confidence is high enough */
const kp = (keypoints: Keypoint[], idx: number, min = 0.25): Keypoint | null => {
  const k = keypoints[idx];
  return k && (k.score ?? 0) >= min ? k : null;
};

/** Euclidean distance between two keypoints */
const dist = (a: Keypoint, b: Keypoint) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

/** Midpoint of two keypoints */
const mid = (a: Keypoint, b: Keypoint): Keypoint => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  score: Math.min(a.score ?? 0, b.score ?? 0),
});

// ── Result type ────────────────────────────────────────────────────────────

export interface PoseCheckResult {
  /** Overall pass — all individual checks are met */
  pass: boolean;
  /** Per-region feedback (true = correct) */
  checks: Record<string, boolean>;
  /** Short human-readable hint for what to fix, or null when passing */
  hint: string | null;
}

// ── Exercise verifiers ─────────────────────────────────────────────────────

/**
 * Power Pose: hands on hips, chin up, wide stance.
 *  - Wrists near hip level (wrist.y ≈ hip.y ± tolerance)
 *  - Elbows bent outward (elbow.x outside shoulder.x on each side)
 *  - Head above shoulders (nose.y < shoulder-mid.y)
 */
export function checkPowerPose(keypoints: Keypoint[]): PoseCheckResult {
  const lShoulder = kp(keypoints, CK.LEFT_SHOULDER);
  const rShoulder = kp(keypoints, CK.RIGHT_SHOULDER);
  const lElbow = kp(keypoints, CK.LEFT_ELBOW);
  const rElbow = kp(keypoints, CK.RIGHT_ELBOW);
  const lWrist = kp(keypoints, CK.LEFT_WRIST);
  const rWrist = kp(keypoints, CK.RIGHT_WRIST);
  const lHip = kp(keypoints, CK.LEFT_HIP);
  const rHip = kp(keypoints, CK.RIGHT_HIP);
  const nose = kp(keypoints, CK.NOSE);

  // Not enough data — return neutral
  if (!lShoulder || !rShoulder) {
    return { pass: false, checks: {}, hint: 'Step back so the camera can see you' };
  }

  const shoulderDist = dist(lShoulder, rShoulder);
  const tolerance = shoulderDist * 0.45; // generous tolerance

  // 1. Arms akimbo — wrists roughly at hip level
  let armsOnHips = false;
  if (lWrist && rWrist && lHip && rHip) {
    const hipMidY = (lHip.y + rHip.y) / 2;
    const lOk = Math.abs(lWrist.y - hipMidY) < tolerance;
    const rOk = Math.abs(rWrist.y - hipMidY) < tolerance;
    armsOnHips = lOk && rOk;
  }

  // 2. Elbows wide — bent outward
  let elbowsWide = false;
  if (lElbow && rElbow) {
    // In mirrored camera, left elbow should be right-of left shoulder etc.
    // Use absolute x-spread: elbows wider than shoulders
    const elbowSpan = Math.abs(lElbow.x - rElbow.x);
    elbowsWide = elbowSpan > shoulderDist * 1.05;
  }

  // 3. Chin up — nose above shoulder midpoint
  let chinUp = false;
  if (nose) {
    const shoulderMidY = (lShoulder.y + rShoulder.y) / 2;
    chinUp = nose.y < shoulderMidY;
  }

  const checks = { armsOnHips, elbowsWide, chinUp };
  const pass = armsOnHips && elbowsWide && chinUp;

  let hint: string | null = null;
  if (!chinUp) hint = 'Lift your chin up';
  else if (!armsOnHips) hint = 'Place hands on your hips';
  else if (!elbowsWide) hint = 'Push elbows out wider';

  return { pass, checks, hint };
}

/**
 * Tension Release — Shoulder Shrug sub-step:
 *  - Shoulders raised toward ears (shoulder.y closer to ear.y than usual)
 */
export function checkShoulderShrug(keypoints: Keypoint[]): PoseCheckResult {
  const lShoulder = kp(keypoints, CK.LEFT_SHOULDER);
  const rShoulder = kp(keypoints, CK.RIGHT_SHOULDER);
  const lEar = kp(keypoints, CK.LEFT_EAR);
  const rEar = kp(keypoints, CK.RIGHT_EAR);
  const nose = kp(keypoints, CK.NOSE);

  if (!lShoulder || !rShoulder || !nose) {
    return { pass: false, checks: {}, hint: 'Step back so the camera can see you' };
  }

  // Shoulders should be at least 60 % of the way from default to ears
  let shouldersRaised = false;
  if (lEar && rEar) {
    const earMidY = (lEar.y + rEar.y) / 2;
    const shoulderMidY = (lShoulder.y + rShoulder.y) / 2;
    const noseY = nose.y;
    // Ratio: how close shoulders are to ears vs nose-to-shoulder distance
    const headHeight = shoulderMidY - noseY;
    const shoulderToEar = shoulderMidY - earMidY;
    shouldersRaised = headHeight > 0 && shoulderToEar / headHeight > 0.45;
  }

  const checks = { shouldersRaised };
  return {
    pass: shouldersRaised,
    checks,
    hint: shouldersRaised ? null : 'Shrug shoulders up to your ears',
  };
}

/**
 * Grounding — centered, stable stance:
 *  - Body centred in frame (midpoint of shoulders ≈ midpoint of hips in x)
 *  - Both feet (ankles) visible and roughly symmetric
 */
export function checkGrounding(keypoints: Keypoint[]): PoseCheckResult {
  const lShoulder = kp(keypoints, CK.LEFT_SHOULDER);
  const rShoulder = kp(keypoints, CK.RIGHT_SHOULDER);
  const lHip = kp(keypoints, CK.LEFT_HIP);
  const rHip = kp(keypoints, CK.RIGHT_HIP);
  const lAnkle = kp(keypoints, CK.LEFT_ANKLE);
  const rAnkle = kp(keypoints, CK.RIGHT_ANKLE);

  if (!lShoulder || !rShoulder) {
    return { pass: false, checks: {}, hint: 'Step back so the camera can see you' };
  }

  // 1. Centered — shoulder mid ≈ hip mid in X
  let centered = false;
  if (lHip && rHip) {
    const shoulderMid = mid(lShoulder, rShoulder);
    const hipMid = mid(lHip, rHip);
    const shoulderSpan = Math.abs(lShoulder.x - rShoulder.x);
    centered = Math.abs(shoulderMid.x - hipMid.x) < shoulderSpan * 0.3;
  }

  // 2. Both feet visible
  const feetVisible = !!(lAnkle && rAnkle);

  const checks = { centered, feetVisible };
  const pass = centered && feetVisible;

  let hint: string | null = null;
  if (!feetVisible) hint = 'Step back — let the camera see your feet';
  else if (!centered) hint = 'Stand straight, centre yourself';

  return { pass, checks, hint };
}

// ── Ideal / reference keypoints per exercise ───────────────────────────────
// These are normalised 0–1 positions scaled to video dimensions at render time.
// Only body keypoints are defined (indices 5–16). Face indices are left at 0,0
// with score 0 so the skeleton renderer skips them.

function emptyKeypoints(): Keypoint[] {
  return Array.from({ length: 17 }, () => ({ x: 0, y: 0, score: 0 }));
}

function setKp(kps: Keypoint[], idx: number, x: number, y: number) {
  kps[idx] = { x, y, score: 1 };
}

/**
 * Returns reference keypoints scaled to the given video dimensions.
 * `exerciseId` determines the pose shape.
 */
export function getReferenceKeypoints(
  exerciseId: string,
  subStep: number,
  videoWidth: number,
  videoHeight: number,
): Keypoint[] {
  const kps = emptyKeypoints();
  const cx = videoWidth / 2;

  switch (exerciseId) {
    case 'power-pose': {
      // Hands on hips, elbows wide, chin up
      const shoulderW = videoWidth * 0.18;
      const shoulderY = videoHeight * 0.32;
      setKp(kps, CK.NOSE, cx, videoHeight * 0.18);
      setKp(kps, CK.LEFT_SHOULDER, cx - shoulderW, shoulderY);
      setKp(kps, CK.RIGHT_SHOULDER, cx + shoulderW, shoulderY);
      // Elbows wide
      setKp(kps, CK.LEFT_ELBOW, cx - shoulderW * 1.6, videoHeight * 0.45);
      setKp(kps, CK.RIGHT_ELBOW, cx + shoulderW * 1.6, videoHeight * 0.45);
      // Wrists on hips
      const hipY = videoHeight * 0.54;
      setKp(kps, CK.LEFT_WRIST, cx - shoulderW * 0.9, hipY);
      setKp(kps, CK.RIGHT_WRIST, cx + shoulderW * 0.9, hipY);
      setKp(kps, CK.LEFT_HIP, cx - shoulderW * 0.75, hipY);
      setKp(kps, CK.RIGHT_HIP, cx + shoulderW * 0.75, hipY);
      // Legs straight
      setKp(kps, CK.LEFT_KNEE, cx - shoulderW * 0.7, videoHeight * 0.72);
      setKp(kps, CK.RIGHT_KNEE, cx + shoulderW * 0.7, videoHeight * 0.72);
      setKp(kps, CK.LEFT_ANKLE, cx - shoulderW * 0.7, videoHeight * 0.9);
      setKp(kps, CK.RIGHT_ANKLE, cx + shoulderW * 0.7, videoHeight * 0.9);
      break;
    }
    case 'tension-release': {
      // Sub-step 1 (shoulder shrug): shoulders raised
      if (subStep === 1) {
        const shoulderW = videoWidth * 0.18;
        const shoulderY = videoHeight * 0.25; // higher than normal
        setKp(kps, CK.NOSE, cx, videoHeight * 0.18);
        setKp(kps, CK.LEFT_SHOULDER, cx - shoulderW, shoulderY);
        setKp(kps, CK.RIGHT_SHOULDER, cx + shoulderW, shoulderY);
        setKp(kps, CK.LEFT_ELBOW, cx - shoulderW * 1.1, videoHeight * 0.4);
        setKp(kps, CK.RIGHT_ELBOW, cx + shoulderW * 1.1, videoHeight * 0.4);
        setKp(kps, CK.LEFT_WRIST, cx - shoulderW * 1.1, videoHeight * 0.52);
        setKp(kps, CK.RIGHT_WRIST, cx + shoulderW * 1.1, videoHeight * 0.52);
        const hipY = videoHeight * 0.54;
        setKp(kps, CK.LEFT_HIP, cx - shoulderW * 0.75, hipY);
        setKp(kps, CK.RIGHT_HIP, cx + shoulderW * 0.75, hipY);
      }
      // Other sub-steps: no specific skeleton (face scrunch / hand shake)
      break;
    }
    case 'grounding': {
      // Neutral centered stance
      const shoulderW = videoWidth * 0.18;
      const shoulderY = videoHeight * 0.32;
      setKp(kps, CK.NOSE, cx, videoHeight * 0.18);
      setKp(kps, CK.LEFT_SHOULDER, cx - shoulderW, shoulderY);
      setKp(kps, CK.RIGHT_SHOULDER, cx + shoulderW, shoulderY);
      setKp(kps, CK.LEFT_ELBOW, cx - shoulderW * 1.05, videoHeight * 0.46);
      setKp(kps, CK.RIGHT_ELBOW, cx + shoulderW * 1.05, videoHeight * 0.46);
      setKp(kps, CK.LEFT_WRIST, cx - shoulderW * 0.9, videoHeight * 0.58);
      setKp(kps, CK.RIGHT_WRIST, cx + shoulderW * 0.9, videoHeight * 0.58);
      const hipY = videoHeight * 0.54;
      setKp(kps, CK.LEFT_HIP, cx - shoulderW * 0.75, hipY);
      setKp(kps, CK.RIGHT_HIP, cx + shoulderW * 0.75, hipY);
      setKp(kps, CK.LEFT_KNEE, cx - shoulderW * 0.7, videoHeight * 0.72);
      setKp(kps, CK.RIGHT_KNEE, cx + shoulderW * 0.7, videoHeight * 0.72);
      setKp(kps, CK.LEFT_ANKLE, cx - shoulderW * 0.75, videoHeight * 0.9);
      setKp(kps, CK.RIGHT_ANKLE, cx + shoulderW * 0.75, videoHeight * 0.9);
      break;
    }
  }

  return kps;
}

// ── Dispatcher: pick the right checker for the current exercise + sub-step ─

export function verifyPose(
  exerciseId: string,
  subStep: number,
  keypoints: Keypoint[],
): PoseCheckResult {
  switch (exerciseId) {
    case 'power-pose':
      return checkPowerPose(keypoints);
    case 'tension-release':
      // Only the shoulder-shrug sub-step (index 1) is verifiable
      if (subStep === 1) return checkShoulderShrug(keypoints);
      return { pass: true, checks: {}, hint: null }; // no CV check for face/hands
    case 'grounding':
      return checkGrounding(keypoints);
    default:
      return { pass: false, checks: {}, hint: null };
  }
}
