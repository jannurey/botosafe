"use client";

import React, { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";

interface PasswordChangeModalProps {
  userId: number;
  onClose: () => void;
  onPasswordChanged: () => void;
}

const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({ 
  userId, 
  onClose,
  onPasswordChanged
}) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Password rules
  const passwordRules = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    specialChar: /[\W_]/.test(password),
  };
  const allPasswordRulesMet = Object.values(passwordRules).every(Boolean);
  const passwordsMatch = password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!allPasswordRulesMet) {
      setError("Password does not meet all requirements.");
      return;
    }
    
    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Update user's password through the dedicated change-password API
      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data?.message || "Failed to update password");
      }
      
      setSuccess(true);
      
      // Wait a moment then notify parent
      setTimeout(() => {
        onPasswordChanged();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Change Password</h2>
        <p className="text-sm text-gray-600 mb-4">
          You must change your password on first login for security reasons.
        </p>
        
        {success ? (
          <div className="text-center py-4">
            <p className="text-green-600 font-medium">Password changed successfully!</p>
            <p className="text-sm text-gray-600 mt-2">Redirecting...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-[#791010] focus:outline-none focus:ring-1 focus:ring-[#791010]"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-[#791010] focus:outline-none focus:ring-1 focus:ring-[#791010]"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-9 text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            {/* Password rules */}
            <div className="text-sm">
              <p className="font-semibold text-gray-700 mb-1">
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

            {/* Password match indicator */}
            <div className="text-sm">
              <p
                className={`text-center ${
                  confirmPassword === ""
                    ? "text-gray-600"
                    : passwordsMatch
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {confirmPassword === ""
                  ? "Please confirm your password."
                  : passwordsMatch
                  ? "Passwords match."
                  : "Passwords do not match."}
              </p>
            </div>

            {error && (
              <p className="text-red-600 text-sm text-center">{error}</p>
            )}

            <div className="flex space-x-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !allPasswordRulesMet || !passwordsMatch}
                className="flex-1 bg-[#791010] text-white py-2 px-4 rounded-md hover:bg-[#9B1B1B] disabled:opacity-50"
              >
                {isSubmitting ? "Changing..." : "Change Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default PasswordChangeModal;