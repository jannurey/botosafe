"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import MainLayout from "@/components/layout/MainLayout";

interface ElectionData {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
}

const Home: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [electionData, setElectionData] = useState<ElectionData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  // Function to calculate time remaining
  const calculateTimeRemaining = (startTime: string) => {
    const start = new Date(startTime).getTime();
    const now = new Date().getTime();
    const difference = start - now;

    if (difference <= 0) {
      return "Election has started!";
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

    return `${days} days, ${hours} hours, ${minutes} minutes`;
  };

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      try {
        // Check for temporary login first
        const tempLogin = localStorage.getItem("tempLogin");
        if (tempLogin === "true") {
          const userId = localStorage.getItem("userId");
          if (userId) {
            setIsAuthenticated(true);
            setIsLoading(false);
            return;
          }
        }

        // Try to authenticate - don't check cookies on client side
        // because authToken is httpOnly and can't be read by JavaScript
        const res = await fetch("/api/users/me", {
          method: "GET",
          credentials: "include",
        });

        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          // Clear user state on 401/404
          if (res.status === 401 || res.status === 404) {
            setIsAuthenticated(false);
          } else {
            console.error("Error fetching user:", res.status, res.statusText);
            setIsAuthenticated(false);
          }
        }
      } catch (err) {
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Fetch election data for authenticated users
  useEffect(() => {
    if (isAuthenticated) {
      const fetchElectionData = async () => {
        try {
          const res = await fetch("/api/elections/latest");
          if (res.ok) {
            const data = await res.json();
            setElectionData(data);
            setTimeRemaining(calculateTimeRemaining(data.start_time));
          }
        } catch (error) {
          console.error("Error fetching election data:", error);
        }
      };

      fetchElectionData();

      // Update time remaining every minute
      const interval = setInterval(() => {
        if (electionData) {
          setTimeRemaining(calculateTimeRemaining(electionData.start_time));
        }
      }, 60000);

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, electionData]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-purple-100 to-red-100">
          <p className="text-lg text-gray-700">Loading...</p>
        </div>
      </MainLayout>
    );
  }

  if (isAuthenticated) {
    // Show content for authenticated users
    return (
      <MainLayout>
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-100 via-pink-100 to-red-100 px-4 py-20 text-center">
          <h1 className="text-6xl sm:text-7xl font-extrabold mb-6">
            <span className="text-[#791010]">Boto</span>
            <span className="text-black">Safe</span>
          </h1>

          <p className="text-lg sm:text-xl max-w-2xl mb-10 text-gray-700">
            Welcome back! You&apos;re logged in and ready to participate in the election.
          </p>

          <div className="bg-white/80 backdrop-blur-md py-6 px-8 rounded-2xl shadow-xl mb-6 border border-white/40">
            <p className="text-sm text-gray-800 uppercase mb-2">
              Election Status
            </p>
            <h2 className="text-2xl font-bold text-[#791010] mb-4">
              Election starts in: {timeRemaining || "Loading..."}
            </h2>
            <Link href="/pages/dashboard">
              <button className="bg-gradient-to-r from-[#791010] to-[#b11c1c] text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 shadow-lg transition duration-300">
                Go to Dashboard
              </button>
            </Link>
          </div>

          <div className="mt-8 text-gray-600 max-w-2xl">
            <p className="mb-4">
              Check the candidates and prepare for voting when the election begins.
            </p>
            <p>
              Visit your dashboard to see your voting status and election information.
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Show login content for unauthenticated users
  return (
    <MainLayout>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-100 via-pink-100 to-red-100 px-4 py-20 text-center">
        <h1 className="text-6xl sm:text-7xl font-extrabold mb-6">
          <span className="text-[#791010]">Boto</span>
          <span className="text-black">Safe</span>
        </h1>

        <p className="text-lg sm:text-xl max-w-2xl mb-10 text-gray-700">
          Your all-in-one student voting platform—secure, smart, and
          stress-free.
        </p>

        <div className="bg-white/80 backdrop-blur-md py-6 px-8 rounded-2xl shadow-xl mb-6 border border-white/40">
          <p className="text-sm text-gray-800 uppercase mb-2">
            Secure Student Voting Platform
          </p>
          <h2 className="text-2xl font-bold text-[#791010] mb-4">
            Log in to access your account
          </h2>
          <Link href="/signin/login">
            <button className="bg-gradient-to-r from-[#791010] to-[#b11c1c] text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 shadow-lg transition duration-300">
              🔐 Log In
            </button>
          </Link>
        </div>

        <div className="mt-8 text-gray-600 max-w-2xl">
          <p className="mb-4">
            Students can log in using their Student ID and the password provided by the administrator.
          </p>
          <p>
            Contact your administrator if you need assistance with your credentials.
          </p>
        </div>
      </div>
    </MainLayout>
  );
};

export default Home;