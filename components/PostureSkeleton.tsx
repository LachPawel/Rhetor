/**
 * PostureSkeleton — draws a minimal, barely-visible white skeleton overlay.
 *
 * Thin half-opaque white lines + tiny dots. Deliberately subtle so it
 * doesn't distract from the speaker's practice.
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
}

// Constant subtle colors
const BONE_COLOR = 'rgba(255, 255, 255, 0.35)';
const DOT_COLOR = 'rgba(255, 255, 255, 0.45)';

export const PostureSkeleton: React.FC<PostureSkeletonProps> = ({
  keypoints,
  videoWidth,
  videoHeight,
  score: _score,
  minScore = 0.3,
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

    // ── Bones — thin white lines ─────────────────────────────────────────
    ctx.strokeStyle = BONE_COLOR;
    ctx.lineWidth = 1.5;
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

    // ── Keypoints — tiny dots (body only, skip face) ──────────────────────
    ctx.fillStyle = DOT_COLOR;
    for (let i = 0; i < keypoints.length; i++) {
      if (FACE_KEYPOINT_IDS.has(i)) continue;
      const kp = keypoints[i];
      if ((kp.score ?? 0) < minScore) continue;
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 2.5, 0, 2 * Math.PI);
      ctx.fill();
    }

    ctx.restore();
  }, [keypoints, videoWidth, videoHeight, _score, minScore]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 10 }}
    />
  );
};
