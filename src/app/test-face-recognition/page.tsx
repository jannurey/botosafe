"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import type * as FaceAPI from "@vladmandic/face-api";
import FaceModelManager from "@/lib/face-models/FaceModelManager";

export default function TestFaceRecognition() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState("Initializing...");
  const [faceapi, setFaceapi] = useState<typeof FaceAPI | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);
  const [recognitionResult, setRecognitionResult] = useState<{
    recognized: boolean;
    userId?: number;
    similarity?: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    FaceModelManager.loadFaceApi().then((api) => setFaceapi(api));
  }, []);

  // Load Models
  useEffect(() => {
    if (!faceapi || modelsLoaded || FaceModelManager.areModelsLoaded()) return;
    
    let isMounted = true;
    
    const loadModels = async (): Promise<void> => {
      try {
        if (!isMounted) return;
        
        setStatus("⚙️ Initializing TensorFlow...");
        await FaceModelManager.loadModels();
        
        if (!isMounted) return;
        
        setModelsLoaded(true);
        setStatus("✅ Models loaded. Starting camera...");
        addTestResult("✅ Face recognition models loaded successfully");
      } catch (err) {
        if (isMounted) {
          console.error(err);
          setStatus("❌ Model loading failed");
          addTestResult("❌ Failed to load face recognition models");
        }
      }
    };
    
    loadModels();
    
    return () => {
      isMounted = false;
    };
  }, [faceapi, modelsLoaded]);

  const addTestResult = (message: string) => {
    setTestResults(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const stopCamera = (): void => {
    const video = videoRef.current;
    if (video && video.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
    setCameraLoading(false);
    setProcessing(false);
  };

  const testFaceRecognition = useCallback(
    async (video: HTMLVideoElement) => {
      if (!faceapi) return;
      setProcessing(true);
      setStatus("🧠 Capturing your face...");
      setRecognitionResult(null);

      try {
        addTestResult("📸 Starting face capture...");
        
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          addTestResult("❌ No face detected");
          setStatus("❌ No face detected. Please position your face in the camera.");
          setProcessing(false);
          return;
        }

        addTestResult(`✅ Face detected! Confidence: ${(detection.detection.score * 100).toFixed(2)}%`);

        const embedding = Array.from(detection.descriptor);
        addTestResult(`📊 Face embedding captured: ${embedding.length} dimensions`);

        setStatus("🔍 Checking against database...");
        addTestResult("🔍 Searching database for matching faces...");

        // Test with all users in database
        const res = await fetch("/api/test-face-recognition/check-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ embedding }),
        });

        const data = await res.json();
        
        if (res.ok) {
          if (data.match) {
            addTestResult(`✅ FACE RECOGNIZED!`);
            addTestResult(`   - User ID: ${data.userId}`);
            addTestResult(`   - Best Similarity: ${(data.bestSimilarity * 100).toFixed(2)}%`);
            addTestResult(`   - Threshold: ${(data.threshold * 100).toFixed(2)}%`);
            addTestResult(`   - Total faces checked: ${data.totalFacesChecked}`);
            
            setRecognitionResult({
              recognized: true,
              userId: data.userId,
              similarity: data.bestSimilarity,
              message: `Face recognized! Matched with User ID: ${data.userId}`
            });
            setStatus(`✅ Face recognized! User ID: ${data.userId}`);
          } else {
            addTestResult(`❌ Face NOT recognized in database`);
            addTestResult(`   - Best similarity found: ${(data.bestSimilarity * 100).toFixed(2)}%`);
            addTestResult(`   - Required threshold: ${(data.threshold * 100).toFixed(2)}%`);
            addTestResult(`   - Total faces checked: ${data.totalFacesChecked}`);
            
            setRecognitionResult({
              recognized: false,
              message: "Face not found in database"
            });
            setStatus("❌ Face not recognized");
          }
        } else {
          addTestResult(`❌ Error: ${data.message || "Unknown error"}`);
          setStatus(`❌ Error: ${data.message || "Unknown error"}`);
        }
        
        setProcessing(false);
      } catch (err) {
        console.error(err);
        addTestResult(`❌ Error during face recognition test: ${err instanceof Error ? err.message : "Unknown error"}`);
        setStatus("❌ Test failed");
        setProcessing(false);
      }
    },
    [faceapi]
  );

  // Camera setup
  useEffect(() => {
    if (!modelsLoaded || !faceapi) return;

    let stream: MediaStream | null = null;

    const startCamera = async () => {
      const video = videoRef.current;
      if (!video) return;

      try {
        setCameraLoading(true);
        setStatus("📸 Initializing camera...");
        addTestResult("📸 Requesting camera access...");
        
        if (video.srcObject) {
          (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        video.srcObject = stream;
        await video.play();
        
        setStatus("✅ Camera ready. Click 'Test Recognition' to scan your face.");
        setCameraLoading(false);
        addTestResult("✅ Camera initialized successfully");
      } catch (err: unknown) {
        console.error(err);
        if (err instanceof Error) {
          addTestResult(`❌ Camera error: ${err.message}`);
          setStatus(`❌ Camera access failed: ${err.message}`);
        }
        setCameraLoading(false);
      }
    };

    startCamera();

    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [modelsLoaded, faceapi]);

  if (!mounted) {
    return <main className="min-h-screen bg-white" />;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-red-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-purple-200">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-purple-900 mb-2">
              🧪 Face Recognition Test
            </h1>
            <p className="text-gray-600">
              Test if the system can recognize your registered face
            </p>
          </div>

          {/* Main Content Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Camera View */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800">Camera Feed</h2>
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-lg">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                  style={{ transform: 'scaleX(-1)' }}
                />
                {(cameraLoading || processing) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="text-center">
                      <div className="w-16 h-16 border-4 border-t-purple-600 border-gray-300 rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-white font-medium">
                        {cameraLoading ? "Initializing camera..." : "Processing..."}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="bg-gray-100 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700">{status}</p>
              </div>

              {/* Test Button */}
              <button
                onClick={() => videoRef.current && testFaceRecognition(videoRef.current)}
                disabled={!modelsLoaded || processing || cameraLoading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg transition shadow-md disabled:cursor-not-allowed"
              >
                {processing ? "Testing..." : "🔍 Test Recognition"}
              </button>

              {/* Recognition Result */}
              {recognitionResult && (
                <div className={`rounded-lg p-4 ${recognitionResult.recognized ? 'bg-green-100 border-2 border-green-500' : 'bg-red-100 border-2 border-red-500'}`}>
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">
                      {recognitionResult.recognized ? '✅' : '❌'}
                    </div>
                    <div className="flex-1">
                      <p className={`font-bold ${recognitionResult.recognized ? 'text-green-800' : 'text-red-800'}`}>
                        {recognitionResult.message}
                      </p>
                      {recognitionResult.recognized && (
                        <p className="text-sm text-green-700 mt-1">
                          Similarity: {((recognitionResult.similarity || 0) * 100).toFixed(2)}%
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Test Results Log */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-800">Test Log</h2>
                <button
                  onClick={() => setTestResults([])}
                  className="text-sm text-gray-600 hover:text-gray-800 underline"
                >
                  Clear Log
                </button>
              </div>
              <div className="bg-gray-900 rounded-lg p-4 h-[500px] overflow-y-auto font-mono text-sm">
                {testResults.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Test results will appear here...
                  </p>
                ) : (
                  <div className="space-y-1">
                    {testResults.map((result, index) => (
                      <div
                        key={index}
                        className={`${
                          result.includes('✅') ? 'text-green-400' :
                          result.includes('❌') ? 'text-red-400' :
                          result.includes('⚠️') || result.includes('📊') ? 'text-yellow-400' :
                          'text-gray-300'
                        }`}
                      >
                        {result}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">📋 Test Instructions:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
              <li>Wait for the camera to initialize</li>
              <li>Position your face clearly in the camera frame</li>
              <li>Click "Test Recognition" to scan your face</li>
              <li>The system will check if your face matches any registered user</li>
              <li>Results will show in the log and recognition status</li>
            </ol>
          </div>

          {/* Warning */}
          <div className="mt-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ Test Environment:</strong> This is a testing page. Delete the entire <code className="bg-yellow-200 px-1 rounded">test-face-recognition</code> folder when done testing.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
