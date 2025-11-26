"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PasswordChangeModal from "@/components/PasswordChangeModal";
import Header from "@/components/partials/Header";
import Footer from "@/components/partials/Footer";

const ChangePasswordPage = () => {
  const router = useRouter();
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    // Check if user is required to change password
    const checkPasswordChangeRequirement = async () => {
      try {
        const res = await fetch("/api/check-password-requirement");
        const data = await res.json();
        
        if (data.required && data.userId) {
          setUserId(data.userId);
        } else {
          // If not required, redirect to login
          router.push("/signin/login");
        }
      } catch (error) {
        console.error("Error checking password requirement:", error);
        router.push("/signin/login");
      }
    };

    checkPasswordChangeRequirement();
  }, [router]);

  const handlePasswordChanged = () => {
    // This function is now handled in the PasswordChangeModal component
    // The page will redirect based on the API response
  };

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#791010] mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-white via-purple-100 to-red-100 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
              <h1 className="text-2xl md:text-3xl font-bold text-center text-[#791010] mb-2">
                Password Change Required
              </h1>
              <p className="text-center text-gray-600 mb-8">
                For security reasons, you must change your password on first login.
              </p>
              
              <PasswordChangeModal
                userId={userId}
                onClose={() => router.push("/signin/login")}
                onPasswordChanged={handlePasswordChanged}
              />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default ChangePasswordPage;