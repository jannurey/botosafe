import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

type Vec = number[];

// Rows returned by Supabase
interface FaceRow {
  user_id: number;
  face_embedding: string;
}

function toNumberArray(input: any): number[] {
  if (Array.isArray(input)) return input.map((v) => Number(v));
  throw new Error("Invalid embedding format");
}

function normalize(v: Vec): Vec {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

function cosine(a: Vec, b: Vec): number {
  if (a.length !== b.length) return -1;
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
  return dot / denom;
}

async function main() {
  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    THRESHOLD = "0.75",
    IMPOSTOR_SAMPLES_PER_USER = "50",
  } = process.env as Record<string, string>;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
  }

  // Create Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Fetch face embeddings from Supabase
  const { data: rows, error } = await supabase
    .from('user_faces')
    .select('user_id, face_embedding');

  if (error) {
    throw new Error(`Supabase query error: ${error.message}`);
  }

  // Parse embeddings: row JSON can be single vector or array of vectors
  const perUser: Map<number, Vec[]> = new Map();
  for (const r of rows) {
    try {
      const parsed = JSON.parse(r.face_embedding);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        Array.isArray(parsed[0])
      ) {
        // array of vectors
        for (const e of parsed) {
          const v = normalize(toNumberArray(e));
          if (!perUser.has(r.user_id)) perUser.set(r.user_id, []);
          perUser.get(r.user_id)!.push(v);
        }
      } else if (Array.isArray(parsed)) {
        const v = normalize(toNumberArray(parsed));
        if (!perUser.has(r.user_id)) perUser.set(r.user_id, []);
        perUser.get(r.user_id)!.push(v);
      }
    } catch {
      // skip invalid rows
    }
  }

  const users = [...perUser.keys()];
  if (users.length < 2) {
    console.log("Not enough users with embeddings to compute FAR/FRR.");
    return;
  }

  // Build genuine pairs (same-user, need >=2 samples)
  const genuine: number[] = [];
  for (const uid of users) {
    const arr = perUser.get(uid)!;
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        genuine.push(cosine(arr[i], arr[j]));
      }
    }
  }

  // Build impostor pairs by sampling
  const impostor: number[] = [];
  const perUserSample = Math.max(1, Number(IMPOSTOR_SAMPLES_PER_USER));
  for (const uid of users) {
    const a = perUser.get(uid)!;
    for (let k = 0; k < perUserSample; k++) {
      const aVec = a[Math.floor(Math.random() * a.length)];
      // pick a different user
      let other = uid;
      for (let guard = 0; guard < 5 && other === uid; guard++) {
        other = users[Math.floor(Math.random() * users.length)];
      }
      if (other === uid) continue;
      const bArr = perUser.get(other)!;
      const bVec = bArr[Math.floor(Math.random() * bArr.length)];
      impostor.push(cosine(aVec, bVec));
    }
  }

  const T = Number(THRESHOLD);
  const FRR = genuine.length
    ? genuine.filter((s) => s < T).length / genuine.length
    : NaN; // if no genuine pairs
  const FAR = impostor.length
    ? impostor.filter((s) => s >= T).length / impostor.length
    : NaN;

  // EER sweep (coarse)
  const sweep: { thr: number; FAR: number; FRR: number; diff: number }[] = [];
  for (let thr = 0.4; thr <= 0.8; thr += 0.01) {
    const frr = genuine.length
      ? genuine.filter((s) => s < thr).length / genuine.length
      : NaN;
    const far = impostor.length
      ? impostor.filter((s) => s >= thr).length / impostor.length
      : NaN;
    if (!Number.isNaN(frr) && !Number.isNaN(far)) {
      sweep.push({
        thr: +thr.toFixed(2),
        FAR: far,
        FRR: frr,
        diff: Math.abs(far - frr),
      });
    }
  }
  sweep.sort((a, b) => a.diff - b.diff);
  const eer = sweep[0];

  console.log(
    JSON.stringify(
      {
        users_with_embeddings: users.length,
        genuine_pairs: genuine.length,
        impostor_pairs: impostor.length,
        threshold: T,
        FRR: Number.isNaN(FRR) ? null : +FRR.toFixed(4),
        FAR: Number.isNaN(FAR) ? null : +FAR.toFixed(4),
        EER_estimate: eer
          ? {
              threshold: eer.thr,
              FAR: +eer.FAR.toFixed(4),
              FRR: +eer.FRR.toFixed(4),
            }
          : null,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});