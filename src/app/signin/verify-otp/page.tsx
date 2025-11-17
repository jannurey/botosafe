"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/partials/Header";
import Footer from "@/components/partials/Footer";

export default function VerifyOtpPage() {
  const router = useRouter();
  const [otpDigits, setOtpDigits] = useState<string[]>([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  const [statusMessage, setStatusMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [username, setUsername] = useState(""); // Changed from email to username
  const [userId, setUserId] = useState("");
  const [timeLeft, setTimeLeft] = useState(5 * 60); // Start with 5 minutes (300 seconds)
  const inputRefs = useRef<HTMLInputElement[]>([]);

  useEffect(() => {
    const storedUsername = localStorage.getItem("username") || ""; // Changed from email to username
    const storedUserId = localStorage.getItem("userId") || "";
    setUsername(storedUsername);
    setUserId(storedUserId);

    // Auto-focus first OTP input on load
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 0);
    
    // Start countdown timer
    setTimeLeft(5 * 60);
  }, []);

  // Countdown effect
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  // OTP is now automatically sent from the login page, so we don't need handleSendOtp
  // We'll keep it for resend functionality only
  const handleResendOtp = async () => {
    if (sending) return; // 🔒 prevent duplicate requests

    if (!username) { // Changed from email to username
      setStatusMessage("Missing username information.");
      return;
    }

    setSending(true);
    setStatusMessage("");

    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: username }), // Still send as email for API compatibility
      });

      const data = await res.json();
      if (!res.ok) {
        setStatusMessage(data.message || "Failed to send OTP.");
      } else {
        setStatusMessage("OTP resent to your email.");
        setTimeLeft(5 * 60); // Reset timer to 5 minutes
      }
    } catch {
      setStatusMessage("An error occurred while sending OTP.");
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setStatusMessage("");
    const otp = otpDigits.join("");
    
    // Sending OTP verification request

    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Include cookies in the request and response
        body: JSON.stringify({ otp }), // Don't send userId, it's retrieved from cookie
      });
      
      // OTP verification response received

      const data = await res.json();
      // OTP verification response data
      if (!res.ok) {
        setStatusMessage(data.message || "Invalid OTP.");
      } else {
        // Save token
        localStorage.setItem("token", data.token);

        // ✅ Save complete user info
        localStorage.setItem("user", JSON.stringify(data.user));

        // Clear temporary login flags
        localStorage.removeItem("tempLogin");
        localStorage.removeItem("tempUserId");
        localStorage.removeItem("skipFaceRegistration"); // Clear the skip flag

        // ✅ Redirect based on whether user has face registered
        // Give browser time to process the Set-Cookie header
        setTimeout(() => {
          // Redirect check
          // Type check
          // Value check
          
          try {
            // Explicitly check for false value to ensure first-time users go to face registration
            // Make sure we're doing a strict equality check
            if (data.user.hasFace === true) {
              // User already has face registered, go directly to dashboard
              // User has face, redirect to dashboard
              window.location.href = "/pages/dashboard";
            } else if (data.user.hasFace === false) {
              // First-time user, redirect to face registration
              // User needs face registration
              window.location.href = "/signin/face-register";
            } else {
              // Handle any unexpected values
              // Unexpected value, default to registration
              window.location.href = "/signin/face-register";
            }
          } catch (error) {
            console.error("Error during redirect:", error);
            // Fallback redirect - explicitly check for false to ensure face registration for new users
            if (data.user.hasFace === true) {
              window.location.href = "/pages/dashboard";
            } else {
              window.location.href = "/signin/face-register";
            }
          }
        }, 500); // Wait 500ms for cookie to be set
      }
    } catch (error) {
      console.error("Error during OTP verification:", error);
      setStatusMessage("An error occurred while verifying.");
    } finally {
      setVerifying(false);
    }
  };

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only digits
    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (!username) return null; // Changed from email to username

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-purple-100 to-red-100">
      <Header />
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center">
        <div className="w-full max-w-md bg-white/80 p-6 rounded-xl shadow-lg text-center">
          <h1 className="text-2xl font-bold text-[#791010] mb-2">VERIFY</h1>
          <p className="text-sm text-gray-600 mb-6">
            Enter OTP verification code that was sent to your email
          </p>
          
          {timeLeft === 5 * 60 && (
            <p className="text-sm text-green-600 mb-2">
              ✅ OTP has been automatically sent to your email
            </p>
          )}

          <div className="flex justify-center gap-2 mb-4">
            {otpDigits.map((digit, idx) => (
              <input
                key={idx}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                ref={(el) => {
                  inputRefs.current[idx] = el!;
                }}
                className="w-12 h-12 border rounded-lg text-center text-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            ))}
          </div>

          <div className="flex justify-between items-center mb-4">
            {timeLeft > 0 && (
              <span className="text-sm text-gray-500">
                {formatTime(timeLeft)}
              </span>
            )}
            <button
              type="button" // 🛑 prevent form auto-submit
              onClick={handleResendOtp}
              disabled={sending || timeLeft > 0} // Disable resend while timer is active
              className={`text-sm underline disabled:opacity-50 ${
                timeLeft > 0 
                  ? "text-gray-400 cursor-not-allowed" 
                  : "text-purple-700 hover:text-purple-900"
              }`}
            >
              {timeLeft > 0 ? `Resend OTP in ${formatTime(timeLeft)}` : "Resend OTP"}
            </button>
          </div>

          {statusMessage && (
            <p className="text-center text-red-600 mb-4">{statusMessage}</p>
          )}

          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying}
            className="w-full bg-[#791010] text-white py-2 rounded-lg hover:bg-red-800 disabled:opacity-50"
          >
            {verifying ? "Verifying..." : "Confirm"}
          </button>
        </div>
      </div>
      <Footer />
    </main>
  );
}