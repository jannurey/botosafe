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
import { ArrowLeft, ArrowRight, TrendingUp, Users, Award, Info } from "lucide-react";
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
  const [showInfo, setShowInfo] = useState<boolean>(false);
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
        <div className="max-w-6xl mx-auto px-4 py-8 w-full flex-grow">
          {/* Welcome Section */}
          <div className="text-center mb-6">
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 mb-2">
              👋 Welcome, {user.fullname}!
            </h1>
            <p className="text-gray-600">
              Here are the live election results updated in real-time
            </p>
          </div>
          
          <div className="flex items-center justify-center mb-4">
            <div className="bg-white/90 backdrop-blur-lg rounded-full px-4 py-2 shadow-md border border-gray-200">
              <h2 className="text-xl md:text-2xl font-bold text-center text-gray-800">
                📊 {election ? election.title : 'Election Results'}
              </h2>
            </div>
          </div>

          {!election ? (
            <div className="text-center py-12 bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg p-8">
              <div className="mb-4 text-6xl">🗓️</div>
              <p className="text-xl font-semibold text-gray-700 mb-2">
                No Active Election
              </p>
              <p className="text-gray-500">
                There are no elections scheduled at this time. Check back later!
              </p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-3 bg-white/90 backdrop-blur-lg rounded-full px-6 py-3 shadow-md border border-gray-200">
                  <span
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm ${
                      election.status === "ongoing"
                        ? "bg-red-100 text-red-700 animate-pulse"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {election.status === "ongoing" ? (
                      <>
                        <span className="inline-block w-2 h-2 bg-red-600 rounded-full animate-ping"></span>
                        <span className="inline-block w-2 h-2 bg-red-600 rounded-full absolute"></span>
                        LIVE NOW
                      </>
                    ) : (
                      "CLOSED"
                    )}
                  </span>
                  {election.status === "ongoing" && (
                    <p className="text-sm text-gray-600">
                      Auto-updates every 10 seconds
                    </p>
                  )}
                </div>
              </div>

              {positions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mb-4 text-6xl">📊</div>
                  <p className="text-xl font-semibold text-gray-700 mb-2">
                    No votes yet!
                  </p>
                  <p className="text-gray-500">
                    Results will appear here as people vote.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-6">
                  {/* Info Section */}
                  <div className="w-full bg-blue-50 border border-blue-200 rounded-xl p-4 mb-2">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-blue-900 mb-1">How to Read This Dashboard</h3>
                        <p className="text-sm text-blue-700">
                          Each chart shows one position (like President, Vice President, etc.). 
                          The <span className="font-semibold">longer bars</span> mean <span className="font-semibold">more votes</span>. 
                          The candidate with the <span className="font-semibold">longest bar is currently winning</span> that position!
                        </p>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const position = positions[currentIndex];
                    const candidates = grouped[position];
                    
                    // Sort candidates by vote count (descending) to show leader first
                    const sortedCandidates = [...candidates].sort((a, b) => b.vote_count - a.vote_count);
                    const leader = sortedCandidates[0];
                    const totalVotes = sortedCandidates.reduce((sum, c) => sum + c.vote_count, 0);

                    const data = {
                      labels: sortedCandidates.map((r) => r.candidate_name),
                      datasets: [
                        {
                          label: "Votes",
                          data: sortedCandidates.map((r) => r.vote_count),
                          backgroundColor: sortedCandidates.map(
                            (_, idx) =>
                              idx === 0 
                                ? "#16a34a" // Green for leader
                                : `hsl(${210 + idx * 30}, 60%, 55%)` // Blue shades for others
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
                      <>
                        {/* Summary Cards */}
                        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          {/* Current Leader Card */}
                          <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-xl p-4 shadow-md">
                            <div className="flex items-center gap-2 mb-2">
                              <Award className="w-5 h-5 text-green-600" />
                              <h3 className="font-semibold text-green-900 text-sm">Currently Leading</h3>
                            </div>
                            <p className="text-2xl font-bold text-green-800 truncate" title={leader.candidate_name}>
                              {leader.candidate_name}
                            </p>
                            <p className="text-sm text-green-600 mt-1">
                              {leader.vote_count} {leader.vote_count === 1 ? 'vote' : 'votes'}
                            </p>
                          </div>

                          {/* Total Votes Card */}
                          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-xl p-4 shadow-md">
                            <div className="flex items-center gap-2 mb-2">
                              <Users className="w-5 h-5 text-blue-600" />
                              <h3 className="font-semibold text-blue-900 text-sm">Total Votes Cast</h3>
                            </div>
                            <p className="text-2xl font-bold text-blue-800">
                              {totalVotes}
                            </p>
                            <p className="text-sm text-blue-600 mt-1">
                              for this position
                            </p>
                          </div>

                          {/* Number of Candidates Card */}
                          <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-xl p-4 shadow-md">
                            <div className="flex items-center gap-2 mb-2">
                              <TrendingUp className="w-5 h-5 text-purple-600" />
                              <h3 className="font-semibold text-purple-900 text-sm">Candidates Running</h3>
                            </div>
                            <p className="text-2xl font-bold text-purple-800">
                              {sortedCandidates.length}
                            </p>
                            <p className="text-sm text-purple-600 mt-1">
                              competing for {position}
                            </p>
                          </div>
                        </div>

                        {/* Chart Section */}
                        <motion.div
                          key={position}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4 }}
                          className="bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow-md border border-gray-100 hover:shadow-xl transition-all w-full"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <button
                              onClick={handlePrev}
                              className="flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-gray-200 to-gray-100 hover:from-pink-100 hover:to-purple-100 shadow-sm text-gray-700 font-medium hover:text-red-600 transition-all duration-200 text-sm md:text-base"
                            >
                              <ArrowLeft className="w-4 h-4" />
                              <span className="hidden sm:inline">Previous</span>
                            </button>

                            <h2 className="text-lg md:text-xl font-bold text-red-800 tracking-wide uppercase text-center flex-1">
                              {position}
                            </h2>

                            <button
                              onClick={handleNext}
                              className="flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-gray-200 to-gray-100 hover:from-pink-100 hover:to-purple-100 shadow-sm text-gray-700 font-medium hover:text-red-600 transition-all duration-200 text-sm md:text-base"
                            >
                              <span className="hidden sm:inline">Next</span>
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="h-[280px] sm:h-[320px] md:h-[350px]">
                            <Bar data={data} options={options} />
                          </div>
                          
                          {/* Simple Text Explanation */}
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <p className="text-sm text-gray-600 text-center">
                              <span className="inline-block w-3 h-3 bg-green-500 rounded mr-1"></span>
                              <span className="font-semibold text-green-700">Green bar</span> shows the leader. 
                              Longer bars = more votes!
                            </p>
                          </div>
                        </motion.div>

                        {/* Detailed Results List */}
                        <div className="w-full bg-white/80 backdrop-blur-lg rounded-xl shadow-md border border-gray-100 p-6">
                          <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">
                            📋 Detailed Results for {position}
                          </h3>
                          <div className="space-y-3">
                            {sortedCandidates.map((candidate, idx) => {
                              const percentage = totalVotes > 0 ? ((candidate.vote_count / totalVotes) * 100).toFixed(1) : 0;
                              return (
                                <div 
                                  key={candidate.candidate_id}
                                  className={`p-4 rounded-lg border-2 ${
                                    idx === 0 
                                      ? 'bg-green-50 border-green-300' 
                                      : 'bg-gray-50 border-gray-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                      <div className={`text-2xl font-bold ${
                                        idx === 0 ? 'text-green-600' : 'text-gray-400'
                                      }`}>
                                        #{idx + 1}
                                      </div>
                                      <div>
                                        <p className="font-semibold text-gray-800 text-lg">
                                          {candidate.candidate_name}
                                          {idx === 0 && <span className="ml-2 text-green-600">👑</span>}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                          {percentage}% of votes
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-3xl font-bold text-gray-800">
                                        {candidate.vote_count}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {candidate.vote_count === 1 ? 'vote' : 'votes'}
                                      </p>
                                    </div>
                                  </div>
                                  {/* Visual progress bar */}
                                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                    <div 
                                      className={`h-full transition-all duration-500 ${
                                        idx === 0 ? 'bg-green-500' : 'bg-blue-400'
                                      }`}
                                      style={{ width: `${percentage}%` }}
                                    ></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  <div className="w-full text-center">
                    <p className="text-gray-600 text-sm mb-2">
                      Viewing position {currentIndex + 1} of {positions.length}
                    </p>
                    <p className="text-xs text-gray-500">
                      Use the Previous/Next buttons above to see other positions
                    </p>
                  </div>
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
