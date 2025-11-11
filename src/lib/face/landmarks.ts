// Utilities for shape features and vector ops from MediaPipe FaceMesh landmarks.

export const FM = {
  leftEyeOuter: 33,
  rightEyeOuter: 263,
  leftEyeInner: 133,
  rightEyeInner: 362,
  noseTip: 1,
  noseBridge: 6,
  mouthLeft: 61,
  mouthRight: 291,
  chin: 152,
} as const;

export type Landmark = { x: number; y: number; z?: number };

// Build a small, repeatable 2D shape vector normalized by inter-ocular distance.
// This is robust to scale and moderately robust to expression/pose.
export function makeNormalizedShape(landmarks: Landmark[]): number[] {
  const li = FM.leftEyeOuter;
  const ri = FM.rightEyeOuter;
  const ptsIdx = [
    FM.leftEyeOuter,
    FM.leftEyeInner,
    FM.rightEyeOuter,
    FM.rightEyeInner,
    FM.noseTip,
    FM.noseBridge,
    FM.mouthLeft,
    FM.mouthRight,
    FM.chin,
  ];

  const eyeL = landmarks[li];
  const eyeR = landmarks[ri];

  const iod = Math.hypot(eyeL.x - eyeR.x, eyeL.y - eyeR.y) || 1; // inter-ocular distance
  const cx = (eyeL.x + eyeR.x) / 2;
  const cy = (eyeL.y + eyeR.y) / 2;

  const norm: number[] = [];
  for (const i of ptsIdx) {
    const p = landmarks[i];
    const nx = (p.x - cx) / iod;
    const ny = (p.y - cy) / iod;
    norm.push(nx, ny);
  }
  return norm; // length = 18
}

// Vector utilities
export function averageVector(vecs: number[][]): number[] {
  if (!vecs.length) return [];
  const out = new Array<number>(vecs[0].length).fill(0);
  for (const v of vecs) for (let i = 0; i < out.length; i++) out[i] += v[i];
  for (let i = 0; i < out.length; i++) out[i] /= vecs.length;
  return out;
}

export function l2Normalize(v: number[]): number[] {
  let s = 0;
  for (const x of v) s += x * x;
  const n = Math.sqrt(s) || 1;
  return v.map((x) => x / n);
}

export function cosineDistance(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
  const cos = dot / denom;
  return 1 - cos; // 0 = identical, → higher = less similar
}

export function l2(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}
