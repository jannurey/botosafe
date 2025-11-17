export function computeMobileRotation(
  video: HTMLVideoElement
): 0 | 90 | 180 | 270 {
  try {
    const isMobile =
      typeof navigator !== "undefined"
        ? /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
        : false;
    if (!isMobile) return 0;

    const vw = video.videoWidth || 0;
    const vh = video.videoHeight || 0;

    const angleRaw =
      (typeof screen !== "undefined" &&
        (screen.orientation?.angle ??
          (typeof window !== "undefined" ? (window as unknown as { orientation: number }).orientation : 0))) ||
      0;
    let angle = Number(angleRaw) || 0;
    angle %= 360;
    if (angle < 0) angle += 360;

    if (vh > vw && (angle === 0 || angle === 180)) return 90;
    if (vh > vw && (angle === 90 || angle === 270)) return 0;

    return 0;
  } catch {
    return 0;
  }
}
