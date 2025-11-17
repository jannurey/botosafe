"use client";

import React, { useEffect, useState } from "react";
import Header from "@/components/partials/Header";
import Footer from "@/components/partials/Footer";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

type Result = {
  candidate_id: number;
  position_id: number;
  position_name: string;
  candidate_name: string;
  vote_count: number;
};

type Election = {
  id: number;
  title: string;
  status: string; // "ongoing" | "closed"
};

type ResultsAPIResponse = {
  election: Election | null;
  results: Result[];
};

type User = {
  id: number;
  fullname: string;
};

export default function DashboardPage(): React.ReactElement {
  const [results, setResults] = useState<Result[]>([]);
  const [election, setElection] = useState<Election | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check for temporary auth token first
        const tempAuthToken = localStorage.getItem("tempAuthToken");
        if (tempAuthToken) {
          try {
            // Decode the temporary token
            const decodedTempToken = JSON.parse(atob(tempAuthToken));
            const userId = decodedTempToken.userId;
            const exp = decodedTempToken.exp;
            
            // Check if token is still valid
            if (Date.now() < exp && userId) {
              // Use temporary authentication
              const res = await fetch("/api/users/me", {
                method: "GET",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                  "x-temp-login": "true",
                  "x-user-id": userId.toString(),
                },
              });

              if (!res.ok) {
                // Clear invalid temp token
                localStorage.removeItem("tempAuthToken");
                router.push("/signin/login?returnTo=/pages/dashboard");
                return;
              }

              const data: { user: User } = await res.json();
              if (!data || !data.user) {
                // Clear invalid temp token
                localStorage.removeItem("tempAuthToken");
                router.push("/signin/login?returnTo=/pages/dashboard");
                return;
              }
              setUser(data.user);
              return;
            } else {
              // Token expired, clear it
              localStorage.removeItem("tempAuthToken");
            }
          } catch (decodeError) {
            // Invalid token format, clear it
            localStorage.removeItem("tempAuthToken");
          }
        }
        
        // For regular authentication, we don't check the cookie directly since it's HttpOnly
        // Instead, we just try to fetch the user data
        const res = await fetch("/api/users/me", {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          router.push("/signin/login?returnTo=/pages/dashboard");
          return;
        }

        const data: { user: User } = await res.json();
        if (!data || !data.user) {
          router.push("/signin/login?returnTo=/pages/dashboard");
          return;
        }
        setUser(data.user);
      } catch (err) {
        router.push("/signin/login?returnTo=/pages/dashboard");
      }
    };

    checkAuth();
  }, [router]);

  const fetchResults = async (): Promise<void> => {
    try {
      const res = await fetch("/api/results");
      if (!res.ok) throw new Error("Failed to fetch results");
      const data: ResultsAPIResponse = await res.json();
      setElection(data.election);
      setResults(data.results);
    } catch (error) {
      console.error("Error fetching results:", error);
      setElection(null);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch results if user is authenticated
    if (user) {
      fetchResults();
      const interval = setInterval(() => {
        if (election?.status === "ongoing") fetchResults();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [election?.status, user]);

  const grouped: Record<string, Result[]> = results.reduce(
    (acc: Record<string, Result[]>, row) => {
      if (!acc[row.position_name]) acc[row.position_name] = [];
      acc[row.position_name].push(row);
      return acc;
    },
    {}
  );

  const positions: string[] = Object.keys(grouped);

  const handleNext = (): void => {
    setCurrentIndex((prev) => (prev + 1) % positions.length);
  };

  const handlePrev = (): void => {
    setCurrentIndex((prev) => (prev === 0 ? positions.length - 1 : prev - 1));
  };

  // Show loading while checking auth
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-purple-100">
        <div className="text-center p-8 bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg max-w-md w-full mx-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#791010] mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-purple-100">
        <div className="text-center p-8 bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg max-w-md w-full mx-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#791010] mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Loading live results...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen w-full bg-gradient-to-br from-pink-50 via-white to-purple-100 flex flex-col">
        <div className="max-w-5xl mx-auto px-4 py-8 w-full flex-grow">
          <h1 className="text-3xl md:text-4xl font-extrabold text-center mb-6 text-gray-800">
            📊 Live Election Results
          </h1>

          {!election ? (
            <p className="text-center text-gray-600 mt-6">No election found.</p>
          ) : (
            <>
              <div className="text-center mb-6">
                <p className="text-gray-700 font-medium text-lg">
                  {election.title}
                  <span
                    className={`ml-2 px-4 py-1 rounded-full text-sm font-semibold shadow-sm ${
                      election.status === "ongoing"
                        ? "bg-red-100 text-red-700"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {election.status === "ongoing" ? "Ongoing 🔴" : "Closed"}
                  </span>
                </p>
              </div>

              {positions.length === 0 ? (
                <p className="text-center text-gray-500">
                  No results available yet.
                </p>
              ) : (
                <div className="flex flex-col items-center gap-6">
                  {(() => {
                    const position = positions[currentIndex];
                    const candidates = grouped[position];

                    const data = {
                      labels: candidates.map((r) => r.candidate_name),
                      datasets: [
                        {
                          label: "Votes",
                          data: candidates.map((r) => r.vote_count),
                          backgroundColor: candidates.map(
                            (_, idx) =>
                              `hsl(${
                                (idx / candidates.length) * 360
                              }, 70%, 55%)`
                          ),
                          borderRadius: 8,
                        },
                      ],
                    };

                    const options = {
                      indexAxis: "y" as const,
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          backgroundColor: "#fff",
                          titleColor: "#111827",
                          bodyColor: "#374151",
                          borderColor: "#e5e7eb",
                          borderWidth: 1,
                          padding: 10,
                          titleFont: { weight: "bold" as const },
                        },
                      },
                      scales: {
                        x: {
                          beginAtZero: true,
                          ticks: {
                            color: "#4B5563",
                            stepSize: 1,
                            precision: 0,
                            font: { size: 12 },
                          },
                          grid: { color: "#e5e7eb" },
                        },
                        y: {
                          ticks: { color: "#374151", font: { size: 12 } },
                          grid: { display: false },
                        },
                      },
                    };

                    return (
                      <motion.div
                        key={position}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow-md border border-gray-100 hover:shadow-xl transition-all w-full"
                        style={{ height: "340px" }}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <button
                            onClick={handlePrev}
                            className="flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-gray-200 to-gray-100 hover:from-pink-100 hover:to-purple-100 shadow-sm text-gray-700 font-medium hover:text-red-600 transition-all duration-200 text-sm md:text-base"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            Previous
                          </button>

                          <h2 className="text-lg md:text-xl font-bold text-red-800 tracking-wide uppercase text-center flex-1">
                            {position}
                          </h2>

                          <button
                            onClick={handleNext}
                            className="flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-gray-200 to-gray-100 hover:from-pink-100 hover:to-purple-100 shadow-sm text-gray-700 font-medium hover:text-red-600 transition-all duration-200 text-sm md:text-base"
                          >
                            Next
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="h-[250px] sm:h-[280px] md:h-[300px]">
                          <Bar data={data} options={options} />
                        </div>
                      </motion.div>
                    );
                  })()}

                  <p className="text-gray-600 text-sm mt-2 text-center">
                    Showing {currentIndex + 1} of {positions.length} positions
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
