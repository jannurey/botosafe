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

interface ResultData {
  candidate_id: number;
  position_id: number;
  position_name: string;
  candidate_name: string;
  vote_count: number;
}

interface ResultsResponse {
  election: { id: number; title: string; status: string } | null;
  results: ResultData[];
  turnout: any[];
}

const Home: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [electionData, setElectionData] = useState<ElectionData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [results, setResults] = useState<ResultData[] | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [electionStatus, setElectionStatus] = useState<string | null>(null);

  // Function to calculate time remaining / status label for authenticated users
  const calculateTimeRemaining = (startTime: string, endTime?: string) => {
    const now = new Date().getTime();
    const start = new Date(startTime).getTime();
    const end = endTime ? new Date(endTime).getTime() : undefined;

    // If we have an end time and it's already passed, the election has ended
    if (end && now > end) {
      return "Election has ended.";
    }

    const difference = start - now;

    if (difference <= 0) {
      // Started but not yet ended
      return "Election has started!";
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor(
      (difference % (1000 * 60 * 60)) / (1000 * 60)
    );

    return `${days} days, ${hours} hours, ${minutes} minutes`;
  };

  // Fetch latest election status for unauthenticated users
  useEffect(() => {
    if (!isAuthenticated) {
      const fetchElectionStatus = async () => {
        try {
          const res = await fetch("/api/elections/latest");
          if (res.ok) {
            const data = await res.json();
            setElectionStatus(data.status);
          }
        } catch (error) {
          console.error("Error fetching election status:", error);
        }
      };

      fetchElectionStatus();
    }
  }, [isAuthenticated]);

  // Get messages based on election status
  const getMessages = () => {
    const baseMessages = [
      {
        title: "Secure Student Voting Platform",
        subtitle: "Log in to access your account",
        button: "🔐 Log In",
        link: "/signin/login"
      }
    ];

    // Add election status specific message
    if (electionStatus === "closed") {
      baseMessages.push({
        title: "Election Has Ended",
        subtitle: "You can find the results below",
        button: "View Results",
        link: "#results"
      });
    } else if (electionStatus === "ongoing") {
      baseMessages.push({
        title: "Election Is Ongoing",
        subtitle: "Log in to cast your vote",
        button: "🔐 Log In",
        link: "/signin/login"
      });
    } else if (electionStatus === "upcoming") {
      baseMessages.push({
        title: "Election Not Yet Started",
        subtitle: "Check back later for voting",
        button: "🔐 Log In",
        link: "/signin/login"
      });
    }

    return baseMessages;
  };

  // Rotate messages every 5 seconds
  useEffect(() => {
    const messages = getMessages();
    if (messages.length > 1) {
      const interval = setInterval(() => {
        setCurrentMessageIndex(prev => (prev + 1) % messages.length);
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [electionStatus]);

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

  useEffect(() => {
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
            setTimeRemaining(calculateTimeRemaining(data.start_time, data.end_time));
          }
        } catch (error) {
          console.error("Error fetching election data:", error);
        }
      };

      fetchElectionData();

      // Update time remaining every minute
      const interval = setInterval(() => {
        if (electionData) {
          setTimeRemaining(
            calculateTimeRemaining(electionData.start_time, electionData.end_time)
          );
        }
      }, 60000);

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, electionData]);

  // Fetch results when election is closed (used for both unauthenticated and authenticated views)
  useEffect(() => {
    const fetchResults = async () => {
      setResultsLoading(true);
      try {
        const res = await fetch("/api/results");
        if (res.ok) {
          const data: ResultsResponse = await res.json();
          // Only show results if election is closed
          if (data.election?.status === "closed") {
            setResults(data.results);
          } else {
            // If election is not closed, explicitly set results to empty array
            setResults([]);
          }
        } else {
          // If API returns error, set results to empty array
          setResults([]);
        }
      } catch (error) {
        console.error("Error fetching results:", error);
        // On error, set results to empty array
        setResults([]);
      } finally {
        setResultsLoading(false);
      }
    };

    fetchResults();
  }, []);

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
        <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-purple-100 via-pink-100 to-red-100 px-4 py-20">
          <h1 className="text-6xl sm:text-7xl font-extrabold mb-6 text-center">
            <span className="text-[#791010]">Boto</span>
            <span className="text-black">Safe</span>
          </h1>

          <p className="text-lg sm:text-xl max-w-2xl mb-10 text-gray-700 text-center">
            Welcome back! You&apos;re logged in and ready to participate in the election.
          </p>

          <div className="bg-white/80 backdrop-blur-md py-6 px-8 rounded-2xl shadow-xl mb-6 border border-white/40 text-center">
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

          <div className="mt-8 text-gray-600 max-w-2xl text-center">
            <p className="mb-4">
              Check the candidates and prepare for voting when the election begins.
            </p>
            <p>
              Visit your dashboard to see your voting status and election information.
            </p>
          </div>

          {/* Election Results Section for Authenticated Users (when election is closed) */}
          <div id="results" className="w-full max-w-5xl mt-12">
            {!resultsLoading && results && results.length > 0 && electionData?.status === "closed" && (
              <div className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-xl p-6 border border-red-200 mb-12">
                <h2 className="text-3xl font-bold text-[#791010] text-center mb-8">
                  🎉 Election Results
                </h2>

                <div className="overflow-x-auto">
                  {(() => {
                    // Group results by position
                    const positions: Record<string, ResultData[]> = {};
                    results.forEach((result) => {
                      if (!positions[result.position_name]) {
                        positions[result.position_name] = [];
                      }
                      positions[result.position_name].push(result);
                    });

                    // Sort positions and candidates
                    Object.keys(positions).forEach((position) => {
                      positions[position].sort(
                        (a, b) => b.vote_count - a.vote_count
                      );
                    });

                    return (
                      <div className="space-y-8">
                        {Object.entries(positions).map(
                          ([positionName, candidates]) => (
                            <div
                              key={positionName}
                              className="border-b border-gray-200 pb-6 last:border-0 last:pb-0"
                            >
                              <h3 className="text-2xl font-bold text-gray-800 mb-4">
                                {positionName}
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {candidates.map((candidate, index) => (
                                  <div
                                    key={candidate.candidate_id}
                                    className={`bg-gradient-to-r rounded-xl p-4 shadow-md ${
                                      index === 0
                                        ? "from-yellow-100 to-yellow-50 border-2 border-yellow-300"
                                        : index === 1
                                        ? "from-gray-100 to-gray-50 border-2 border-gray-300"
                                        : index === 2
                                        ? "from-amber-100 to-amber-50 border-2 border-amber-300"
                                        : "bg-white border border-gray-200"
                                    }`}
                                  >
                                    <div className="flex justify-between items-center">
                                      <div>
                                        <h4 className="font-bold text-lg text-gray-800">
                                          {candidate.candidate_name}
                                        </h4>
                                        {index === 0 && (
                                          <span className="inline-block bg-yellow-500 text-white text-xs px-2 py-1 rounded-full mt-1">
                                            🏆 Winner
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <div className="text-2xl font-bold text-[#791010]">
                                          {candidate.vote_count}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          votes
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="mt-8 text-center">
                  <p className="text-gray-600">
                    These results are from the most recently concluded election.
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Visit your dashboard to see more detailed election information and analytics.
                  </p>
                </div>
              </div>
            )}

            {resultsLoading && (
              <div className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-xl p-6 border border-red-200 mb-12 text-center">
                <p className="text-gray-700">Loading election results...</p>
              </div>
            )}
          </div>
        </div>
      </MainLayout>
    );
  }

  // Show login content for unauthenticated users
  return (
    <MainLayout>
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-red-100 px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center justify-center text-center mb-12">
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
                {getMessages()[currentMessageIndex]?.title || "Secure Student Voting Platform"}
              </p>
              <h2 className="text-2xl font-bold text-[#791010] mb-4">
                {getMessages()[currentMessageIndex]?.subtitle || "Log in to access your account"}
              </h2>
              {getMessages()[currentMessageIndex]?.link === "#results" ? (
                <button 
                  className="bg-gradient-to-r from-[#791010] to-[#b11c1c] text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 shadow-lg transition duration-300"
                  onClick={() => {
                    const resultsElement = document.getElementById("results");
                    if (resultsElement) {
                      resultsElement.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                >
                  {getMessages()[currentMessageIndex]?.button || "View Results"}
                </button>
              ) : (
                <Link href={getMessages()[currentMessageIndex]?.link || "/signin/login"}>
                  <button className="bg-gradient-to-r from-[#791010] to-[#b11c1c] text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 shadow-lg transition duration-300">
                    {getMessages()[currentMessageIndex]?.button || "🔐 Log In"}
                  </button>
                </Link>
              )}
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

          {/* Added id for scrolling to results */}
          <div id="results">
            {/* Election Results Section for Unauthenticated Users */}
            {!isAuthenticated && !resultsLoading && results && results.length > 0 && (
              <div className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-xl p-6 border border-red-200 mb-12">
                <h2 className="text-3xl font-bold text-[#791010] text-center mb-8">
                  🎉 Election Results
                </h2>
                
                <div className="overflow-x-auto">
                  {(() => {
                    // Group results by position
                    const positions: Record<string, ResultData[]> = {};
                    results.forEach(result => {
                      if (!positions[result.position_name]) {
                        positions[result.position_name] = [];
                      }
                      positions[result.position_name].push(result);
                    });

                    // Sort positions and candidates
                    Object.keys(positions).forEach(position => {
                      positions[position].sort((a, b) => b.vote_count - a.vote_count);
                    });

                    return (
                      <div className="space-y-8">
                        {Object.entries(positions).map(([positionName, candidates]) => (
                          <div key={positionName} className="border-b border-gray-200 pb-6 last:border-0 last:pb-0">
                            <h3 className="text-2xl font-bold text-gray-800 mb-4">{positionName}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {candidates.map((candidate, index) => (
                                <div 
                                  key={candidate.candidate_id} 
                                  className={`bg-gradient-to-r rounded-xl p-4 shadow-md ${
                                    index === 0 
                                      ? 'from-yellow-100 to-yellow-50 border-2 border-yellow-300' 
                                      : index === 1 
                                      ? 'from-gray-100 to-gray-50 border-2 border-gray-300' 
                                      : index === 2 
                                      ? 'from-amber-100 to-amber-50 border-2 border-amber-300' 
                                      : 'bg-white border border-gray-200'
                                  }`}
                                >
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <h4 className="font-bold text-lg text-gray-800">
                                        {candidate.candidate_name}
                                      </h4>
                                      {index === 0 && (
                                        <span className="inline-block bg-yellow-500 text-white text-xs px-2 py-1 rounded-full mt-1">
                                          🏆 Winner
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <div className="text-2xl font-bold text-[#791010]">
                                        {candidate.vote_count}
                                      </div>
                                      <div className="text-xs text-gray-500">votes</div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                
                <div className="mt-8 text-center">
                  <p className="text-gray-600">
                    These results are from the most recently concluded election.
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Log in to access your dashboard and view more detailed election information.
                  </p>
                </div>
              </div>
            )}

            {resultsLoading && (
              <div className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-xl p-6 border border-red-200 mb-12 text-center">
                <p className="text-gray-700">Loading election results...</p>
              </div>
            )}

            {!isAuthenticated && !resultsLoading && results && results.length === 0 && (
              <div className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-xl p-6 border border-red-200 mb-12 text-center">
                <h3 className="text-xl font-bold text-gray-800 mb-2">No Election Results Available</h3>
                <p className="text-gray-600">
                  Results from concluded elections will be displayed here after voting has ended.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Home;