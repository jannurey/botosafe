// Shared video drawing helpers for canvas with precise fit control.

export type DrawOptions = {
  rotateDeg?: 0 | 90 | 180 | 270;
  mirrorX?: boolean;
  background?: string;
};

function computeFit(
  srcW: number,
  srcH: number,
  outW: number,
  outH: number,
  mode: "cover" | "contain"
) {
  const scale =
    mode === "cover"
      ? Math.max(outW / srcW, outH / srcH)
      : Math.min(outW / srcW, outH / srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  const dx = (outW - drawW) / 2;
  const dy = (outH - drawH) / 2;
  return { drawW, drawH, dx, dy, scale };
}

// Historical helper (cover). Kept for compatibility.
export function drawVideoCovered(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  outW: number,
  outH: number,
  opts?: DrawOptions
): void {
  drawVideoFitted(ctx, video, outW, outH, "cover", opts);
}

// Historical helper (contain). Kept for compatibility.
export function drawVideoContained(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  outW: number,
  outH: number,
  opts?: DrawOptions
): void {
  drawVideoFitted(ctx, video, outW, outH, "contain", opts);
}

// New: choose fit mode explicitly.
export function drawVideoFitted(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  outW: number,
  outH: number,
  mode: "cover" | "contain",
  opts?: DrawOptions
): void {
  const rotateDeg = opts?.rotateDeg ?? 0;
  const mirrorX = !!opts?.mirrorX;

  let srcW = video.videoWidth || 640;
  let srcH = video.videoHeight || 480;

  // If rotated 90/270, swap axes for layout math
  const rot = rotateDeg % 180 !== 0;
  if (rot) [srcW, srcH] = [srcH, srcW];

  const { drawW, drawH, dx, dy } = computeFit(srcW, srcH, outW, outH, mode);

  ctx.save();
  if (opts?.background) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, outW, outH);
  } else {
    ctx.clearRect(0, 0, outW, outH);
  }

  // Move to center of output and apply transforms
  ctx.translate(outW / 2, outH / 2);
  if (rotateDeg) ctx.rotate((rotateDeg * Math.PI) / 180);
  if (mirrorX) ctx.scale(-1, 1);

  // Because we translated to center, draw with offsets from center
  ctx.drawImage(video, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
}

// Utility: predict letterbox thickness ratio if we used "contain"
export function predictedLetterboxRatio(
  srcW: number,
  srcH: number,
  outW: number,
  outH: number
): { horiz: number; vert: number } {
  const { drawW, drawH } = computeFit(srcW, srcH, outW, outH, "contain");
  const horiz = outW > 0 ? Math.max(0, (outW - drawW) / outW) : 0; // bars left+right relative width
  const vert = outH > 0 ? Math.max(0, (outH - drawH) / outH) : 0; // bars top+bottom relative height
  return { horiz, vert };
}
