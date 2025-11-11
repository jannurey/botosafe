"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import Header from "@/components/partials/Header";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const LoginPage = () => {
  const router = useRouter();

  const [email, setEmail] = useState("");
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
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatusMessage(data.message || "Login failed.");
      } else {
<<<<<<< HEAD
        // ✅ Save user info
        localStorage.setItem("email", email);
        localStorage.setItem("userId", data.userId);
        localStorage.setItem("role", data.role);

        // ✅ Redirect based on role
        if (data.role === "admin") {
          router.push("/admin/dashboard");
        } else {
          router.push("/signin/verify-otp");
=======
        // ✅ Save user info (email and userId will be used by OTP step)
        localStorage.setItem("email", email);
        if (data.userId) localStorage.setItem("userId", String(data.userId));
        if (data.role) localStorage.setItem("role", data.role);

        // If server requires OTP, go to verify-otp regardless of role
        if (data.otpRequired) {
          router.push("/signin/verify-otp");
          return;
        }

        // Otherwise, user is fully authenticated server-side; decide based on role
        if (data.role === "admin") {
          router.push("/admin/dashboard");
        } else {
          router.push("/"); // or the app's logged-in landing
>>>>>>> d425447 (Initial commit)
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Header />
<<<<<<< HEAD
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-white via-purple-100 to-red-100 px-4 py-20">
=======
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-white via-[#FEEBF6] to-[#FFD4D4] overflow-x-hidden transition-all px-4 py-20">
>>>>>>> d425447 (Initial commit)
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
                htmlFor="email"
                className="block text-sm font-medium text-[#791010]"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={clsx(
                  "mt-1 w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-[#791010]",
                  "focus:border-[#791010] focus:outline-none focus:ring-1 focus:ring-[#791010]"
                )}
                required
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
<<<<<<< HEAD
=======
          <p className="text-center text-sm text-[#791010]">
            <a
              href="/signin/login/forgot-password"
              className="underline hover:text-[#9B1B1B]"
            >
              Forgot Password?
            </a>
          </p>
>>>>>>> d425447 (Initial commit)

          <p className="text-center text-sm text-[#791010]">
            Don&apos;t have an account?{" "}
            <a href="/signin" className="underline hover:text-[#9B1B1B]">
              Sign Up
            </a>
          </p>
        </div>
      </main>
    </>
  );
};

export default LoginPage;
