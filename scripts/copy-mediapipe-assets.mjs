import fs from "node:fs/promises";
import path from "node:path";

const srcDir = path.resolve("node_modules/@mediapipe/face_mesh");
const dstDir = path.resolve("public/mediapipe/face_mesh");

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function copyRecursive(src, dst) {
  const entries = await fs.readdir(src, { withFileTypes: true });
  await ensureDir(dst);
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) {
      await copyRecursive(s, d);
    } else {
      const allow =
        /\.js$|\.wasm$|\.data$|\.binarypb$|\.json$/i.test(e.name) ||
        e.name === "LICENSE";
      if (allow) {
        await fs.copyFile(s, d);
      }
    }
  }
}

try {
  await copyRecursive(srcDir, dstDir);
  console.log(`[mediapipe] Copied assets to ${dstDir}`);
} catch (err) {
  console.error("[mediapipe] Failed to copy assets:", err);
  process.exitCode = 1;
}
