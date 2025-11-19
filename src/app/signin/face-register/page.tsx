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

type StepType = "lightingCheck" | "turnLeft" | "turnRight" | "holdStill" | "done";

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
  const [step, setStep] = useState<StepType>("lightingCheck"); // Start with lighting check
  const [progress, setProgress] = useState<ProgressState>({
    turnLeft: false,
    turnRight: false,
    holdStill: false,
  });
  const [lightingCheckPassed, setLightingCheckPassed] = useState(false);
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
  // Add state to track if face is already registered (duplicate detected)
  const [duplicateFaceDetected, setDuplicateFaceDetected] = useState(false);

  const SCAN_DURATION = 5; // Seconds to scan face
  const MIN_BRIGHTNESS = 50;
  const MAX_BRIGHTNESS = 200;
  const OPTIMAL_BRIGHTNESS_MIN = 70;
  const OPTIMAL_BRIGHTNESS_MAX = 180;
  
  // Head pose thresholds for liveness detection (accounting for mirrored video)
  // When user turns LEFT physically → negative yaw angle (nose moves left)
  // When user turns RIGHT physically → positive yaw angle (nose moves right)
  const HEAD_YAW_LEFT_THRESHOLD = -8; // Negative = user turns left physically
  const HEAD_YAW_RIGHT_THRESHOLD = 8; // Positive = user turns right physically
  const HEAD_YAW_CENTER_THRESHOLD = 5; // Within ±5 degrees is center

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

  // Calculate head yaw (left-right rotation) from facial landmarks
  const calculateHeadYaw = (landmarks: FaceAPI.FaceLandmarks68): number => {
    const points = landmarks.positions;
    // Use nose tip (30), left eye outer corner (36), right eye outer corner (45)
    const noseTip = points[30];
    const leftEye = points[36];
    const rightEye = points[45];
    
    // Calculate distances from nose to each eye
    const distLeft = Math.hypot(noseTip.x - leftEye.x, noseTip.y - leftEye.y);
    const distRight = Math.hypot(noseTip.x - rightEye.x, noseTip.y - rightEye.y);
    
    // Calculate yaw angle (negative = left, positive = right)
    // When head turns left, nose is closer to left eye
    // When head turns right, nose is closer to right eye
    const ratio = (distRight - distLeft) / (distRight + distLeft);
    const yawAngle = ratio * 45; // Scale to approximate degrees
    
    return yawAngle;
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
          setStep("turnLeft");
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
            setDuplicateFaceDetected(true); // Mark as duplicate to stop detection loop
            setStep("done"); // Prevent detection loop from restarting
            // Show message for longer and redirect to login
            setTimeout(() => {
              window.location.href = "/signin/login";
            }, 5000);
          } else {
            addErrorMessage(`❌ Registration failed: ${data.message ?? "Unknown error"}`);
            setRegistering(false); // Allow retry for other errors
            setProcessing(false);
            setStep("turnLeft"); // Reset to first step for retry
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
        setStep("turnLeft"); // Reset to first step for retry
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
    let scanningStarted = false; // Local flag to prevent multiple scan starts
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
      
      // Stop detection if duplicate face was detected
      if (duplicateFaceDetected) {
        isDetectionRunning = false;
        return;
      }

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
                scoreThreshold: 0.3,  // Increased from 0.1 - must be an actual face
                inputSize: 224  // Increased from 160 for better accuracy
              })
            )
            .withFaceLandmarks()) ?? null;

        if (detection) {
          // Validate it's actually a face - must have reasonable confidence
          if (detection.detection.score < 0.5) {
            // Too low confidence - probably not a real face
            if (isScanning) {
              consecutiveNoFaceFrames++;
              if (consecutiveNoFaceFrames >= FACE_LOSS_TOLERANCE) {
                setIsScanning(false);
                setScanTimer(0);
                setStatus("⚠️ Low detection quality. Please ensure good lighting and clear face visibility.");
                consecutiveNoFaceFrames = 0;
              }
            }
            animationId = requestAnimationFrame(detectLoop);
            return;
          }
          
          // Reset consecutive no-face counter when face is detected
          consecutiveNoFaceFrames = 0;
          
          // STEP 0: Lighting check (must pass before liveness)
          if (step === "lightingCheck" && !lightingCheckPassed) {
            const lighting = analyzeLighting(videoRef.current);
            setLightingScore(lighting.score);
            setLightingMessage(lighting.message);
            
            // Check if lighting is acceptable
            if (lighting.score >= 30 && lighting.score <= 220) {
              // Lighting is good, proceed to liveness check
              setLightingCheckPassed(true);
              setStep("turnLeft");
              setStatus("✅ Lighting OK! Now turn your head to the LEFT");
            } else {
              // Lighting is poor, keep showing guidance
              setStatus(`⚠️ ${lighting.message}`);
            }
            // Don't proceed to other checks until lighting passes
            animationId = requestAnimationFrame(detectLoop);
            return;
          }
          
          // Get head yaw angle for liveness detection
          const yawAngle = calculateHeadYaw(detection.landmarks);
          
          // Debug: Show yaw angle to user
          if (step === "turnLeft" || step === "turnRight") {
            setStatus(`Head angle: ${yawAngle.toFixed(1)}° - ${step === "turnLeft" ? "Turn your head LEFT" : "Turn your head RIGHT"} - Step: ${step}`);
          }
          
          // Liveness check: User turns LEFT physically (negative angle)
          if (step === "turnLeft" && yawAngle < HEAD_YAW_LEFT_THRESHOLD) {
            console.log(`✅ Physical LEFT turn detected! Angle: ${yawAngle.toFixed(1)}°, Threshold: ${HEAD_YAW_LEFT_THRESHOLD}`);
            setProgress((p) => ({ ...p, turnLeft: true })); // Mark left as complete
            setStep("turnRight"); // Next: user turns right physically
            setStatus("--> Now turn your head to the RIGHT");
          }
          
          // Liveness check: User turns RIGHT physically (positive angle)
          else if (step === "turnRight" && yawAngle > HEAD_YAW_RIGHT_THRESHOLD) {
            console.log(`✅ Physical RIGHT turn detected! Angle: ${yawAngle.toFixed(1)}°, Threshold: ${HEAD_YAW_RIGHT_THRESHOLD}`);
            setProgress((p) => ({ ...p, turnRight: true })); // Mark right as complete
            setStep("holdStill");
            setStatus("📸 Great! Now hold still and look forward...");
          }
          
          // Head turning liveness detection or hold still phase
          if (step === "holdStill" && !isScanning && !scanningStarted) {
            // Face detected in hold still phase, start 5-second timer
            scanningStarted = true; // Set local flag immediately to prevent duplicate starts
            setIsScanning(true);
            setScanTimer(0);
            setStatus("📸 Hold still for 5 seconds...");
          }
          // Don't update status while scanning - let the timer run without interference

          if (step === "done" && !registering) {
            // Immediately proceed with registration when scan is complete
            const video = videoRef.current;
            if (video) {
              const lighting = analyzeLighting(video);
              setLightingScore(lighting.score);
              setLightingMessage(lighting.message);
              
              // Only proceed with registration if lighting is acceptable
              if (lighting.score >= 30 && lighting.score <= 220) {
                isDetectionRunning = false; // Stop detection loop
                await registerFace(video);
              } else {
                addErrorMessage(`⚠️ ${lighting.message} Please adjust lighting before continuing.`);
                scanningStarted = false; // Reset local flag
                setStep("turnLeft");
                setProgress({ turnLeft: false, turnRight: false, holdStill: false });
                setScanTimer(0);
                setIsScanning(false);
                return;
              }
            }
            return; // Stop the detection loop after registration
          }
        } else {
          // No face detected - reset scanning
          if (isScanning) {
            consecutiveNoFaceFrames++;
            
            // Only reset if face is lost for 25 consecutive frames (~2.5 seconds)
            // This is very forgiving for mobile cameras and unstable detection
            if (consecutiveNoFaceFrames >= FACE_LOSS_TOLERANCE) {
              scanningStarted = false; // Reset local flag
              setIsScanning(false);
              setScanTimer(0);
              setStatus("⚠️ Face lost. Please position your face in the camera.");
              consecutiveNoFaceFrames = 0; // Reset counter
            }
          } else {
            // Not scanning yet, update status
            setStatus("📸 No face detected. Please position your face in the camera.");
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
  }, [modelsLoaded, faceapi, step, registering, registerFace, isSecureContext, analyzeLighting, showScanAgain, duplicateFaceDetected]);

  // Scan timer effect - only for holdStill phase
  useEffect(() => {
    if (step === "holdStill" && isScanning && !registering) {
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

      return () => {
        clearInterval(interval);
      };
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
            {duplicateFaceDetected
              ? "Face already registered"
              : step === "lightingCheck"
              ? "Checking lighting conditions..."
              : step === "turnLeft"
              ? "Turn your head to the LEFT"
              : step === "turnRight"
              ? "Turn your head to the RIGHT"
              : step === "holdStill" && isScanning
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
            
            {/* Lighting check indicator */}
            {!duplicateFaceDetected && !cameraLoading && !processing && !registering && step === "lightingCheck" && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                <div className="bg-yellow-500/90 text-white px-8 py-6 rounded-2xl">
                  <div className="text-5xl mb-3">
                    {lightingScore !== null && lightingScore < 30 ? "🌙" : 
                     lightingScore !== null && lightingScore > 220 ? "☀️" : 
                     "💡"}
                  </div>
                  <p className="text-xl font-bold mb-2">Checking Lighting</p>
                  <p className="text-sm">{lightingMessage || "Analyzing..."}</p>
                </div>
              </div>
            )}
            
            {/* Visual indicators for head turning */}
            {!duplicateFaceDetected && !cameraLoading && !processing && !registering && step === "turnLeft" && (
              <div className="absolute top-1/2 left-8 transform -translate-y-1/2">
                <div className="bg-blue-500/80 text-white px-6 py-4 rounded-full text-4xl font-bold animate-pulse">
                  ⬅️
                </div>
                <p className="text-white text-center mt-2 font-semibold bg-black/50 px-3 py-1 rounded">Turn LEFT</p>
              </div>
            )}
            
            {!duplicateFaceDetected && !cameraLoading && !processing && !registering && step === "turnRight" && (
              <div className="absolute top-1/2 right-8 transform -translate-y-1/2">
                <div className="bg-blue-500/80 text-white px-6 py-4 rounded-full text-4xl font-bold animate-pulse">
                  ➡️
                </div>
                <p className="text-white text-center mt-2 font-semibold bg-black/50 px-3 py-1 rounded">Turn RIGHT</p>
              </div>
            )}
            
            {/* Timer and progress for hold still phase */}
            {!duplicateFaceDetected && !cameraLoading && !processing && !registering && step === "holdStill" && isScanning && (
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
            <div className="bg-white/90 rounded-lg shadow p-3 border border-gray-300 space-y-2">
              <p className={lightingCheckPassed ? "text-green-600" : "text-gray-600"}>
                {lightingCheckPassed ? "✅ Lighting Check" : "⬜ Lighting Check"}
              </p>
              <p className={progress.turnLeft ? "text-green-600" : "text-gray-600"}>
                {progress.turnLeft ? "✅ Turn Head Left" : "⬜ Turn Head Left"}
              </p>
              <p className={progress.turnRight ? "text-green-600" : "text-gray-600"}>
                {progress.turnRight ? "✅ Turn Head Right" : "⬜ Turn Head Right"}
              </p>
              <p className={progress.holdStill ? "text-green-600" : "text-gray-600"}>
                {progress.holdStill ? "✅ Hold Still (5s)" : "⬜ Hold Still (5s)"}
              </p>
            </div>

            <p className="mt-4 text-center w-full font-semibold text-gray-700">
              {step === "lightingCheck" && "💡 Checking lighting conditions..."}
              {step === "turnLeft" && "⬅️ Turn your head LEFT"}
              {step === "turnRight" && "➡️ Turn your head RIGHT"}
              {step === "holdStill" && isScanning && `👁 Hold still... ${Math.ceil(SCAN_DURATION - scanTimer)}s`}
              {step === "done" && "✅ Face scan complete!"}
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
                  setStep("turnLeft");
                  setProgress({ turnLeft: false, turnRight: false, holdStill: false });
                  setScanTimer(0);
                  setIsScanning(false);
                  setStatus("📸 Camera ready. Turn your head to the left.");
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