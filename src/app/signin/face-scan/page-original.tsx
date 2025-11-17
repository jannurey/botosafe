"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type * as tf from "@tensorflow/tfjs";
import type * as FaceAPI from "@vladmandic/face-api";
import Header from "@/components/partials/Header";
import Footer from "@/components/partials/Footer";
import FaceModelManager from "@/lib/face-models/FaceModelManager";

type ProgressState = {
  blink: boolean;
  mouth: boolean;
  head: boolean;
};

type StepType = "blink" | "mouth" | "head" | "done";

// -------- SSR Polyfill --------
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

export default function FaceScanPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState("Initializing...");
  const [faceapi, setFaceapi] = useState<typeof FaceAPI | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [step, setStep] = useState<StepType>("blink");
  const [progress, setProgress] = useState<ProgressState>({
    blink: false,
    mouth: false,
    head: false,
  });
  const [verifying, setVerifying] = useState(false);
  const [livenessDone, setLivenessDone] = useState(false);
  const [lightingScore, setLightingScore] = useState<number | null>(null);
  const [lightingMessage, setLightingMessage] = useState("");
  const [detectionRunning, setDetectionRunning] = useState(true);
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
  const MAR_THRESHOLD = 0.6;
  const MIN_BRIGHTNESS = 50;
  const MAX_BRIGHTNESS = 200;
  const OPTIMAL_BRIGHTNESS_MIN = 70;
  const OPTIMAL_BRIGHTNESS_MAX = 180;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Use the global model manager instead of loading face-api directly
    FaceModelManager.loadFaceApi().then((api) => setFaceapi(api));
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

  // --- Load models ---
  useEffect(() => {
    // Use the global model manager to check if models are already loaded
    if (!faceapi || modelsLoaded || FaceModelManager.areModelsLoaded()) return;

    const loadModels = async (): Promise<void> => {
      try {
        setStatus("⚙️ Initializing TensorFlow...");
        // Use the global model manager to load models
        await FaceModelManager.loadModels();
        
        setModelsLoaded(true);
        setStatus("✅ Models loaded. Starting camera...");
      } catch (err) {
        console.error(err);
        setStatus("❌ Model loading failed");
      }
    };

    loadModels();
  }, [faceapi, modelsLoaded]);

  // --- EAR & MAR calculations ---
  const eyeAspectRatio = (eye: FaceAPI.Point[]): number => {
    const v1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
    const v2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
    const h = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
    return (v1 + v2) / (2 * h);
  };

  const mouthAspectRatio = (mouth: FaceAPI.Point[]): number => {
    const v = Math.hypot(mouth[13].x - mouth[19].x, mouth[13].y - mouth[19].y);
    const h = Math.hypot(mouth[0].x - mouth[6].x, mouth[0].y - mouth[6].y);
    return v / h;
  };

  const stopCamera = (): void => {
    const video = videoRef.current;
    if (video && video.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach((t) => {
        t.stop();
      });
      video.srcObject = null;
    }
    setDetectionRunning(false); // Stop detection when camera is stopped
    setCameraLoading(false);
    setProcessing(false);
  };

  const resetCheck = (): void => {
    setLivenessDone(false);
    setStep("blink");
    setProgress({ blink: false, mouth: false, head: false });
    setDetectionRunning(true); // Enable detection again
    setShowScanAgain(false); // Hide scan again button
    setStatus("📸 Camera ready...");
    clearErrorMessages();
  };

  // --- Add error message to queue with throttling ---
  const addErrorMessage = (message: string) => {
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
  };

  // --- Clear all error messages ---
  const clearErrorMessages = () => {
    setErrorMessages([]);
  };

  // --- Set success message with prevention of duplicates ---
  const setSuccessMsg = (message: string) => {
    // Prevent setting the same success message multiple times
    if (successMessage === message) {
      return;
    }
    
    setSuccessMessage(message);
    // Auto clear after 3 seconds
    setTimeout(() => {
      setSuccessMessage("");
    }, 3000);
  };

  // --- Verify face once after liveness ---
  const verifyFace = useCallback(
    async (video: HTMLVideoElement): Promise<void> => {
      if (!faceapi) return;
      setVerifying(true);
      setProcessing(true);
      setStatus("🧠 Verifying your face...");
      clearErrorMessages();

      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          addErrorMessage("❌ No face detected. Please try again.");
          setVerifying(false);
          setProcessing(false);
          resetCheck();
          return;
        }

        const embedding = Array.from(detection.descriptor);
        
        // Get userId from authenticated session instead of localStorage
        const userRes = await fetch("/api/users/me", {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });
        
        if (!userRes.ok) {
          addErrorMessage("❌ Session expired. Please log in again.");
          setVerifying(false);
          setProcessing(false);
          return;
        }
        
        const userData = await userRes.json();
        const userId = userData.user.id;

        setStatus("🧠 Verifying your face with server...");
        
        // Add timeout to the fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        try {
          const res = await fetch("/api/verify-face", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: userId, embedding }),
            credentials: "include", // Ensure cookies are included in the request
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          const data: { match?: boolean; message?: string; user?: Record<string, unknown> } = await res.json();
          console.log("API Response:", res.status, data); // Debug log

          if (res.ok && data.match && data.user) {
            setSuccessMsg("✅ Face verified successfully!");
            
            // Stop camera before redirecting to prevent play() errors
            stopCamera();
            
            // Remove the temporary localStorage token creation since we're now properly using cookies
            // The server has already set the authToken cookie in the response
            localStorage.setItem("user", JSON.stringify(data.user));
            
            // Redirect to dashboard using window.location for proper authentication
            // Add a small delay to ensure everything is properly set
            console.log("Redirecting to dashboard...");
            setTimeout(() => {
              console.log("Performing redirect to /pages/dashboard");
              window.location.href = "/pages/dashboard";
            }, 500); // Reduced delay since we're not waiting for localStorage token
          } else {
            // Handle 409 conflict error specifically
            if (res.status === 409) {
              addErrorMessage(`❌ ${data.message ?? "Face already registered to another account"}`);
              stopCamera(); // Stop camera on conflict
              setShowScanAgain(true); // Show scan again button
            } else {
              addErrorMessage(`❌ Verification failed: ${data.message ?? "Try again."}`);
              setVerifying(false); // Make sure to reset verifying state
              setProcessing(false);
              resetCheck();
            }
          }
        } catch (err: unknown) {
          clearTimeout(timeoutId);
          console.error("Verification error:", err);
          if (err instanceof Error && err.name === 'AbortError') {
            addErrorMessage("⚠️ Verification timeout. Please try again.");
          } else {
            addErrorMessage("⚠️ Verification error. Try again.");
          }
          setVerifying(false); // Make sure to reset verifying state
          setProcessing(false);
          resetCheck();
        }
      } catch (err) {
        console.error("Face detection error:", err);
        addErrorMessage("⚠️ Face detection error. Try again.");
        setVerifying(false); // Make sure to reset verifying state
        setProcessing(false);
        resetCheck();
      }
    },
    [faceapi]
  );

  // --- Camera + detection loop ---
  useEffect(() => {
    if (!modelsLoaded || !faceapi) return;

    let stream: MediaStream | null = null;
    let animationId = 0;
    let lightingCheckInterval: NodeJS.Timeout | null = null;
    let isProcessing = false; // Flag to prevent concurrent processing
    let isDetectionRunning = true; // Local variable for detection running state
    let lastLightingCheck = 0; // Timestamp of last lighting check
    let lastDetectionTime = 0; // Timestamp of last detection
    const DETECTION_INTERVAL = 100; // Minimum interval between detections (ms)

    const startCamera = async (): Promise<void> => {
      const video = videoRef.current;
      if (!video) return;

      try {
        setCameraLoading(true);
        setStatus("📸 Initializing camera...");
        
        // Clean up any existing stream before starting a new one
        if (video.srcObject) {
          const oldStream = video.srcObject as MediaStream;
          oldStream.getTracks().forEach((t) => {
            try {
              t.stop();
            } catch (e) {
              console.warn("Error stopping old track:", e);
            }
          });
          video.srcObject = null;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });

        video.srcObject = stream;
        
        // Wait a bit for the stream to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Handle the play() promise properly to avoid AbortError
        try {
          await video.play();
          if (isDetectionRunning) {
            setStatus("📸 Camera ready...");
            setCameraLoading(false);
          }
        } catch (playError: unknown) {
          // Only log the error if it's not an AbortError (which is expected during cleanup)
          if (playError instanceof Error && playError.name !== 'AbortError' && isDetectionRunning) {
            console.error("Video play error:", playError);
            setStatus("📸 Camera ready...");
            setCameraLoading(false);
          }
        }
      } catch (err) {
        if (isDetectionRunning) {
          console.error(err);
          addErrorMessage("❌ Camera access failed");
          setCameraLoading(false);
        }
        return;
      }
    };

    const detectLoop = async (): Promise<void> => {
      const video = videoRef.current;
      if (!isDetectionRunning || !video || !faceapi || isProcessing) return;

      // Throttle detection to prevent excessive processing
      const now = Date.now();
      if (now - lastDetectionTime < DETECTION_INTERVAL) {
        animationId = requestAnimationFrame(detectLoop);
        return;
      }
      lastDetectionTime = now;

      try {
        // Set processing flag to prevent concurrent detection
        isProcessing = true;
        
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
          const mar = mouthAspectRatio(landmarks.getMouth());

          if (step === "blink" && ear < EAR_THRESHOLD) {
            setProgress((p) => ({ ...p, blink: true }));
            setStep("mouth");
            setStatus("mojom Open your mouth");
          }

          if (step === "mouth" && mar > MAR_THRESHOLD) {
            setProgress((p) => ({ ...p, mouth: true }));
            setStep("head");
            setStatus("🌀 Turn your head left or right");
          }

          if (step === "head") {
            const noseX = landmarks.getNose()[3].x;
            const leftX = landmarks.positions[0].x;
            const rightX = landmarks.positions[16].x;
            const ratio = (noseX - leftX) / (rightX - leftX);

            if (ratio < 0.35 || ratio > 0.65) {
              setProgress((p) => ({ ...p, head: true }));
              setStep("done");
              setStatus("✅ Liveness check passed!");
              setLivenessDone(true);
              isDetectionRunning = false;
              
              // Cancel animation frame immediately to prevent further processing
              if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = 0;
              }
              
              // Check lighting before verification (throttled to once per second)
              if (now - lastLightingCheck > 1000) {
                lastLightingCheck = now;
                const lighting = analyzeLighting(video);
                setLightingScore(lighting.score);
                setLightingMessage(lighting.message);
                
                // Only proceed with verification if lighting is acceptable
                if (lighting.score >= 30 && lighting.score <= 220) {
                  // Call verifyFace without await to prevent blocking the detection loop
                  verifyFace(video).catch(error => {
                    console.error("Error during face verification:", error);
                    addErrorMessage("⚠️ Verification failed. Try again.");
                    setTimeout(() => resetCheck(), 2000);
                  });
                } else {
                  addErrorMessage(`⚠️ ${lighting.message} Please adjust lighting before continuing.`);
                  setTimeout(() => resetCheck(), 2000);
                  return;
                }
              }
              return;
            }
          }
        }
      } catch (error) {
        // Only log the error if it's not an AbortError (which is expected during cleanup)
        if (error instanceof Error && error.name !== 'AbortError' && isDetectionRunning) {
          console.error("Detection error:", error);
        }
      } finally {
        // Reset processing flag
        isProcessing = false;
      }

      // Only continue the loop if detection is still running
      if (isDetectionRunning && !livenessDone) {
        animationId = requestAnimationFrame(detectLoop);
      }
    };

    startCamera().then(() => {
      if (stream && isDetectionRunning) {
        animationId = requestAnimationFrame(detectLoop);
        
        // Start periodic lighting checks (throttled to once per second)
        lightingCheckInterval = setInterval(() => {
          if (videoRef.current && isDetectionRunning) {
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
      isDetectionRunning = false;
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = 0;
      }
      if (lightingCheckInterval) {
        clearInterval(lightingCheckInterval);
        lightingCheckInterval = null;
      }
      if (stream) {
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch (e) {
            console.warn("Error stopping track:", e);
          }
        });
        stream = null;
      }
      // Clear video srcObject to prevent memory leaks
      const video = videoRef.current;
      if (video) {
        video.srcObject = null;
      }
      
      // Clean up TensorFlow memory through FaceModelManager
      FaceModelManager.dispose();
    };
  }, [modelsLoaded, faceapi, livenessDone, step, verifyFace, analyzeLighting, showScanAgain]);

  if (!mounted)
    return React.createElement("main", { className: "min-h-screen bg-white" });

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
          "Sign In with Face Verification"
        ),
        React.createElement(
          "p",
          { className: "text-center text-gray-700 mb-4" },
          "Actions: Blink → Open Mouth → Turn Head"
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
            ),
            React.createElement(
              "p",
              { className: progress.mouth ? "text-green-600" : "text-gray-600" },
              progress.mouth ? "✅ Open Mouth" : "⬜ Open Mouth"
            ),
            React.createElement(
              "p",
              { className: progress.head ? "text-green-600" : "text-gray-600" },
              progress.head ? "✅ Turn Head" : "⬜ Turn Head"
            )
          ),
          React.createElement(
            "p",
            { className: "mt-4 text-center w-full font-semibold text-gray-700" },
            step === "blink"
              ? "👁 Blink now..."
              : step === "mouth"
              ? "mojom Open your mouth..."
              : step === "head"
              ? "🌀 Turn your head left or right..."
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
                    resetCheck();
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
          : null
      )
    ),
    React.createElement(Footer)
  );
}