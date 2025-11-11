// app/signin/login/forgot-password/page.tsx
"use client";

import React, { useState } from "react";
import Header from "@/components/partials/Header";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({
          type: "error",
          message: data?.message || "Unable to send reset link.",
        });
      } else {
        setStatus({
          type: "success",
          message: data?.message || "Reset link sent to your email.",
        });
      }
    } catch (err) {
      setStatus({ type: "error", message: "Network error." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Header />
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-white via-[#FEEBF6] to-[#FFD4D4] px-4 py-20">
        <div className="relative z-10 w-full max-w-md space-y-6 rounded-xl border border-red-200 bg-white/70 p-8 shadow-xl backdrop-blur-lg">
          <h1 className="text-center text-2xl font-bold text-[#791010]">
            Forgot Password
          </h1>
          <p className="text-center text-sm text-[#791010]">
            Enter your email and we'll send a link to reset your password.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-[#791010] focus:border-[#791010] focus:outline-none"
              />
            </div>

            {status && (
              <p
                className={`text-center text-sm ${
                  status.type === "error" ? "text-red-600" : "text-green-600"
                }`}
              >
                {status.message}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full transform rounded-md bg-gradient-to-r from-[#791010] to-[#9B1B1B] px-4 py-2 text-white transition hover:scale-105 disabled:opacity-60"
            >
              {isSubmitting ? "Sending..." : "Send reset link"}
            </button>
          </form>

          <p className="text-center text-sm text-[#791010]">
            Remembered?{" "}
            <a href="/signin/login" className="underline hover:text-[#9B1B1B]">
              Log in
            </a>
          </p>
        </div>
      </main>
    </>
  );
};

export default ForgotPasswordPage;
