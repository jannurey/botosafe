"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/partials/Header";
import Footer from "@/components/partials/Footer";

export default function FaceRegisterIntroPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleStartRegistration = () => {
    router.push("/signin/face-register");
  };

  if (!mounted) {
    return <main className="min-h-screen bg-white" />;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-purple-100 to-red-100">
      <Header />
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl bg-white/90 backdrop-blur-lg p-8 rounded-2xl shadow-lg border border-red-200">
          <h1 className="text-3xl font-bold text-[#791010] text-center mb-6">
            Face Registration Setup
          </h1>
          
          <div className="mb-8">
            <p className="text-lg text-gray-700 mb-4 text-center">
              Before we begin, please ensure you're ready for face registration.
            </p>
          </div>

          {/* Requirements */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-6 mb-6 rounded-r-lg">
            <h2 className="text-xl font-semibold text-blue-900 mb-4 flex items-center">
              <span className="mr-2">✓</span> Requirements
            </h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start">
                <span className="text-blue-600 mr-3 text-xl">💡</span>
                <span><strong>Good Lighting:</strong> Position yourself in a well-lit area. Natural light or bright indoor lighting works best.</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-3 text-xl">👤</span>
                <span><strong>Clear Face Visibility:</strong> Ensure your entire face is visible. Remove sunglasses, hats, or anything covering your face.</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-3 text-xl">📱</span>
                <span><strong>Stable Position:</strong> Hold your device steady or place it on a stable surface.</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-3 text-xl">🎯</span>
                <span><strong>Camera Permission:</strong> Allow camera access when prompted by your browser.</span>
              </li>
            </ul>
          </div>

          {/* Process Overview */}
          <div className="bg-purple-50 border-l-4 border-purple-500 p-6 mb-8 rounded-r-lg">
            <h2 className="text-xl font-semibold text-purple-900 mb-4 flex items-center">
              <span className="mr-2">📋</span> What to Expect
            </h2>
            <ol className="space-y-3 text-gray-700 list-decimal list-inside">
              <li><strong>Lighting Check:</strong> System will verify your lighting conditions</li>
              <li><strong>Turn Head Left:</strong> Slowly turn your head to the left</li>
              <li><strong>Turn Head Right:</strong> Slowly turn your head to the right</li>
              <li><strong>Hold Still:</strong> Stay still and look forward for 5 seconds</li>
              <li><strong>Face Registration:</strong> Your face will be captured and saved</li>
            </ol>
          </div>

          {/* Tips */}
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 mb-8 rounded-r-lg">
            <h2 className="text-xl font-semibold text-yellow-900 mb-4 flex items-center">
              <span className="mr-2">💡</span> Tips for Success
            </h2>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-yellow-600 mr-2">•</span>
                <span>Face the camera directly</span>
              </li>
              <li className="flex items-start">
                <span className="text-yellow-600 mr-2">•</span>
                <span>Avoid backlighting (light source behind you)</span>
              </li>
              <li className="flex items-start">
                <span className="text-yellow-600 mr-2">•</span>
                <span>Make sure your face fills most of the camera frame</span>
              </li>
              <li className="flex items-start">
                <span className="text-yellow-600 mr-2">•</span>
                <span>Turn your head slowly and smoothly</span>
              </li>
            </ul>
          </div>

          {/* Start Button */}
          <div className="text-center">
            <button
              onClick={handleStartRegistration}
              className="bg-[#791010] hover:bg-[#5a0c0c] text-white font-bold py-4 px-12 rounded-lg text-lg transition-all transform hover:scale-105 shadow-lg"
            >
              I'm Ready - Start Face Registration
            </button>
          </div>

          {/* Privacy Note */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              🔒 Your face data is encrypted and securely stored. It will only be used for authentication purposes.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
