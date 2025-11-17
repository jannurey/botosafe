"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type * as FaceAPI from "@vladmandic/face-api";
import Header from "@/components/partials/Header";
import Footer from "@/components/partials/Footer";
import FaceModelManager from "@/lib/face-models/FaceModelManager";

type ProgressState = {
  blink: boolean;
};

type StepType = "blink" | "done";

type VotePayload = { userId: number; votes: Record<string, number> };
type Candidate = { id: number; fullname: string; position_name: string };

// ✅ SSR Polyfill for TextEncoder/TextDecoder
if (typeof window === "undefined") {
  import("util").then((util) => {
    if (!("TextEncoder" in globalThis)) {
      (
        globalThis as unknown as { TextEncoder: typeof util.TextEncoder }
      ).TextEncoder = util.TextEncoder;
    }
    if (!("TextDecoder" in globalThis)) {
      (
        globalThis as unknown as { TextDecoder: typeof util.TextDecoder }
      ).TextDecoder = util.TextDecoder;
    }
  });
}

export default function FaceScanVotePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState("Initializing...");
  const [faceapi, setFaceapi] = useState<typeof FaceAPI | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [step, setStep] = useState<StepType>("blink");
  const [progress, setProgress] = useState<ProgressState>({
    blink: false,
  });
  const [verifying, setVerifying] = useState(false);
  const [livenessDone, setLivenessDone] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [votedCandidates, setVotedCandidates] = useState<Candidate[]>([]);
  const [lightingScore, setLightingScore] = useState<number | null>(null);
  const [lightingMessage, setLightingMessage] = useState("");
  // Add state for showing scan again button
  const [showScanAgain, setShowScanAgain] = useState(false);
  // Add state for error messages queue
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  // Add state for success message
  const [successMessage, setSuccessMessage] = useState("");
  // Add state for loading states
  const [cameraLoading, setCameraLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const EAR_THRESHOLD = 0.3;
  const MIN_BRIGHTNESS = 50;
  const MAX_BRIGHTNESS = 200;
  const OPTIMAL_BRIGHTNESS_MIN = 70;
  const OPTIMAL_BRIGHTNESS_MAX = 180;

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Use the global model manager instead of loading face-api directly
    FaceModelManager.loadFaceApi().then((api) => {
      if (api) {
        setFaceapi(api);
      }
    });
  }, []);

  // --- Lighting Detection with Throttling ---
  const analyzeLighting = useCallback((video: HTMLVideoElement): { score: number; message: string } => {
    try {
      // Check if video is ready and has valid dimensions
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
        return { score: 100, message: "Optimal lighting" };
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return { score: 100, message: "Optimal lighting" };

      canvas.width = video.videoWidth / 4; // Reduce size for performance
      canvas.height = video.videoHeight / 4;
      
      // Check if canvas has valid dimensions
      if (canvas.width === 0 || canvas.height === 0) {
        return { score: 100, message: "Optimal lighting" };
      }
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      let totalBrightness = 0;
      let validPixels = 0;
      
      // Sample every 4th pixel for performance
      for (let i = 0; i < data.length; i += 16) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Calculate luminance using standard formula
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        // Only count non-black and non-white pixels for a more accurate reading
        if (brightness > 10 && brightness < 245) {
          totalBrightness += brightness;
          validPixels++;
        }
      }
      
      const averageBrightness = validPixels > 0 ? totalBrightness / validPixels : 127;
      const score = Math.round((averageBrightness / 255) * 100);
      
      let message = "";
      if (averageBrightness < MIN_BRIGHTNESS) {
        message = "Too dark. Move to a brighter area.";
      } else if (averageBrightness > MAX_BRIGHTNESS) {
        message = "Too bright. Reduce glare or move away from direct light.";
      } else if (averageBrightness < OPTIMAL_BRIGHTNESS_MIN) {
        message = "A bit dark. Move closer to a light source.";
      } else if (averageBrightness > OPTIMAL_BRIGHTNESS_MAX) {
        message = "A bit bright. Reduce direct lighting on your face.";
      } else {
        message = "Optimal lighting conditions";
      }
      
      return { score, message };
    } catch (error) {
      console.error("Lighting analysis error:", error);
      return { score: 100, message: "Optimal lighting" };
    }
  }, []);

  // --- EAR calculation ---
  const eyeAspectRatio = (eye: FaceAPI.Point[]): number => {
    const v1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
    const v2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
    const h = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
    return (v1 + v2) / (2 * h);
  };

  // --- Stop camera ---
  const stopCamera = (): void => {
    const video = videoRef.current;
    if (video && video.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach((t) => {
        t.stop();
      });
      video.srcObject = null;
    }
    setCameraLoading(false);
    setProcessing(false);
  };

  // --- Add error message to queue with throttling ---
  const addErrorMessage = useCallback((message: string) => {
    // Prevent adding duplicate messages
    if (errorMessages.includes(message)) {
      return;
    }
    
    // Limit the number of error messages to prevent overflow
    if (errorMessages.length >= 3) {
      // Remove the oldest message
      setErrorMessages(prev => [...prev.slice(1), message]);
    } else {
      setErrorMessages(prev => [...prev, message]);
    }
    
    // Auto remove message after 5 seconds
    setTimeout(() => {
      setErrorMessages(prev => prev.filter(msg => msg !== message));
    }, 5000);
  }, [errorMessages]);

  // --- Clear all error messages ---
  const clearErrorMessages = useCallback(() => {
    setErrorMessages([]);
  }, []);

  // --- Set success message with prevention of duplicates ---
  const setSuccessMsg = useCallback((message: string) => {
    // Prevent setting the same success message multiple times
    if (successMessage === message) {
      return;
    }
    
    setSuccessMessage(message);
    // Auto clear after 3 seconds
    setTimeout(() => {
      setSuccessMessage("");
    }, 3000);
  }, [successMessage]);

  // --- Reset check ---
  const resetCheck = useCallback(() => {
    setStep("blink");
    setProgress({ blink: false });
    setShowScanAgain(false); // Hide scan again button
    clearErrorMessages();
    // Don't stop camera immediately on reset to avoid AbortError
    // Camera will be stopped when component unmounts or when needed
  }, [clearErrorMessages]);

  // --- Verify & Submit Vote ---
  const verifyAndSubmitVote = useCallback(
    async (video: HTMLVideoElement): Promise<void> => {
      if (!faceapi) return;
      setVerifying(true);
      setProcessing(true);
      setStatus("🧠 Verifying your face before voting...");
      clearErrorMessages();

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 10000)
      );

      try {
        await Promise.race([
          (async () => {
            const detection = await faceapi
              .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
              .withFaceLandmarks()
              .withFaceDescriptor();

            if (!detection) throw new Error("no_face");

            const embedding = Array.from(detection.descriptor);
            
            // Get userId from authenticated session instead of localStorage
            const userRes = await fetch("/api/users/me", {
              method: "GET",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
              },
            });
            
            if (!userRes.ok) throw new Error("session_expired");
            const userData = await userRes.json();
            const userId = userData.user.id;

            const res = await fetch("/api/verify-face", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                userId: userId, 
                embedding,
                forVoting: true // Add this flag to indicate it's for voting
              }),
            });

            const data: { match?: boolean; message?: string } =
              await res.json();
              
            // Handle 409 conflict error specifically
            if (res.status === 409) {
              throw new Error(`conflict: ${data.message ?? "Face already registered to another account"}`);
            }
            
            if (!res.ok || !data.match)
              throw new Error(data.message ?? "mismatch");

            const pendingVote = localStorage.getItem("pendingVote");
            if (!pendingVote) throw new Error("no_vote");
            const payload = JSON.parse(pendingVote) as VotePayload;
            const electionId = Number(localStorage.getItem("electionId"));

            const tokenRes = await fetch("/api/generate-vote-token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: userId, electionId }), // Use authenticated userId
            });

            const { voteToken } = await tokenRes.json();
            if (!voteToken) throw new Error("token_failed");

            const voteRes = await fetch("/api/vote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ votes: payload.votes, voteToken, userId }), // Include authenticated userId
            });

            if (!voteRes.ok) throw new Error("vote_failed");

            // 🧾 Display receipt
            const candidateData: Candidate[] = JSON.parse(
              localStorage.getItem("candidateList") ?? "[]"
            );
            const votedList = candidateData.filter((c) =>
              Object.values(payload.votes).includes(c.id)
            );
            setVotedCandidates(votedList);
            setShowReceipt(true);

            localStorage.removeItem("pendingVote");
            stopCamera();
            setSuccessMsg("✅ Vote successfully submitted!");
          })(),
          timeout,
        ]);
      } catch (err: unknown) {
        console.error("Verification Error:", err);
        stopCamera();
        
        // Handle specific error types
        if (err instanceof Error) {
          if (err.message.startsWith("conflict:")) {
          addErrorMessage(`❌ ${err.message.substring(9)}`); // Remove "conflict:" prefix
          setShowScanAgain(true); // Show scan again button
        } else if (err.message === "timeout") {
          addErrorMessage("⚠️ Verification timeout. Please try again.");
          setTimeout(() => resetCheck(), 2000);
        } else if (err.message === "no_face") {
          addErrorMessage("❌ No face detected. Please try again.");
          setTimeout(() => resetCheck(), 2000);
        } else if (err.message === "session_expired") {
          addErrorMessage("❌ Session expired. Please log in again.");
        } else if (err.message === "no_vote") {
          addErrorMessage("❌ No vote data found. Please try again.");
        } else if (err.message === "token_failed") {
          addErrorMessage("❌ Failed to generate vote token. Please try again.");
        } else if (err.message === "vote_failed") {
          addErrorMessage("❌ Failed to submit vote. Please try again.");
        } else {
          addErrorMessage("⚠️ Verification failed. Try again.");
          setTimeout(() => resetCheck(), 2000);
        }
      } else {
        addErrorMessage("⚠️ Verification failed. Unknown error.");
        setTimeout(() => resetCheck(), 2000);
      }
      } finally {
        setVerifying(false);
        setProcessing(false);
      }
    },
    [faceapi, addErrorMessage, setSuccessMsg, clearErrorMessages, resetCheck]
  );

  // --- Load Models ---
  useEffect(() => {
    // Prevent multiple model loading
    // Use the global model manager to check if models are already loaded
    if (!faceapi || modelsLoaded || FaceModelManager.areModelsLoaded()) return;
    
    let isMounted = true;
    
    const loadModels = async (): Promise<void> => {
      try {
        if (!isMounted) return;
        
        setStatus("⚙️ Initializing TensorFlow...");
        // Use the global model manager to load models
        await FaceModelManager.loadModels();
        
        if (!isMounted) return;
        
        setModelsLoaded(true);
        setStatus("✅ Models loaded. Starting camera...");
      } catch (err) {
        if (isMounted) {
          console.error(err);
          setStatus("❌ Model loading failed: " + (err instanceof Error ? err.message : "Unknown error"));
        }
      }
    };
    
    loadModels();
    
    return () => {
      isMounted = false;
    };
  }, [faceapi, modelsLoaded]);

  // --- Camera & Detection ---
  useEffect(() => {
    if (!modelsLoaded || !faceapi) return;

    let stream: MediaStream | null = null;
    let animationId = 0;
    let detectionRunning = true;
    let lightingCheckInterval: NodeJS.Timeout | null = null;
    let lastLightingCheck = 0; // Timestamp of last lighting check
    let lastDetectionTime = 0; // Timestamp of last detection
    const DETECTION_INTERVAL = 100; // Minimum interval between detections (ms)

    const startCamera = async (): Promise<void> => {
      const video = videoRef.current;
      if (!video) return;

      try {
        setCameraLoading(true);
        setStatus("📸 Initializing camera...");
        
        if (video.srcObject) {
          (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        video.srcObject = stream;
        
        // Handle the play() promise properly to avoid AbortError
        try {
          await video.play();
          if (detectionRunning) {
            setStatus("📸 Camera ready...");
            setCameraLoading(false);
          }
        } catch (playError: unknown) {
          // Only log the error if it's not an AbortError (which is expected during cleanup)
          if (playError instanceof Error && playError.name !== 'AbortError' && detectionRunning) {
            console.error("Video play error:", playError);
            setStatus("📸 Camera ready...");
            setCameraLoading(false);
          }
        }
      } catch (err) {
        if (detectionRunning) {
          console.error(err);
          addErrorMessage("❌ Camera access failed");
          setCameraLoading(false);
        }
        return;
      }
    };

    const detectLoop = async (): Promise<void> => {
      const video = videoRef.current;
      if (!detectionRunning || !video || !faceapi) return;

      // Throttle detection to prevent excessive processing
      const now = Date.now();
      if (now - lastDetectionTime < DETECTION_INTERVAL) {
        animationId = requestAnimationFrame(detectLoop);
        return;
      }
      lastDetectionTime = now;

      try {
        const detection = await faceapi
          .detectSingleFace(
            video,
            new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 })
          )
          .withFaceLandmarks();

        if (detection && !livenessDone) {
          const landmarks = detection.landmarks;
          const leftEAR = eyeAspectRatio(landmarks.getLeftEye());
          const rightEAR = eyeAspectRatio(landmarks.getRightEye());
          const ear = (leftEAR + rightEAR) / 2;

          if (step === "blink" && ear < EAR_THRESHOLD) {
            setProgress((p) => ({ ...p, blink: true }));
            setStep("done");
            setStatus("✅ Liveness check passed!");
            setLivenessDone(true);
            detectionRunning = false;
            cancelAnimationFrame(animationId);
            
            // Check lighting before verification (throttled to once per second)
            if (now - lastLightingCheck > 1000) {
              lastLightingCheck = now;
              const lighting = analyzeLighting(video);
              setLightingScore(lighting.score);
              setLightingMessage(lighting.message);
              
              // Only proceed with verification if lighting is acceptable
              if (lighting.score >= 30 && lighting.score <= 220) {
                await verifyAndSubmitVote(video);
              } else {
                addErrorMessage(`⚠️ ${lighting.message} Please adjust lighting before continuing.`);
                setTimeout(() => resetCheck(), 2000);
                return;
              }
            }
            return; // Stop the detection loop immediately
          }
        }
        
        // If liveness check is done, stop the detection loop
        if (livenessDone) {
          return;
        }
      } catch (error) {
        // Only log the error if it's not an AbortError (which is expected during cleanup)
        if (error instanceof Error && error.name !== 'AbortError' && detectionRunning) {
          console.error("Detection error:", error);
        }
      }

      if (detectionRunning) {
        animationId = requestAnimationFrame(detectLoop);
      }
    };

    startCamera().then(() => {
      if (stream && detectionRunning) {
        animationId = requestAnimationFrame(detectLoop);
        
        // Start periodic lighting checks (throttled to once per second)
        lightingCheckInterval = setInterval(() => {
          if (videoRef.current && detectionRunning) {
            const now = Date.now();
            if (now - lastLightingCheck > 1000) {
              lastLightingCheck = now;
              const lighting = analyzeLighting(videoRef.current);
              setLightingScore(lighting.score);
              setLightingMessage(lighting.message);
            }
          }
        }, 1000); // Check lighting every 1000ms instead of 500ms
      }
    });

    return () => {
      detectionRunning = false;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (animationId) cancelAnimationFrame(animationId);
      if (lightingCheckInterval) clearInterval(lightingCheckInterval);
      
      // Clean up TensorFlow memory through FaceModelManager
      FaceModelManager.dispose();
    };
  }, [modelsLoaded, faceapi, livenessDone, step, verifyAndSubmitVote, analyzeLighting, showScanAgain, addErrorMessage, resetCheck]);

  if (!mounted)
    return React.createElement("main", { className: "min-h-screen bg-white" });

  // --- UI ---
  return React.createElement(
    "main",
    {
      className:
        "min-h-screen bg-gradient-to-br from-white via-purple-100 to-red-100",
    },
    React.createElement(Header),
    React.createElement(
      "div",
      { className: "flex items-center justify-center px-4 py-12" },
      React.createElement(
        "div",
        {
          className:
            "w-full max-w-3xl bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-red-200 relative",
        },
        React.createElement(
          "h1",
          { className: "text-2xl font-bold text-[#791010] text-center mb-4" },
          "Face Verification for Voting"
        ),
        React.createElement(
          "p",
          { className: "text-center text-gray-700 mb-4" },
          "Action: Blink"
        ),
        // Error Messages Queue
        errorMessages.length > 0
          ? React.createElement(
              "div",
              { className: "mb-4" },
              errorMessages.map((msg, index) =>
                React.createElement(
                  "div",
                  {
                    key: index,
                    className:
                      "bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-2",
                    role: "alert",
                  },
                  React.createElement("span", { className: "block sm:inline" }, msg),
                  React.createElement(
                    "button",
                    {
                      onClick: () =>
                        setErrorMessages((prev) =>
                          prev.filter((_, i) => i !== index)
                        ),
                      className: "absolute top-0 bottom-0 right-0 px-4 py-3",
                    },
                    React.createElement("span", { className: "text-red-700" }, "×")
                  )
                )
              )
            )
          : null,
        // Success Message
        successMessage
          ? React.createElement(
              "div",
              {
                className:
                  "mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative",
                role: "alert",
              },
              React.createElement("span", { className: "block sm:inline" }, successMessage)
            )
          : null,
        React.createElement(
          "div",
          {
            className:
              "flex flex-col items-center w-full max-w-[480px] aspect-square mx-auto relative",
          },
          React.createElement("video", {
            ref: videoRef,
            autoPlay: true,
            playsInline: true,
            muted: true,
            className: "rounded-lg shadow w-full h-full object-contain bg-black",
          }),
          (cameraLoading || processing || verifying)
            ? React.createElement(
                "div",
                {
                  className:
                    "absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg backdrop-blur-sm",
                },
                React.createElement(
                  "div",
                  { className: "text-center" },
                  React.createElement("div", {
                    className:
                      "w-16 h-16 border-4 border-t-red-600 border-gray-300 rounded-full animate-spin mx-auto mb-2",
                  }),
                  React.createElement(
                    "p",
                    { className: "text-white font-medium" },
                    cameraLoading
                      ? "Initializing camera..."
                      : processing
                      ? "Processing face..."
                      : verifying
                      ? "Verifying face..."
                      : ""
                  )
                )
              )
            : null,
          // Lighting Indicator
          lightingScore !== null
            ? React.createElement(
                "div",
                {
                  className: "absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs",
                },
                React.createElement(
                  "div",
                  { className: "flex items-center" },
                  React.createElement(
                    "span",
                    { className: "mr-2" },
                    lightingScore < 30
                      ? "🌙"
                      : lightingScore > 220
                      ? "☀️"
                      : "💡"
                  ),
                  React.createElement("span", null, `${lightingScore}/100`)
                )
              )
            : null
        ),
        React.createElement(
          "div",
          { className: "flex flex-col items-start mt-4 ml-4 text-sm" },
          React.createElement(
            "div",
            {
              className:
                "bg-white/90 rounded-lg shadow p-3 border border-gray-300",
            },
            React.createElement(
              "p",
              { className: progress.blink ? "text-green-600" : "text-gray-600" },
              progress.blink ? "✅ Blink" : "⬜ Blink"
            )
          ),
          React.createElement(
            "p",
            { className: "mt-4 text-center w-full font-semibold text-gray-700" },
            step === "blink"
              ? "👁 Blink now..."
              : step === "done"
              ? "✅ Liveness check passed!"
              : ""
          ),
          // Lighting Message
          lightingMessage
            ? React.createElement(
                "p",
                {
                  className: `mt-2 text-center w-full text-sm ${
                    lightingMessage.includes("Optimal")
                      ? "text-green-600"
                      : lightingMessage.includes("bit")
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`,
                },
                lightingMessage
              )
            : null
        ),
        React.createElement(
          "p",
          { className: "text-center mt-4 text-gray-600" },
          status
        ),
        // Add Scan Again button that appears when showScanAgain is true
        showScanAgain
          ? React.createElement(
              "div",
              { className: "flex justify-center mt-4" },
              React.createElement(
                "button",
                {
                  className:
                    "bg-[#791010] hover:bg-[#d84141] text-white font-bold py-2 px-6 rounded-lg transition",
                  onClick: () => {
                    // Reset state
                    setShowScanAgain(false);
                    setStep("blink");
                    setProgress({ blink: false });
                    setStatus("📸 Camera ready...");
                    clearErrorMessages();
                    
                    // Restart camera
                    if (videoRef.current) {
                      videoRef.current.srcObject = null;
                    }
                  },
                },
                "Scan Again"
              )
            )
          : null,
        showReceipt
          ? React.createElement(
              "div",
              {
                className:
                  "fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50",
              },
              React.createElement(
                "div",
                {
                  className:
                    "bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 overflow-y-auto max-h-[80vh] border-t-4 border-red-600",
                },
                React.createElement(
                  "h2",
                  {
                    className:
                      "text-xl font-bold text-[#791010] mb-3 text-center",
                  },
                  "🧾 Voting Receipt"
                ),
                React.createElement(
                  "p",
                  { className: "text-gray-700 mb-3 text-center" },
                  "Here are the candidates you voted for:"
                ),
                React.createElement(
                  "ul",
                  { className: "divide-y divide-gray-200 mb-4" },
                  votedCandidates.map((c) =>
                    React.createElement(
                      "li",
                      { key: c.id, className: "py-2 text-gray-800 text-center" },
                      `${c.position_name}: `,
                      React.createElement(
                        "span",
                        { className: "font-semibold text-[#791010]" },
                        c.fullname
                      )
                    )
                  )
                ),
                React.createElement(
                  "button",
                  {
                    className:
                      "w-full bg-gradient-to-r from-[#791010] to-[#d84141] text-white py-2 rounded-xl font-semibold hover:opacity-90 transition",
                    onClick: () => router.replace("/pages/dashboard"),
                  },
                  "Go to Dashboard"
                )
              )
            )
          : null
      )
    ),
    React.createElement(Footer)
  );
}