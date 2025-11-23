"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import Header from "@/components/partials/Header";

const ResetPasswordPage = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  // token is provided by the dynamic route segment [token]
  // fallback: if someone still uses ?token= in the query, use that
  const routeToken = Array.isArray(params?.token)
    ? params.token[0]
    : params?.token;
  const token = (routeToken as string) || searchParams?.get("token") || "";

  // email comes via query param (we keep it as query to avoid exposing it in the path)
  const email = searchParams?.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // toggles to show/hide typed passwords
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!token || !email) {
      setStatus({ type: "error", message: "Invalid or missing reset token." });
    }
  }, [token, email]);

  // password rules derived from current `password` state
  const passwordRules = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    specialChar: /[\W_]/.test(password),
  };
  const allPasswordRulesMet = Object.values(passwordRules).every(Boolean);
  const passwordsMatch = confirm.trim() !== "" && password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (!allPasswordRulesMet) {
      return setStatus({
        type: "error",
        message:
          "Your password does not meet all requirements. Please update it.",
      });
    }

    if (!passwordsMatch) {
      return setStatus({ type: "error", message: "Passwords do not match." });
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({
          type: "error",
          message: data?.message || "Failed to reset password.",
        });
      } else {
        setStatus({
          type: "success",
          message: "Password reset successfully. Redirecting to login...",
        });
        setTimeout(() => router.push("/signin/login"), 3000);
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
            Reset Password
          </h1>
          <p className="text-center text-sm text-[#791010]">
            Set a new password for {email || "your account"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <label className="block text-sm font-medium text-[#791010]">
                New Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-red-200 bg-white px-3 py-2 pr-10 text-sm text-[#791010] focus:border-[#791010] focus:outline-none"
                aria-describedby="password-rules"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-9 text-[#791010] hover:text-[#9B1B1B] focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-[#791010]">
                Confirm Password
              </label>
              <input
                type={showConfirm ? "text" : "password"}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-md border border-red-200 bg-white px-3 py-2 pr-10 text-sm text-[#791010] focus:border-[#791010] focus:outline-none"
                aria-invalid={confirm !== "" && !passwordsMatch}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute right-3 top-9 text-[#791010] hover:text-[#9B1B1B] focus:outline-none"
                aria-label={
                  showConfirm
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
              >
                {showConfirm ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            {/* Password rules */}
            <div id="password-rules" className="text-sm mt-2">
              <p className="font-semibold text-gray-700 dark:text-gray-900 mb-1">
                Password must include:
              </p>
              <ul className="space-y-1">
                {Object.entries(passwordRules).map(([key, valid]) => (
                  <li
                    key={key}
                    className={valid ? "text-green-600" : "text-red-500"}
                  >
                    {valid ? "✔" : "✖"}{" "}
                    {key === "length"
                      ? "At least 8 characters"
                      : key === "uppercase"
                      ? "One uppercase letter"
                      : key === "lowercase"
                      ? "One lowercase letter"
                      : key === "number"
                      ? "One number"
                      : "One special character"}
                  </li>
                ))}
              </ul>
            </div>

            {/* passwords match indicator */}
            <div className="text-sm mt-1">
              <p
                className={`text-center ${
                  confirm === ""
                    ? "text-gray-600"
                    : passwordsMatch
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {confirm === ""
                  ? "Please confirm your password."
                  : passwordsMatch
                  ? "Passwords match."
                  : "Passwords do not match."}
              </p>
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
              disabled={
                isSubmitting ||
                !token ||
                !email ||
                !allPasswordRulesMet ||
                !passwordsMatch
              }
              className="w-full transform rounded-md bg-gradient-to-r from-[#791010] to-[#9B1B1B] px-4 py-2 text-white transition hover:scale-105 disabled:opacity-60"
            >
              {isSubmitting ? "Resetting..." : "Reset password"}
            </button>
          </form>

          <p className="text-center text-sm text-[#791010]">
            Back to{" "}
            <a href="/signin/login" className="underline hover:text-[#9B1B1B]">
              Log in
            </a>
          </p>
        </div>
      </main>
    </>
  );
};

export default ResetPasswordPage;