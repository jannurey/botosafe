"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/partials/Header";
import Footer from "@/components/partials/Footer";

export default function VerifyOtpVotePage() {
  const router = useRouter();
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [statusMessage, setStatusMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(5 * 60); // 5 minutes
  const [electionId, setElectionId] = useState<number | null>(null);
  const inputRefs = useRef<HTMLInputElement[]>([]);
  const otpSentRef = useRef(false); // Prevent duplicate OTP sends
  const mountedRef = useRef(false); // Track if component is mounted

  const sendOtp = async () => {
    // Prevent duplicate sends - check both ref and sessionStorage
    const sessionKey = "vote_otp_sent";
    if (sending || otpSentRef.current || sessionStorage.getItem(sessionKey)) {
      console.log("🚫 OTP send blocked - already sent or sending");
      return;
    }
    
    // Mark as sending immediately to prevent race conditions
    otpSentRef.current = true;
    sessionStorage.setItem(sessionKey, "true");
    setSending(true);
    setStatusMessage("");

    try {
      const res = await fetch("/api/vote/send-otp", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        setStatusMessage(data.error || "Failed to send OTP.");
        otpSentRef.current = false; // Allow retry on error
        sessionStorage.removeItem(sessionKey);
      } else {
        setStatusMessage("✅ OTP sent to your email. Please check your inbox.");
        setTimeLeft(5 * 60); // Reset timer
        // Keep otpSentRef.current = true and sessionStorage to prevent duplicate sends
      }
    } catch (error) {
      setStatusMessage("❌ An error occurred while sending OTP.");
      otpSentRef.current = false; // Allow retry on error
      sessionStorage.removeItem(sessionKey);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    // Prevent double execution in React Strict Mode
    if (mountedRef.current) {
      console.log("🚫 Component already mounted, skipping OTP send");
      return;
    }
    mountedRef.current = true;

    // Check for pending vote
    const pendingVote = localStorage.getItem("pendingVote");
    const storedElectionId = localStorage.getItem("electionId");
    
    if (!pendingVote) {
      setStatusMessage("❌ No pending vote found. Redirecting...");
      setTimeout(() => router.push("/pages/vote"), 2000);
      return;
    }

    if (storedElectionId) {
      setElectionId(Number(storedElectionId));
    }

    // Auto-send OTP when page loads (only once)
    sendOtp();

    // Auto-focus first OTP input
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);

    // Cleanup function
    return () => {
      // Don't reset mountedRef on unmount to prevent re-sending if component remounts
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleVerify = async () => {
    setVerifying(true);
    setStatusMessage("");
    const otp = otpDigits.join("");

    if (otp.length !== 6) {
      setStatusMessage("❌ Please enter a complete 6-digit OTP.");
      setVerifying(false);
      return;
    }

    try {
      // Verify OTP and get vote token
      const verifyRes = await fetch("/api/vote/verify-otp", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp, electionId }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.voteToken) {
        setStatusMessage(verifyData.error || "Invalid or expired OTP.");
        setVerifying(false);
        return;
      }

      // Get pending vote from localStorage
      const pendingVote = localStorage.getItem("pendingVote");
      if (!pendingVote) {
        setStatusMessage("❌ No vote data found. Redirecting...");
        setTimeout(() => router.push("/pages/vote"), 2000);
        return;
      }

      const votePayload = JSON.parse(pendingVote);
      const votesForApi: Record<number, number> = {};
      
      // Convert votes format: position_id -> candidate_id
      for (const key in votePayload.votes) {
        const positionId = parseInt(key);
        if (!isNaN(positionId)) {
          votesForApi[positionId] = votePayload.votes[key];
        }
      }

      // Submit vote with vote token
      const voteRes = await fetch("/api/vote", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          votes: votesForApi,
          voteToken: verifyData.voteToken,
        }),
      });

      const voteData = await voteRes.json();
      if (!voteRes.ok) {
        setStatusMessage(voteData.error || "Failed to submit vote.");
        setVerifying(false);
        return;
      }

      // Vote successful!
      setStatusMessage("✅ Vote submitted successfully!");
      
      // Clear pending vote data
      localStorage.removeItem("pendingVote");
      localStorage.removeItem("electionId");
      localStorage.removeItem("candidateList");

      // Redirect to success page or dashboard
      setTimeout(() => {
        router.push("/pages/dashboard");
      }, 2000);
    } catch (error) {
      console.error("Error during vote verification:", error);
      setStatusMessage("❌ An error occurred. Please try again.");
      setVerifying(false);
    }
  };

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
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
    if (e.key === "Enter" && otpDigits.every(d => d !== "")) {
      handleVerify();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-purple-100 to-red-100">
      <Header />
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4">
        <div className="w-full max-w-md bg-white/80 backdrop-blur-lg p-6 rounded-xl shadow-lg text-center">
          <h1 className="text-2xl font-bold text-[#791010] mb-2">Verify Your Vote</h1>
          <p className="text-sm text-gray-600 mb-6">
            Enter the OTP code sent to your email to confirm your vote
          </p>
          
          {statusMessage && (
            <div className={`mb-4 p-3 rounded-lg ${
              statusMessage.includes("✅") 
                ? "bg-green-100 text-green-700 border border-green-300"
                : statusMessage.includes("❌")
                ? "bg-red-100 text-red-700 border border-red-300"
                : "bg-blue-100 text-blue-700 border border-blue-300"
            }`}>
              <p className="text-sm">{statusMessage}</p>
            </div>
          )}

          <div className="flex justify-center gap-2 mb-4">
            {otpDigits.map((digit, idx) => (
              <input
                key={idx}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                ref={(el) => {
                  inputRefs.current[idx] = el!;
                }}
                className="w-12 h-12 border-2 border-gray-300 rounded-lg text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[#791010] focus:border-[#791010]"
              />
            ))}
          </div>

          <div className="flex justify-between items-center mb-4">
            {timeLeft > 0 && (
              <span className="text-sm text-gray-500">
                Expires in: {formatTime(timeLeft)}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                otpSentRef.current = false; // Reset flag to allow resend
                sessionStorage.removeItem("vote_otp_sent"); // Clear sessionStorage
                sendOtp();
              }}
              disabled={sending || timeLeft > 0}
              className={`text-sm underline disabled:opacity-50 ${
                timeLeft > 0 
                  ? "text-gray-400 cursor-not-allowed" 
                  : "text-[#791010] hover:text-red-800"
              }`}
            >
              {sending ? "Sending..." : timeLeft > 0 ? `Resend in ${formatTime(timeLeft)}` : "Resend OTP"}
            </button>
          </div>

          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying || otpDigits.some(d => !d)}
            className="w-full bg-[#791010] text-white py-3 rounded-lg hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
          >
            {verifying ? "Verifying & Submitting Vote..." : "Confirm Vote"}
          </button>
        </div>
      </div>
      <Footer />
    </main>
  );
}

