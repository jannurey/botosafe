import type { NextApiRequest, NextApiResponse } from "next";

const UPSTREAMS = [
  "https://unpkg.com/@mediapipe/face_mesh",
  "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh",
];

function contentTypeFor(p: string) {
  if (p.endsWith(".wasm")) return "application/wasm";
  if (p.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (p.endsWith(".data") || p.endsWith(".binarypb"))
    return "application/octet-stream";
  return "application/octet-stream";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Method Not Allowed");
  }
  const seg = req.query.path;
  const file = Array.isArray(seg) ? seg.join("/") : String(seg ?? "");
  if (!file) return res.status(400).end("Missing file path");

  for (const base of UPSTREAMS) {
    try {
      const r = await fetch(`${base}/${file}`);
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Content-Type", contentTypeFor(file));
      res.setHeader("Accept-Ranges", "bytes");
      return res.status(200).send(buf);
    } catch {
      // try next
    }
  }
  return res.status(502).json({ message: "Failed to fetch MediaPipe asset" });
}
