// Multi-view template store and scoring.

import { averageVector, l2, l2Normalize, cosineDistance } from "./landmarks";

export type YawBin = "left" | "center" | "right";
export type Template = {
  yaw: YawBin;
  embeddings: number[][];
  meanEmbedding: number[]; // normalized
  meanShape?: number[]; // optional rolling mean (length 18)
};

export type TemplateStore = {
  userId: number;
  templates: Template[];
  baseThreshold?: number;
};

export function createEmptyStore(userId: number): TemplateStore {
  return { userId, templates: [] };
}

export function yawToBin(yawDeg: number): YawBin {
  if (yawDeg <= -15) return "left";
  if (yawDeg >= 15) return "right";
  return "center";
}

export function upsertSample(
  store: TemplateStore,
  yaw: YawBin,
  embedding: number[],
  shape?: number[]
): TemplateStore {
  let t = store.templates.find((x) => x.yaw === yaw);
  if (!t) {
    t = { yaw, embeddings: [], meanEmbedding: [] };
    store.templates.push(t);
  }
  const normEmb = l2Normalize(embedding.slice());
  t.embeddings.push(normEmb);
  t.meanEmbedding = l2Normalize(averageVector(t.embeddings));
  if (shape) {
    if (!t.meanShape) t.meanShape = shape.slice();
    else {
      const prev = t.meanShape;
      const k = t.embeddings.length;
      const out = prev.map((v, i) => (v * (k - 1) + shape[i]) / k);
      t.meanShape = out;
    }
  }
  return store;
}

export type ScoreWeights = { wE: number; wS: number };

export type MatchResult = {
  yaw: YawBin;
  embDist: number;
  shapeDist?: number;
  score: number;
};

export function matchAgainstStore(
  store: TemplateStore,
  probeEmbedding: number[],
  preferredYaw: YawBin,
  probeShape?: number[],
  weights: ScoreWeights = { wE: 1.0, wS: 0.4 }
): MatchResult {
  const normEmb = l2Normalize(probeEmbedding);
  const bins: YawBin[] = store.templates.some((t) => t.yaw === preferredYaw)
    ? [preferredYaw]
    : ["center", "left", "right"];

  let best: MatchResult | null = null;

  for (const b of bins) {
    const t = store.templates.find((x) => x.yaw === b);
    if (!t) continue;

    const embDist = cosineDistance(normEmb, t.meanEmbedding);
    let shapeDist: number | undefined;
    if (probeShape && t.meanShape) shapeDist = l2(probeShape, t.meanShape);

    const score =
      embDist * weights.wE +
      (shapeDist !== undefined ? shapeDist * weights.wS : 0);
    const mr: MatchResult = { yaw: b, embDist, shapeDist, score };
    if (!best || mr.score < best.score) best = mr;
  }

  return (
    best ?? {
      yaw: preferredYaw,
      embDist: 1e3,
      shapeDist: 1e3,
      score: 1e6,
    }
  );
}

export function decide(
  mr: MatchResult,
  baseTau = 0.55,
  hasShape = true,
  delta = 0.04
): { accept: boolean; thresholdUsed: number } {
  const tau = hasShape ? baseTau - delta : baseTau + delta;
  return { accept: mr.score < tau, thresholdUsed: tau };
}
