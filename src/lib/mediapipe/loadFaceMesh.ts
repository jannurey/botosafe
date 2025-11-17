// Resilient MediaPipe FaceMesh loader with correct TS typing to avoid "never"/constructable errors.
// Tries self-hosted, then proxy, then CDNs. Caches the working base and constructor.

export interface MpResults {
  multiFaceLandmarks?: Array<Array<{ x: number; y: number; z?: number }>>;
}
export interface MpFaceMesh {
  send(input: {
    image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;
  }): Promise<void> | void;
  onResults(cb: (results: MpResults) => void): void;
  setOptions(opts: {
    maxNumFaces?: number;
    refineLandmarks?: boolean;
    minDetectionConfidence?: number;
    minTrackingConfidence?: number;
  }): void;
  close?: () => void;
}

type FaceMeshCtor = new (opts: {
  locateFile: (f: string) => string;
}) => MpFaceMesh;

const CANDIDATE_BASES: readonly string[] = [
  "/mediapipe/face_mesh", // self-hosted in public/
  "/api/mediapipe", // your proxy endpoint (optional)
  "https://unpkg.com/@mediapipe/face_mesh",
  "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh",
];

let cachedCtor: FaceMeshCtor | null = null;
let cachedBase = "";
let loadOnce: Promise<void> | null = null;

function injectScript(src: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error(`Failed to load script ${src}`));
    };
    document.head.appendChild(script);
  });
}

type FaceMeshGlobal = { FaceMesh?: unknown };

// Type guard: verifies that the global FaceMesh is a constructable function with the expected signature
function isFaceMeshCtor(x: unknown): x is FaceMeshCtor {
  // In the UMD build, FaceMesh is a function/class constructor
  return typeof x === "function";
}

async function tryLoadFromBase(base: string): Promise<FaceMeshCtor> {
  await injectScript(`${base}/face_mesh.js`);
  const g = (globalThis as unknown as FaceMeshGlobal).FaceMesh;
  if (!isFaceMeshCtor(g)) {
    throw new Error(
      "FaceMesh global not found or not a constructor after script load"
    );
  }
  cachedBase = base;
  // Removed console.info for production security
  return g;
}

export async function loadFaceMesh(): Promise<MpFaceMesh> {
  if (cachedCtor) {
    const Ctor: FaceMeshCtor = cachedCtor;
    return new Ctor({ locateFile: (f: string) => `${cachedBase}/${f}` });
  }

  if (!loadOnce) {
    loadOnce = (async () => {
      let lastError: unknown = null;
      for (const base of CANDIDATE_BASES) {
        try {
          const ctor = await tryLoadFromBase(base);
          cachedCtor = ctor; // cache for next calls
          return;
        } catch (err) {
          lastError = err;
        }
      }
      throw (
        lastError ??
        new Error("Failed to load MediaPipe FaceMesh from all sources")
      );
    })();
  }

  await loadOnce;

  if (!cachedCtor || !cachedBase) {
    throw new Error("FaceMesh ctor or base missing");
  }

  const Ctor: FaceMeshCtor = cachedCtor;
  return new Ctor({ locateFile: (f: string) => `${cachedBase}/${f}` });
}
