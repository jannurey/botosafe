"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import type * as FaceAPI from "@vladmandic/face-api";
import Header from "@/components/partials/Header";
import Footer from "@/components/partials/Footer";
import FaceModelManager from "@/lib/face-models/FaceModelManager";

type ProgressState = {
  turnLeft: boolean;
  turnRight: boolean;
  holdStill: boolean;
};

type StepType = "scanning" | "done";

// ---------------- SSR Polyfill ----------------
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

export default function FaceRegistrationPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState("Initializing...");
  const [faceapi, setFaceapi] = useState<typeof FaceAPI | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [step, setStep] = useState<StepType>("scanning");
  const [progress, setProgress] = useState<ProgressState>({
    turnLeft: false,
    turnRight: false,
    holdStill: false,
  });
  const [registering, setRegistering] = useState(false);
  const [isSecureContext, setIsSecureContext] = useState(false);
  const [lightingScore, setLightingScore] = useState<number | null>(null);
  const [lightingMessage, setLightingMessage] = useState("");
  // Add state for hold still timer
  const [scanTimer, setScanTimer] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  // Add state for showing scan again button
  const [showScanAgain, setShowScanAgain] = useState(false);
  // Add state for error messages queue
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  // Add state for success message
  const [successMessage, setSuccessMessage] = useState("");
  // Add state for loading states
  const [cameraLoading, setCameraLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const SCAN_DURATION = 5; // Seconds to scan face
  const MIN_BRIGHTNESS = 50;
  const MAX_BRIGHTNESS = 200;
  const OPTIMAL_BRIGHTNESS_MIN = 70;
  const OPTIMAL_BRIGHTNESS_MAX = 180;

  useEffect(() => {
    setMounted(true);
    // Check if we're in a secure context (HTTPS)
    setIsSecureContext(window.isSecureContext);
  }, []);

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
          setStatus("❌ Model loading failed");
        }
      }
    };
    
    loadModels();
    
    return () => {
      isMounted = false;
    };
  }, [faceapi, modelsLoaded]);

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

  // ✅ Memoized face registration (resolves ESLint warning)
  const registerFace = useCallback(
    async (video: HTMLVideoElement) => {
      if (!faceapi) return;
      setRegistering(true);
      setProcessing(true);
      setStatus("🧠 Capturing and saving your face...");
      clearErrorMessages();

      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          addErrorMessage("❌ No face detected. Please try again.");
          setRegistering(false);
          setProcessing(false);
          setStep("scanning");
          setProgress({ turnLeft: false, turnRight: false, holdStill: false });
          setScanTimer(0);
          setIsScanning(false);
          return;
        }

        const embedding = Array.from(detection.descriptor);
        
        // Get user ID from temporary token instead of localStorage
        const res = await fetch("/api/register-face", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // Include cookies to access tempAuthToken
          body: JSON.stringify({ embedding }),
        });

        if (res.ok) {
          setSuccessMsg("✅ Face registered successfully!");
          stopCamera(); // Stop camera after successful registration
          
          // Convert temporary token to full authentication token
          try {
            const convertRes = await fetch("/api/convert-temp-token", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
            });
            
            if (convertRes.ok) {
              // Token conversion successful
              // Redirect to dashboard
              setTimeout(() => {
                window.location.href = "/pages/dashboard";
              }, 3500);
            } else {
              console.error("Token conversion failed");
              // Fallback redirect
              setTimeout(() => {
                window.location.href = "/pages/dashboard";
              }, 3500);
            }
          } catch (convertError) {
            console.error("Error converting token:", convertError);
            // Fallback redirect
            setTimeout(() => {
              window.location.href = "/pages/dashboard";
            }, 3500);
          }
        } else {
          const data: { message?: string } = await res.json();
          if (res.status === 409) {
            // Face already registered to another account
            addErrorMessage(`🚫 ${data.message || "This face is already registered to another account."}`);
            stopCamera(); // Stop camera when face is already registered
            setShowScanAgain(false); // Don't allow scan again for duplicate faces
            setRegistering(false);
            setProcessing(false);
            // Show message for longer and redirect to login
            setTimeout(() => {
              window.location.href = "/signin/login";
            }, 5000);
          } else {
            addErrorMessage(`❌ Registration failed: ${data.message ?? "Unknown error"}`);
            setRegistering(false); // Allow retry for other errors
            setProcessing(false);
            setStep("scanning"); // Reset to scanning step for retry
            setProgress({ turnLeft: false, turnRight: false, holdStill: false });
            setScanTimer(0);
            setIsScanning(false);
          }
        }
      } catch (err) {
        console.error(err);
        addErrorMessage("⚠️ Registration failed. Please try again.");
        setRegistering(false);
        setProcessing(false);
        setStep("scanning"); // Reset to scanning step for retry
        setProgress({ turnLeft: false, turnRight: false, holdStill: false });
        setScanTimer(0);
        setIsScanning(false);
      }
    },
    [faceapi]
  );

  // Camera + detection loop
  useEffect(() => {
    if (!modelsLoaded || !faceapi) return;

    // If not in secure context, show instructions
    if (!isSecureContext && typeof window !== "undefined") {
      addErrorMessage("🔒 Camera access requires HTTPS. Please use a secure connection or try on desktop.");
      return;
    }

    let stream: MediaStream | null = null;
    let animationId = 0;
    let lightingCheckInterval: NodeJS.Timeout | null = null;
    let isDetectionRunning = true;
    let lastLightingCheck = 0; // Timestamp of last lighting check
    let lastDetectionTime = 0; // Timestamp of last detection
    let consecutiveNoFaceFrames = 0; // Count frames without face
    const DETECTION_INTERVAL = 100; // Minimum interval between detections (ms)
    const FACE_LOSS_TOLERANCE = 25; // Allow 25 consecutive frames (~2.5 seconds) without face before resetting

    const startCamera = async () => {
      const video = videoRef.current;
      if (!video) return;

      try {
        setCameraLoading(true);
        setStatus("📸 Initializing camera...");
        
        if (video.srcObject) {
          (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        }

        // Check if mediaDevices is available
        if (!navigator.mediaDevices) {
          addErrorMessage("❌ Camera not available. Please ensure you're using HTTPS and have granted camera permissions.");
          console.error("navigator.mediaDevices is not available");
          setCameraLoading(false);
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
            aspectRatio: 4 / 3,
          },
          audio: false,
        });

        video.srcObject = stream;
        
        // Handle the play() promise properly to avoid AbortError
        try {
          await video.play();
          if (isDetectionRunning) {
            setStatus("📸 Camera ready. Position your face in the camera.");
            setCameraLoading(false);
          }
        } catch (playError: unknown) {
          // Only log the error if it's not an AbortError (which is expected during cleanup)
          if (playError instanceof Error && playError.name !== 'AbortError' && isDetectionRunning) {
            console.error("Video play error:", playError);
            setStatus("📸 Camera ready. Turn your head to the left.");
            setCameraLoading(false);
          }
        }
      } catch (err: unknown) {
        if (isDetectionRunning) {
          console.error(err);
          if (err instanceof Error) {
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            addErrorMessage("❌ Camera access denied. Please allow camera permissions in your browser settings.");
          } else if (err.name === "NotFoundError" || err.name === "OverconstrainedError") {
            addErrorMessage("❌ No camera found or camera not supported.");
          } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
            addErrorMessage("❌ Camera is already in use by another application.");
          } else if (err.name === "TypeError") {
            addErrorMessage("❌ Camera access not supported. Please ensure you're using HTTPS.");
          } else {
            addErrorMessage(`❌ Camera access failed: ${err.message || "Unknown error"}`);
          }
        } else {
          addErrorMessage("❌ Camera access failed: Unknown error");
        }
          setCameraLoading(false);
        }
        return;
      }
    };

    const detectLoop = async (): Promise<void> => {
      if (!isDetectionRunning || !videoRef.current || !faceapi) return;

      // Throttle detection to prevent excessive processing
      const now = Date.now();
      if (now - lastDetectionTime < DETECTION_INTERVAL) {
        animationId = requestAnimationFrame(detectLoop);
        return;
      }
      lastDetectionTime = now;

      try {
        const detection =
          (await faceapi
            .detectSingleFace(
              videoRef.current,
              new faceapi.TinyFaceDetectorOptions({ 
                scoreThreshold: 0.15,  // Very low threshold for mobile
                inputSize: 224  // Smaller input size for better mobile performance
              })
            )
            .withFaceLandmarks()) ?? null;

        if (detection) {
          // Reset consecutive no-face counter when face is detected
          consecutiveNoFaceFrames = 0;
          
          // Simple detection - just check if face is detected
          if (step === "scanning" && !isScanning) {
            // Face detected, start scanning
            setIsScanning(true);
            setScanTimer(0);
            setStatus("📸 Face detected! Stay still for 5 seconds...");
          }

          if (step === "done" && !registering) {
            // Check lighting before registration (throttled to once per second)
            const video = videoRef.current;
            if (video) {
              if (now - lastLightingCheck > 1000) {
                lastLightingCheck = now;
                const lighting = analyzeLighting(video);
                setLightingScore(lighting.score);
                setLightingMessage(lighting.message);
                
                // Only proceed with registration if lighting is acceptable
                if (lighting.score >= 30 && lighting.score <= 220) {
                  isDetectionRunning = false; // Stop detection loop
                  await registerFace(videoRef.current);
                } else {
                  addErrorMessage(`⚠️ ${lighting.message} Please adjust lighting before continuing.`);
                  setStep("scanning");
                  setProgress({ turnLeft: false, turnRight: false, holdStill: false });
                  setScanTimer(0);
                  setIsScanning(false);
                  return;
                }
              }
            }
            return; // Stop the detection loop after registration
          }
        } else {
          // No face detected - use high tolerance to avoid resetting on brief detection failures
          if (isScanning) {
            consecutiveNoFaceFrames++;
            
            // Only reset if face is lost for 25 consecutive frames (~2.5 seconds)
            // This is very forgiving for mobile cameras and unstable detection
            if (consecutiveNoFaceFrames >= FACE_LOSS_TOLERANCE) {
              setIsScanning(false);
              setScanTimer(0);
              setStatus("⚠️ Face lost for too long. Please stay in frame.");
              consecutiveNoFaceFrames = 0; // Reset counter
            }
            // Otherwise, keep timer running even if face not detected
          }
        }
      } catch (error) {
        // Only log the error if it's not an AbortError (which is expected during cleanup)
        if (error instanceof Error && error.name !== 'AbortError' && isDetectionRunning) {
          console.error("Detection error:", error);
        }
      }

      if (isDetectionRunning) {
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
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (animationId) cancelAnimationFrame(animationId);
      if (lightingCheckInterval) clearInterval(lightingCheckInterval);
      
      // Clean up TensorFlow memory
      if (tf && typeof tf.disposeVariables === 'function') {
        try {
          tf.disposeVariables();
        } catch (e) {
          console.warn("Error disposing TensorFlow variables:", e);
        }
      }
    };
  }, [modelsLoaded, faceapi, step, registering, registerFace, isSecureContext, analyzeLighting, showScanAgain]);

  // Scan timer effect
  useEffect(() => {
    if (step === "scanning" && isScanning && !registering) {
      const interval = setInterval(() => {
        setScanTimer((prev) => {
          const newTime = prev + 0.1;
          if (newTime >= SCAN_DURATION) {
            clearInterval(interval);
            // Scan duration complete
            setProgress((p) => ({ ...p, holdStill: true }));
            setStep("done");
            setStatus("✅ Scan complete! Registering your face...");
            return SCAN_DURATION;
          }
          return newTime;
        });
      }, 100); // Update every 100ms for smooth progress

      return () => clearInterval(interval);
    }
  }, [step, isScanning, registering]);

  if (!mounted) {
    return <main className="min-h-screen bg-white" />;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-purple-100 to-red-100">
      <Header />
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-3xl bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-red-200 relative">
          <h1 className="text-2xl font-bold text-[#791010] text-center mb-4">
            Face Registration
          </h1>
          <p className="text-center text-gray-700 mb-4">
            {step === "scanning" && isScanning
              ? `Stay in frame: ${Math.ceil(SCAN_DURATION - scanTimer)}s remaining`
              : step === "done"
              ? "Processing..."
              : "Position your face in the camera"}
          </p>

          {/* Error Messages Queue */}
          {errorMessages.length > 0 && (
            <div className="mb-4">
              {errorMessages.map((msg, index) => (
                <div 
                  key={index} 
                  className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-2"
                  role="alert"
                >
                  <span className="block sm:inline">{msg}</span>
                  <button 
                    onClick={() => setErrorMessages(prev => prev.filter((_, i) => i !== index))}
                    className="absolute top-0 bottom-0 right-0 px-4 py-3"
                  >
                    <span className="text-red-700">×</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
              <span className="block sm:inline">{successMessage}</span>
            </div>
          )}

          <div className="flex flex-col items-center w-full max-w-[640px] aspect-video mx-auto relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="rounded-lg shadow w-full h-full object-contain bg-black"
              style={{ transform: 'scaleX(-1)' }}
            />
            {(cameraLoading || processing || registering) && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg backdrop-blur-sm">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-t-red-600 border-gray-300 rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-white font-medium">
                    {cameraLoading ? "Initializing camera..." : 
                     processing ? "Processing face..." : 
                     registering ? "Registering face..." : ""}
                  </p>
                </div>
              </div>
            )}
            
            {/* Arrow Indicators - removed as we simplified the liveness check */}
            {!cameraLoading && !processing && !registering && step === "scanning" && isScanning && (
              <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2">
                <div className="bg-blue-500/80 text-white px-6 py-3 rounded-full text-lg font-bold">
                  {Math.ceil(SCAN_DURATION - scanTimer)}s
                </div>
                {/* Progress bar */}
                <div className="mt-2 w-48 h-2 bg-gray-300 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-100"
                    style={{ width: `${(scanTimer / SCAN_DURATION) * 100}%` }}
                  />
                </div>
              </div>
            )}
            
            {/* Lighting Indicator */}
            {lightingScore !== null && (
              <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                <div className="flex items-center">
                  <span className="mr-2">
                    {lightingScore < 30 ? "🌙" : 
                     lightingScore > 220 ? "☀️" : 
                     "💡"}
                  </span>
                  <span>{lightingScore}/100</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col items-start mt-4 ml-4 text-sm">
            <div className="bg-white/90 rounded-lg shadow p-3 border border-gray-300">
              <p className={progress.holdStill ? "text-green-600" : "text-gray-600"}>
                {progress.holdStill ? "✅ Face Scan (5s)" : "⬜ Face Scan (5s)"}
              </p>
            </div>

            <p className="mt-4 text-center w-full font-semibold text-gray-700">
              {step === "scanning" && isScanning && `👁 Scanning... ${Math.ceil(SCAN_DURATION - scanTimer)}s`}
              {step === "done" && "✅ Face scan complete!"}
              {step === "scanning" && !isScanning && "📸 Please position your face"}
            </p>
            
            {/* Lighting Message */}
            {lightingMessage && (
              <p className={`mt-2 text-center w-full text-sm ${
                lightingMessage.includes("Optimal") ? "text-green-600" : 
                lightingMessage.includes("bit") ? "text-yellow-600" : 
                "text-red-600"
              }`}>
                {lightingMessage}
              </p>
            )}
          </div>

          <p className="text-center mt-4 text-gray-600">{status}</p>
          
          {/* Add Scan Again button that appears when showScanAgain is true */}
          {showScanAgain && (
            <div className="flex justify-center mt-4">
              <button
                className="bg-[#791010] hover:bg-[#d84141] text-white font-bold py-2 px-6 rounded-lg transition"
                onClick={() => {
                  // Reset state
                  setShowScanAgain(false);
                  setStep("scanning");
                  setProgress({ turnLeft: false, turnRight: false, holdStill: false });
                  setScanTimer(0);
                  setIsScanning(false);
                  setStatus("📸 Camera ready. Position your face in the camera.");
                  clearErrorMessages();
                  
                  // Restart camera
                  if (videoRef.current) {
                    videoRef.current.srcObject = null;
                  }
                }}
              >
                Scan Again
              </button>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </main>
  );
}