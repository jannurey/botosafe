"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import Header from "@/components/partials/Header";
import Footer from "@/components/partials/Footer";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const LoginPage = () => {
  const router = useRouter();

  const [username, setUsername] = useState(""); // Changed from email to username
  const [password, setPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // 👁 toggle state

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }), // Changed from email to username
        credentials: "include", // Include cookies in the request and response
      });

      const data = await res.json();
      // Login API response received
      if (!res.ok) {
        setStatusMessage(data.message || "Login failed");
      } else {
        // Don't save user ID to localStorage anymore - rely on cookies
        // localStorage.setItem("userId", data.userId.toString());
        // localStorage.setItem("userRole", data.role);
        
        // Clear any existing temp login flags
        localStorage.removeItem("tempLogin");
        localStorage.removeItem("tempUserId");
        localStorage.removeItem("userId");
        localStorage.removeItem("userRole");
        
        if (data.role === "admin") {
          // Admins go directly to admin dashboard
          window.location.href = "/admin/dashboard";
        } else if (data.otpRequired) {
          // For voters, go to OTP verification
          localStorage.setItem("username", username); // Save username for OTP page
          // Don't check face registration here - that happens after OTP verification
          window.location.href = "/signin/verify-otp";
        } else {
          // This path should not be reached with our updated logic, but keeping it for safety
          localStorage.setItem("username", username); // Save username for OTP page
          window.location.href = "/signin/verify-otp";
        }
      }
    } catch (error) {
      setStatusMessage("An unexpected error occurred. Please try again.");
      console.error("Login error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Header />
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-white via-[#FEEBF6] to-[#FFD4D4] overflow-x-hidden transition-all px-4 py-20">
        {/* Bubbles */}
        <div className="absolute top-0 left-0 h-60 w-60 rounded-full bg-red-200/30 blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-purple-200/30 blur-3xl animate-pulse" />

        {/* Login Form Card */}
        <div className="relative z-10 w-full max-w-md space-y-6 rounded-xl border border-red-200 bg-white/70 p-8 shadow-xl backdrop-blur-lg">
          <div className="flex items-center justify-center space-x-2 text-[#791010]">
            <h1 className="text-2xl font-bold">BotoSafe Log In</h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-[#791010]"
              >
                Student ID
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={clsx(
                  "mt-1 w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-[#791010]",
                  "focus:border-[#791010] focus:outline-none focus:ring-1 focus:ring-[#791010]"
                )}
                required
                placeholder="Enter your Student ID"
              />
            </div>

            <div className="relative">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[#791010]"
              >
                Password
              </label>
              <input
                id="password"
                type={showPassword ? "text" : "password"} // 👁 toggle
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={clsx(
                  "mt-1 w-full rounded-md border border-red-200 bg-white px-3 py-2 pr-10 text-sm text-[#791010]",
                  "focus:border-[#791010] focus:outline-none focus:ring-1 focus:ring-[#791010]"
                )}
                required
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-[#791010] hover:text-[#9B1B1B] focus:outline-none"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            {statusMessage && (
              <p className="text-center text-sm text-red-600">
                {statusMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full transform rounded-md bg-gradient-to-r from-[#791010] to-[#9B1B1B] px-4 py-2 text-white transition hover:scale-105 hover:shadow-md disabled:opacity-60"
            >
              {isSubmitting ? "Logging in..." : "Log In"}
            </button>
          </form>
          <p className="text-center text-sm text-[#791010]">
            <a
              href="/signin/login/forgot-password"
              className="underline hover:text-[#9B1B1B]"
            >
              Forgot Password?
            </a>
          </p>

          <div className="text-center text-sm text-[#791010]">
            <p>Contact your administrator if you need assistance with your credentials.</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default LoginPage;