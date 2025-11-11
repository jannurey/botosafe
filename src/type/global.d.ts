// Minimal additions for browsers that support requestVideoFrameCallback
declare global {
  interface HTMLVideoElement {
    requestVideoFrameCallback?(
      callback: (
        now: number,
        metadata: { mediaTime: number; presentedFrames: number }
      ) => void
    ): number;
    cancelVideoFrameCallback?(handle: number): void;
  }
}
export {};
