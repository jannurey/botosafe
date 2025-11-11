// Rough yaw estimation from key FaceMesh landmarks.
// Good enough for binning into left/center/right.

import { FM, type Landmark } from "./landmarks";

export function estimateYawDeg(landmarks: Landmark[]): number {
  const L = landmarks[FM.leftEyeOuter];
  const R = landmarks[FM.rightEyeOuter];
  const N = landmarks[FM.noseTip];

  const eyeMid = { x: (L.x + R.x) / 2, y: (L.y + R.y) / 2 };
  const dx = N.x - eyeMid.x;
  const iod = Math.hypot(R.x - L.x, R.y - L.y) || 1;
  const normalized = dx / iod; // [-0.5, 0.5] typical
  const yawDeg = normalized * 60; // heuristic gain
  return Math.max(-60, Math.min(60, yawDeg));
}
