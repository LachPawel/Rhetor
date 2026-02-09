/**
 * PostureSkeleton — draws skeleton overlays on a video feed.
 *
 * Supports two modes:
 *  1. **Subtle** (default) — thin half-opaque white lines for practice view.
 *  2. **Warm-up** — bolder user skeleton + semi-transparent green reference
 *     skeleton showing the ideal pose. The user skeleton turns green when
 *     `posePass` is true.
 */

import React, { useEffect, useRef } from 'react';
import type { Keypoint } from '../lib/posture_detector.ts';
import { SKELETON_EDGES, FACE_KEYPOINT_IDS } from '../lib/posture_detector.ts';

interface PostureSkeletonProps {
  /** Latest keypoints from MoveNet */
  keypoints: Keypoint[];
  /** Width of the video element */
  videoWidth: number;
  /** Height of the video element */
  videoHeight: number;
  /** 0–100 posture score (unused for color — kept for API compat) */
  score: number;
  /** Minimum confidence to draw a keypoint */
  minScore?: number;
  /** Optional reference/ideal keypoints to draw as a green ghost */
  referenceKeypoints?: Keypoint[];
  /** Whether the user currently matches the target pose */
  posePass?: boolean;
  /** Use bolder strokes for warm-up view */
  bold?: boolean;
}

// ── Color palettes ──────────────────────────────────────────────────────
// Subtle (default — practice mode)
const BONE_COLOR_SUBTLE = 'rgba(255, 255, 255, 0.35)';
const DOT_COLOR_SUBTLE = 'rgba(255, 255, 255, 0.45)';

// Bold (warm-up) — white when not matching, green when matching
const BONE_COLOR_BOLD_DEFAULT = 'rgba(255, 255, 255, 0.7)';
const DOT_COLOR_BOLD_DEFAULT = 'rgba(255, 255, 255, 0.85)';
const BONE_COLOR_BOLD_PASS = 'rgba(74, 222, 128, 0.8)'; // green-400
const DOT_COLOR_BOLD_PASS = 'rgba(74, 222, 128, 0.9)';

// Reference skeleton — always a dimmed green ghost
const REF_BONE_COLOR = 'rgba(74, 222, 128, 0.22)';
const REF_DOT_COLOR = 'rgba(74, 222, 128, 0.30)';

/** Draw one skeleton (bones + dots) onto the context */
function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  keypoints: Keypoint[],
  boneColor: string,
  dotColor: string,
  lineWidth: number,
  dotRadius: number,
  minScore: number,
) {
  // Bones
  ctx.strokeStyle = boneColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  for (const [i, j] of SKELETON_EDGES) {
    const a = keypoints[i];
    const b = keypoints[j];
    if (!a || !b) continue;
    if ((a.score ?? 0) < minScore || (b.score ?? 0) < minScore) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Dots (body only)
  ctx.fillStyle = dotColor;
  for (let i = 0; i < keypoints.length; i++) {
    if (FACE_KEYPOINT_IDS.has(i)) continue;
    const k = keypoints[i];
    if ((k.score ?? 0) < minScore) continue;
    ctx.beginPath();
    ctx.arc(k.x, k.y, dotRadius, 0, 2 * Math.PI);
    ctx.fill();
  }
}

export const PostureSkeleton: React.FC<PostureSkeletonProps> = ({
  keypoints,
  videoWidth,
  videoHeight,
  score: _score,
  minScore = 0.3,
  referenceKeypoints,
  posePass = false,
  bold = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || videoWidth === 0 || videoHeight === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoWidth;
    canvas.height = videoHeight;
    ctx.clearRect(0, 0, videoWidth, videoHeight);

    // Mirror to match the CSS -scale-x-100 on the video
    ctx.save();
    ctx.translate(videoWidth, 0);
    ctx.scale(-1, 1);

    // ── 1. Reference skeleton (drawn first, behind user skeleton) ────────
    if (referenceKeypoints && referenceKeypoints.length > 0) {
      drawSkeleton(ctx, referenceKeypoints, REF_BONE_COLOR, REF_DOT_COLOR, 3, 4, 0.5);
    }

    // ── 2. User skeleton ─────────────────────────────────────────────────
    if (bold) {
      const boneCol = posePass ? BONE_COLOR_BOLD_PASS : BONE_COLOR_BOLD_DEFAULT;
      const dotCol = posePass ? DOT_COLOR_BOLD_PASS : DOT_COLOR_BOLD_DEFAULT;
      drawSkeleton(ctx, keypoints, boneCol, dotCol, 2.5, 4, minScore);
    } else {
      drawSkeleton(ctx, keypoints, BONE_COLOR_SUBTLE, DOT_COLOR_SUBTLE, 1.5, 2.5, minScore);
    }

    ctx.restore();
  }, [keypoints, videoWidth, videoHeight, _score, minScore, referenceKeypoints, posePass, bold]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 10 }}
    />
  );
};
