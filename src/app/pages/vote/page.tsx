"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/partials/Header";
import Footer from "@/components/partials/Footer";
import Image from "next/image";

type Candidate = {
  id: number;
  fullname: string;
  description: string;
  photo_url: string;
  election_id: number;
  position_id: number;
  position_name: string;
  partylist?: string;
};

type GroupedCandidates = Record<string, Candidate[]>;

type ElectionStatus = {
  election: {
    id: number;
    title: string;
    start_time: string;
    end_time: string;
    filing_start_time?: string;
    filing_end_time?: string;
    status: string;
  };
  hasStarted: boolean;
  hasEnded: boolean;
};

const VotePage: React.FC = () => {
  const [groupedCandidates, setGroupedCandidates] = useState<GroupedCandidates>(
    {}
  );
  const [selectedVotes, setSelectedVotes] = useState<Record<string, number>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [checkingVote, setCheckingVote] = useState(true);
  const [electionId, setElectionId] = useState<number | null>(null);

  // Add effect to log when electionId changes
  useEffect(() => {
    // console.log("ElectionId updated to:", electionId);
  }, [electionId]);

  const [scrollY, setScrollY] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [electionStatus, setElectionStatus] = useState<ElectionStatus | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const router = useRouter();

  // Check for verification error from face scan
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const error = localStorage.getItem("voteVerificationError");
    if (error) {
      setVerificationError(error);
      localStorage.removeItem("voteVerificationError");
      
      // Auto-clear after 8 seconds
      setTimeout(() => {
        setVerificationError(null);
      }, 8000);
    }
  }, []);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      if (typeof window === 'undefined') {
        setIsAuthenticated(false);
        return;
      }
      
      // Add a small delay to ensure any cookies are properly set
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // First check if we have a temporary auth token
      const tempAuthToken = localStorage.getItem("tempAuthToken");
      if (tempAuthToken) {
        try {
          // Decode the temporary token
          const decodedTempToken = JSON.parse(atob(tempAuthToken));
          const exp = decodedTempToken.exp;
          
          // Check if token is still valid
          if (Date.now() < exp) {
            setIsAuthenticated(true);
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
      try {
        const res = await fetch("/api/users/me", {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });
        
        setIsAuthenticated(res.ok);
      } catch (error) {
        console.error("Error checking authentication:", error);
        setIsAuthenticated(false);
      }
    };
    
    checkAuth();
  }, []);

  // 🟣 Fetch latest election
  useEffect(() => {
    const fetchElection = async (): Promise<void> => {
      try {
        const res = await fetch("/api/elections/latest");
        // console.log("Election API response status:", res.status);
        if (!res.ok) throw new Error("Failed to fetch election");
        const election = await res.json();
        // console.log("Election data from API:", election);
        setElectionId(election.id);
        localStorage.setItem("electionId", election.id.toString());
      } catch (error) {
        console.error("Error fetching latest election:", error);
        alert("❌ Failed to fetch latest election.");
        router.replace("/");
      }
    };
    fetchElection();
  }, [router]);

  // 🟡 Check election & user voting status
  useEffect(() => {
    // console.log("Election status check effect triggered with electionId:", electionId);
    if (!electionId) return;

    const checkStatus = async (): Promise<void> => {
      // console.log("Checking election status for electionId:", electionId);
      try {
        // Check if we have an auth token before making requests
        let hasAuthToken = false;
        let userId = null;
        
        // First check if we have a temporary auth token
        const tempAuthToken = localStorage.getItem("tempAuthToken");
        if (tempAuthToken) {
          try {
            // Decode the temporary token
            const decodedTempToken = JSON.parse(atob(tempAuthToken));
            const exp = decodedTempToken.exp;
            
            // Check if token is still valid
            if (Date.now() < exp) {
              hasAuthToken = true;
              userId = decodedTempToken.userId;
            } else {
              // Token expired, clear it
              localStorage.removeItem("tempAuthToken");
            }
          } catch (decodeError) {
            // Invalid token format, clear it
            localStorage.removeItem("tempAuthToken");
          }
        }
        
        // If we don't have a valid temporary token, check regular authentication
        if (!hasAuthToken) {
          try {
            const res = await fetch("/api/users/me", {
              method: "GET",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
              },
            });
            
            hasAuthToken = res.ok;
            if (res.ok) {
              const userData = await res.json();
              userId = userData.user.id;
            }
          } catch (error) {
            console.error("Error checking authentication:", error);
            hasAuthToken = false;
          }
        }

        const electionRes = await fetch(`/api/elections/${electionId}`);
        // console.log("Election detail API response status:", electionRes.status);
        if (!electionRes.ok) {
          // Instead of alert and redirect, we'll set an error state
          setCheckingVote(false);
          return;
        }

        const election = await electionRes.json();
        // console.log("Detailed election data:", election);
        const now = new Date();
        const start = new Date(election.start_time);
        const end = new Date(election.end_time);

        // Store election status instead of redirecting
        setElectionStatus({
          election,
          hasStarted: now >= start,
          hasEnded: now > end
        });

        // Check if election is in filing period
        const filingStart = election.filing_start_time ? new Date(election.filing_start_time) : null;
        const filingEnd = election.filing_end_time ? new Date(election.filing_end_time) : null;
        const isInFilingPeriod = filingStart && filingEnd && now >= filingStart && now <= filingEnd;

        if (isInFilingPeriod && now < start) {
          // Election is in filing period but hasn't started yet
          // console.log("Election is in filing period");
          setCheckingVote(false);
          return;
        }

        if (now < start) {
          // Election hasn't started yet, we'll show a note on the page
          // console.log("Election has not started yet");
          setCheckingVote(false);
          return;
        }
        
        if (now > end) {
          // Election has ended, we'll show a note on the page
          // console.log("Election has ended");
          setCheckingVote(false);
          return;
        }

        // Only check if user has voted if the election is active and user is authenticated
        if (hasAuthToken && userId) {
          const voteRes = await fetch(
            `/api/has-voted?userId=${userId}&electionId=${electionId}`
          );
          // console.log("Has voted API response status:", voteRes.status);
          if (voteRes.ok) {
            const data = await voteRes.json();
            // console.log("Has voted data:", data);
            if (data.hasVoted) {
              // Instead of alert and redirect, we'll set a state
              setHasVoted(true);
              setCheckingVote(false);
              return;
            }
          }
        }
      } catch (error) {
        console.error("Error checking status:", error);
      } finally {
        setCheckingVote(false);
      }
    };

    checkStatus();
  }, [electionId, router]);

  // 🔵 Fetch approved candidates
  useEffect(() => {
    // Only fetch candidates if we have an electionId and the election has started
    if (!electionId || !electionStatus || !electionStatus.hasStarted || electionStatus.hasEnded) return;

    const fetchCandidates = async (): Promise<void> => {
      try {
        const res = await fetch("/api/candidates/approved");
        if (!res.ok) {
          // Handle the case where there are no candidates or the API returns an error
          console.warn("Failed to fetch candidates:", res.status);
          setGroupedCandidates({});
          return;
        }
        const result = await res.json();
        const candidates: Candidate[] = result.candidates || [];
        const latest = candidates.filter((c) => c.election_id === electionId);

        const grouped: GroupedCandidates = {};
        latest.forEach((candidate) => {
          const key = `${candidate.position_id}:${candidate.position_name}`;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(candidate);
        });

        setGroupedCandidates(grouped);
      } catch (error) {
        console.error("Error fetching candidates:", error);
        setGroupedCandidates({}); // Set empty object on error
      } finally {
        setLoading(false);
      }
    };

    fetchCandidates();
  }, [electionId, electionStatus]);

  // 🟢 Scroll animation
  useEffect(() => {
    const handleScroll = (): void => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 🟠 Select candidate
  const handleSelect = (positionKey: string, candidateId: number): void => {
    setSelectedVotes((prev) => ({ ...prev, [positionKey]: candidateId }));
  };

  // 🟣 Open confirmation modal
  const handleOpenModal = (): void => {
    if (Object.keys(selectedVotes).length === 0) {
      // Instead of alert, we could show a message on the page or use a toast notification
      // For now, we'll just return without opening the modal
      return;
    }
    setShowModal(true);
  };

  // Add a state for showing selection error
  const [showSelectionError, setShowSelectionError] = useState(false);
  
  // Update the handleOpenModal to show error
  const handleOpenModalWithValidation = (): void => {
    if (Object.keys(selectedVotes).length === 0) {
      setShowSelectionError(true);
      // Hide error after 3 seconds
      setTimeout(() => setShowSelectionError(false), 3000);
      return;
    }
    setShowSelectionError(false);
    setShowModal(true);
  };

  // 🔒 Confirm vote and save to localStorage
  const handleConfirmVote = (): void => {
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
          const votesForApi: Record<number, number> = {};
          for (const key in selectedVotes) {
            const [positionId] = key.split(":");
            votesForApi[parseInt(positionId)] = selectedVotes[key];
          }

          const payload = { userId, votes: votesForApi };
          localStorage.setItem("pendingVote", JSON.stringify(payload));
          
          // Redirect to face verification page for voting
          router.push("/signin/face-scan-vote");
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
    
    // Regular authentication flow
    fetch("/api/users/me", {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    })
    .then(res => {
      if (!res.ok) {
        throw new Error("Not authenticated");
      }
      return res.json();
    })
    .then(userData => {
      const userId = userData.user.id;
      
      const votesForApi: Record<number, number> = {};
      for (const key in selectedVotes) {
        const [positionId] = key.split(":");
        votesForApi[parseInt(positionId)] = selectedVotes[key];
      }

      const payload = { userId, votes: votesForApi };
      localStorage.setItem("pendingVote", JSON.stringify(payload));
      
      // Redirect to face verification page for voting
      router.push("/signin/face-scan-vote");
    })
    .catch(error => {
      console.error("Authentication error:", error);
      alert("⚠️ You must be logged in to vote.");
      router.push("/signin/login");
    });
  };

  if (checkingVote)
    return React.createElement(
      "div",
      { className: "min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-pink-100 to-red-100" },
      React.createElement(
        "div",
        { className: "text-center p-8 bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg max-w-md w-full mx-4" },
        React.createElement("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-[#791010] mx-auto mb-4" }),
        React.createElement("p", { className: "text-gray-700 font-medium" }, "Checking election status...")
      )
    );
    
  // Show election status messages
  // Check if we're in filing period
  const isInFilingPeriod = electionStatus && 
    electionStatus.election.filing_start_time && 
    electionStatus.election.filing_end_time &&
    new Date() >= new Date(electionStatus.election.filing_start_time) && 
    new Date() <= new Date(electionStatus.election.filing_end_time);
  
  // Check if election has started
  const hasElectionStarted = electionStatus && electionStatus.hasStarted;
  
  // If user is not authenticated, show a message
  if (!isAuthenticated) {
    // console.log("Rendering Not Authenticated message");
    return React.createElement(
      "div",
      { className: "min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-red-100" },
      React.createElement(Header),
      React.createElement(
        "div",
        { className: "flex items-center justify-center pt-8 pb-16" },
        React.createElement(
          "div",
          { className: "text-center p-8 bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg max-w-md w-full mx-4" },
          React.createElement("div", { className: "text-5xl mb-4" }, "🔒"),
          React.createElement("h1", { className: "text-2xl font-bold text-[#791010] mb-2" }, "Authentication Required"),
          React.createElement("p", { className: "text-gray-700 mb-4" }, 
            "You must be logged in to view this page."
          ),
          React.createElement(
            "button",
            {
              onClick: () => window.location.href = "/signin/login",
              className: "mt-4 bg-[#791010] text-white px-6 py-2 rounded-full font-semibold hover:bg-[#5a0c0c] transition"
            },
            "Go to Login"
          )
        )
      )
    );
  }
  
  // Show message if election hasn't started yet
  if (electionStatus && !electionStatus.hasStarted) {
    const now = new Date();
    const startTime = new Date(electionStatus.election.start_time);
    const timeDiff = startTime.getTime() - now.getTime();
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    return React.createElement(
      "div",
      { className: "min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-red-100" },
      React.createElement(Header),
      React.createElement(
        "div",
        { className: "flex items-center justify-center pt-8 pb-16" },
        React.createElement(
          "div",
          { className: "text-center p-8 bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg max-w-md w-full mx-4" },
          React.createElement("div", { className: "text-5xl mb-4" }, "⏰"),
          React.createElement("h1", { className: "text-2xl font-bold text-[#791010] mb-2" }, "Election Not Started"),
          React.createElement("p", { className: "text-gray-700 mb-4" }, 
            "The election will start on:",
            React.createElement("br"),
            React.createElement("strong", null, new Date(electionStatus.election.start_time).toLocaleString())
          ),
          React.createElement("p", { className: "text-gray-600 text-sm" },
            `Time remaining: ${hours} hours and ${minutes} minutes`
          ),
          React.createElement(
            "button",
            {
              onClick: () => router.push("/pages/dashboard"),
              className: "mt-6 bg-[#791010] text-white px-6 py-2 rounded-full font-semibold hover:bg-[#5a0c0c] transition"
            },
            "Back to Dashboard"
          )
        )
      )
    );
  }
  
  if (isInFilingPeriod && !electionStatus.hasStarted) {
    // console.log("Rendering Election In Filing Period message");
    return React.createElement(
      "div",
      { className: "min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-red-100" },
      React.createElement(Header),
      React.createElement(
        "div",
        { className: "flex items-center justify-center pt-8 pb-16" },
        React.createElement(
          "div",
          { className: "text-center p-8 bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg max-w-md w-full mx-4" },
          React.createElement("div", { className: "text-5xl mb-4" }, "📝"),
          React.createElement("h1", { className: "text-2xl font-bold text-[#791010] mb-2" }, "Candidate Filing Period"),
          React.createElement("p", { className: "text-gray-700 mb-4" }, 
            "Candidates are currently being filed for this election."
          ),
          React.createElement("p", { className: "text-gray-600 text-sm mt-2" }, 
            `Voting will begin on ${new Date(electionStatus.election.start_time).toLocaleString()}.`
          )
        )
      )
    );
  }
  
  // Show message if election has ended
  if (electionStatus && electionStatus.hasEnded) {
    // console.log("Rendering Election Ended message");
    return React.createElement(
      "div",
      { className: "min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-red-100" },
      React.createElement(Header),
      React.createElement(
        "div",
        { className: "flex items-center justify-center pt-8 pb-16" },
        React.createElement(
          "div",
          { className: "text-center p-8 bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg max-w-md w-full mx-4" },
          React.createElement("div", { className: "text-5xl mb-4" }, "🏁"),
          React.createElement("h1", { className: "text-2xl font-bold text-[#791010] mb-2" }, "Election Ended"),
          React.createElement("p", { className: "text-gray-700 mb-4" }, 
            `The election "${electionStatus.election.title}" has ended.`
          ),
          React.createElement("p", { className: "text-gray-600 text-sm" }, "Thank you for participating!")
        )
      )
    );
  }

  if (hasVoted) {
    // console.log("Rendering Vote Already Submitted message");
    return React.createElement(
      "div",
      { className: "min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-red-100" },
      React.createElement(Header),
      React.createElement(
        "div",
        { className: "flex items-center justify-center pt-8 pb-16" },
        React.createElement(
          "div",
          { className: "text-center p-8 bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg max-w-md w-full mx-4" },
          React.createElement("div", { className: "text-5xl mb-4" }, "✅"),
          React.createElement("h1", { className: "text-2xl font-bold text-[#791010] mb-2" }, "Vote Already Submitted"),
          React.createElement("p", { className: "text-gray-700 mb-4" }, 
            "You have already voted in this election. Thank you for participating!"
          ),
          React.createElement(
            "button",
            {
              onClick: () => window.location.href = "/pages/dashboard",
              className: "mt-4 bg-[#791010] text-white px-6 py-2 rounded-full font-semibold hover:bg-[#5a0c0c] transition"
            },
            "Go to Dashboard"
          )
        )
      )
    );
  }

  if (loading)
    return React.createElement(
      "div",
      { className: "min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-pink-100 to-red-100" },
      React.createElement(
        "div",
        { className: "text-center p-8 bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg max-w-md w-full mx-4" },
        React.createElement("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-[#791010] mx-auto mb-4" }),
        React.createElement("p", { className: "text-gray-700 font-medium" }, "Loading candidates...")
      )
    );

  // 🧭 Main UI using React.createElement (no JSX)
  return React.createElement(
    "main",
    {
      className:
        "relative min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-red-50",
    },
    // Watermark
    React.createElement(
      "div",
      {
        className:
          "absolute inset-0 flex items-center justify-center pointer-events-none z-0",
        style: { transform: `translateY(${scrollY * 0.2}px)` },
      },
      React.createElement(Image, {
        src: "/images/botosafe-logo.png",
        alt: "Logo Watermark",
        fill: true,
        className: "object-contain opacity-[0.03]",
        priority: true,
      })
    ),

    React.createElement(Header),

    // Floating Verification Error Notification
    verificationError
      ? React.createElement(
          "div",
          { className: "fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4" },
          React.createElement(
            "div",
            { 
              className: "bg-red-500 text-white px-6 py-4 rounded-lg shadow-2xl flex items-start gap-3 animate-bounce",
              style: { animation: "bounce 1s ease-in-out 2" }
            },
            React.createElement(
              "svg",
              { className: "w-6 h-6 flex-shrink-0 mt-0.5", fill: "currentColor", viewBox: "0 0 20 20" },
              React.createElement("path", {
                fillRule: "evenodd",
                d: "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z",
                clipRule: "evenodd"
              })
            ),
            React.createElement(
              "div",
              { className: "flex-1" },
              React.createElement(
                "h3",
                { className: "font-bold text-sm mb-1" },
                "⚠️ Face Verification Failed"
              ),
              React.createElement(
                "p",
                { className: "text-sm" },
                verificationError
              )
            ),
            React.createElement(
              "button",
              {
                onClick: () => setVerificationError(null),
                className: "text-white hover:text-gray-200 transition-colors flex-shrink-0"
              },
              React.createElement(
                "svg",
                { className: "w-5 h-5", fill: "currentColor", viewBox: "0 0 20 20" },
                React.createElement("path", {
                  fillRule: "evenodd",
                  d: "M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z",
                  clipRule: "evenodd"
                })
              )
            )
          )
        )
      : null,

    React.createElement(
      "div",
      { className: "relative z-10 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 pb-20" },
      
      // Page Header - Modern & Clean
      React.createElement(
        "div",
        { className: "mb-8" },
        React.createElement(
          "div",
          { className: "bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden" },
          // Title Section
          React.createElement(
            "div",
            { className: "bg-gradient-to-r from-[#791010] via-[#991515] to-[#b11c1c] p-6" },
            React.createElement(
              "div",
              { className: "flex items-center gap-3 mb-2" },
              React.createElement(
                "div",
                { className: "bg-white/20 backdrop-blur-sm rounded-full p-2.5" },
                React.createElement("div", { className: "text-2xl" }, "🗳️")
              ),
              React.createElement(
                "div",
                null,
                React.createElement(
                  "h1",
                  { className: "text-2xl sm:text-3xl font-bold text-white" },
                  "Cast Your Vote"
                ),
                React.createElement(
                  "p",
                  { className: "text-white/90 text-sm mt-0.5" },
                  electionStatus ? electionStatus.election.title : "Loading..."
                )
              )
            )
          ),
          // Instructions Section
          React.createElement(
            "div",
            { className: "p-5 bg-gradient-to-br from-blue-50 to-indigo-50" },
            React.createElement(
              "div",
              { className: "flex items-start gap-3" },
              React.createElement(
                "div",
                { className: "flex-shrink-0 mt-0.5" },
                React.createElement(
                  "div",
                  { className: "bg-blue-600 text-white rounded-full p-1.5" },
                  React.createElement(
                    "svg",
                    { className: "w-4 h-4", fill: "currentColor", viewBox: "0 0 20 20" },
                    React.createElement("path", {
                      fillRule: "evenodd",
                      d: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z",
                      clipRule: "evenodd"
                    })
                  )
                )
              ),
              React.createElement(
                "div",
                { className: "flex-1" },
                React.createElement(
                  "h3",
                  { className: "text-sm font-semibold text-gray-900 mb-2" },
                  "How to Vote:"
                ),
                React.createElement(
                  "div",
                  { className: "space-y-1.5" },
                  React.createElement(
                    "div",
                    { className: "flex items-start gap-2" },
                    React.createElement(
                      "span",
                      { className: "flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold" },
                      "1"
                    ),
                    React.createElement(
                      "p",
                      { className: "text-sm text-gray-700 leading-relaxed" },
                      "Select one candidate per position by clicking their card"
                    )
                  ),
                  React.createElement(
                    "div",
                    { className: "flex items-start gap-2" },
                    React.createElement(
                      "span",
                      { className: "flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold" },
                      "2"
                    ),
                    React.createElement(
                      "p",
                      { className: "text-sm text-gray-700 leading-relaxed" },
                      "Review your selections in the summary panel"
                    )
                  ),
                  React.createElement(
                    "div",
                    { className: "flex items-start gap-2" },
                    React.createElement(
                      "span",
                      { className: "flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold" },
                      "3"
                    ),
                    React.createElement(
                      "p",
                      { className: "text-sm text-gray-700 leading-relaxed" },
                      "Submit your vote and complete face verification"
                    )
                  )
                )
              )
            )
          )
        )
      ),

      // Candidates Section or Empty State
      ...(Object.keys(groupedCandidates).length === 0
        ? [React.createElement(
            "div",
            { className: "text-center py-20 bg-white rounded-2xl shadow-lg" },
            React.createElement(
              "div",
              { className: "max-w-md mx-auto px-4" },
              React.createElement(
                "div",
                { className: "bg-gradient-to-br from-gray-100 to-gray-200 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4" },
                React.createElement("div", { className: "text-4xl" }, "📋")
              ),
              React.createElement(
                "h2",
                { className: "text-xl font-bold text-gray-800 mb-2" },
                "No Candidates Available"
              ),
              React.createElement(
                "p",
                { className: "text-gray-600 text-sm" },
                "There are no approved candidates for this election yet."
              )
            )
          )]
        : Object.keys(groupedCandidates).map((key) => {
        const parts = key.split(":");
        const positionName = parts[1] ?? "Unknown";
        const positionCandidates = groupedCandidates[key];
        const selectedId = selectedVotes[key];
        
        return React.createElement(
          "div",
          { key, className: "mb-6" },
          
          // Position Card Container
          React.createElement(
            "div",
            { className: "bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100" },
            
            // Position Header - Clean gradient
            React.createElement(
              "div",
              { className: "bg-gradient-to-r from-[#791010] via-[#991515] to-[#b11c1c] p-4" },
              React.createElement(
                "div",
                { className: "flex items-center justify-between" },
                React.createElement(
                  "div",
                  { className: "flex items-center gap-3" },
                  React.createElement(
                    "div",
                    { className: "bg-white/20 backdrop-blur-sm rounded-full w-10 h-10 flex items-center justify-center" },
                    React.createElement("span", { className: "text-lg" }, "👤")
                  ),
                  React.createElement(
                    "div",
                    null,
                    React.createElement(
                      "h2",
                      { className: "text-lg sm:text-xl font-bold text-white" },
                      positionName
                    ),
                    React.createElement(
                      "p",
                      { className: "text-xs text-white/80" },
                      `${positionCandidates.length} candidate${positionCandidates.length !== 1 ? 's' : ''}`
                    )
                  )
                ),
                React.createElement(
                  "div",
                  { className: "text-right" },
                  selectedId
                    ? React.createElement(
                        "div",
                        { className: "bg-green-500 text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5" },
                        React.createElement(
                          "svg",
                          { className: "w-3.5 h-3.5", fill: "currentColor", viewBox: "0 0 20 20" },
                          React.createElement("path", {
                            fillRule: "evenodd",
                            d: "M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z",
                            clipRule: "evenodd"
                          })
                        ),
                        "Selected"
                      )
                    : React.createElement(
                        "div",
                        { className: "bg-amber-500/90 text-white px-3 py-1.5 rounded-full text-xs font-semibold" },
                        "Select One"
                      )
                )
              )
            ),
            
            // Candidates Grid - Professional layout
            React.createElement(
              "div",
              { className: "p-4" },
              React.createElement(
                "div",
                { className: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3" },
                ...positionCandidates.map((candidate) => {
                  const isSelected = selectedId === candidate.id;
                  return React.createElement(
                    "div",
                    {
                      key: candidate.id,
                      className: `group cursor-pointer transition-all duration-300 ${isSelected ? 'scale-[1.02]' : 'hover:scale-[1.02]'}`,
                      onClick: () => handleSelect(key, candidate.id),
                    },
                    React.createElement(
                      "div",
                      {
                        className: `relative rounded-lg overflow-hidden border-2 transition-all duration-300 ${
                          isSelected
                            ? "border-green-500 shadow-lg shadow-green-500/20"
                            : "border-gray-200 hover:border-[#791010] shadow-sm hover:shadow-md"
                        }`,
                      },
                      // Selection Indicator Badge
                      React.createElement(
                        "div",
                        { 
                          className: `absolute top-1.5 right-1.5 z-20 transition-all duration-300 ${
                            isSelected 
                              ? 'scale-100 opacity-100' 
                              : 'scale-0 opacity-0'
                          }`
                        },
                        React.createElement(
                          "div",
                          { className: "bg-green-500 rounded-full p-1 shadow-md" },
                          React.createElement(
                            "svg",
                            { className: "w-3 h-3 text-white", fill: "currentColor", viewBox: "0 0 20 20" },
                            React.createElement("path", {
                              fillRule: "evenodd",
                              d: "M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z",
                              clipRule: "evenodd"
                            })
                          )
                        )
                      ),
                      // Photo Container - Compact
                      React.createElement(
                        "div",
                        { className: "relative aspect-[3/4] bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden" },
                        React.createElement("img", {
                          src: candidate.photo_url || "/images/default-avatar.png",
                          alt: candidate.fullname,
                          className: "w-full h-full object-cover",
                        }),
                        // Partylist Badge - Top Left
                        candidate.partylist
                          ? React.createElement(
                              "div",
                              { className: "absolute top-1.5 left-1.5 z-10" },
                              React.createElement(
                                "div",
                                { className: "bg-[#791010]/90 backdrop-blur-sm text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md border border-white/30" },
                                candidate.partylist
                              )
                            )
                          : null,
                        // Gradient Overlay
                        React.createElement(
                          "div",
                          { 
                            className: `absolute inset-0 bg-gradient-to-t transition-all duration-300 ${
                              isSelected 
                                ? 'from-green-900/70 via-green-900/20 to-transparent'
                                : 'from-black/60 via-black/10 to-transparent group-hover:from-[#791010]/70'
                            }`
                          }
                        ),
                        // Name Overlay on Photo - More Visible
                        React.createElement(
                          "div",
                          { className: "absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent" },
                          React.createElement(
                            "h3",
                            { className: "text-white font-bold text-sm line-clamp-2 drop-shadow-lg" },
                            candidate.fullname
                          )
                        )
                      ),
                      // Action Footer - Compact
                      React.createElement(
                        "div",
                        { 
                          className: `p-1.5 transition-all duration-300 ${
                            isSelected
                              ? 'bg-gradient-to-r from-green-500 to-green-600'
                              : 'bg-gradient-to-r from-gray-50 to-gray-100 group-hover:from-[#791010] group-hover:to-[#b11c1c]'
                          }`
                        },
                        React.createElement(
                          "div",
                          { 
                            className: `text-center font-semibold text-xs transition-colors ${
                              isSelected
                                ? 'text-white'
                                : 'text-gray-700 group-hover:text-white'
                            }`
                          },
                          isSelected ? "✔️ Selected" : "Select"
                        )
                      )
                    )
                  );
                })
              )
            )
          )
        );
      })),

      // Submit Button and Selection Summary
      Object.keys(groupedCandidates).length > 0
        ? React.createElement(
            "div",
            { className: "mt-8 space-y-4" },
            // Live Selection Summary - Modern Design
            Object.keys(selectedVotes).length > 0
              ? React.createElement(
                  "div",
                  { className: "bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden" },
                  React.createElement(
                    "div",
                    { className: "bg-gradient-to-r from-blue-600 to-indigo-600 p-4" },
                    React.createElement(
                      "div",
                      { className: "flex items-center justify-between" },
                      React.createElement(
                        "h3",
                        { className: "text-base font-bold text-white flex items-center gap-2" },
                        React.createElement(
                          "svg",
                          { className: "w-5 h-5", fill: "currentColor", viewBox: "0 0 20 20" },
                          React.createElement("path", {
                            d: "M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"
                          }),
                          React.createElement("path", {
                            fillRule: "evenodd",
                            d: "M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z",
                            clipRule: "evenodd"
                          })
                        ),
                        "Your Selections"
                      ),
                      React.createElement(
                        "span",
                        { 
                          className: `px-3 py-1 rounded-full text-xs font-bold ${
                            Object.keys(selectedVotes).length === Object.keys(groupedCandidates).length
                              ? 'bg-green-500 text-white'
                              : 'bg-white/20 text-white'
                          }`
                        },
                        `${Object.keys(selectedVotes).length}/${Object.keys(groupedCandidates).length}`
                      )
                    )
                  ),
                  React.createElement(
                    "div",
                    { className: "p-4" },
                    React.createElement(
                      "div",
                      { className: "space-y-2" },
                      ...Object.entries(selectedVotes).map(([key, candidateId]) => {
                        const parts = key.split(":");
                        const positionName = parts[1] ?? "Unknown";
                        const candidate = groupedCandidates[key].find(
                          (c) => c.id === candidateId
                        );
                        if (!candidate) return null;
                        return React.createElement(
                          "div",
                          {
                            key: candidate.id,
                            className: "flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl transition-all hover:shadow-md",
                          },
                          React.createElement(
                            "div",
                            { className: "flex-shrink-0" },
                            React.createElement("img", {
                              src: candidate.photo_url || "/images/default-avatar.png",
                              alt: candidate.fullname,
                              className: "w-12 h-12 rounded-full object-cover border-2 border-green-500",
                            })
                          ),
                          React.createElement(
                            "div",
                            { className: "flex-1 min-w-0" },
                            React.createElement(
                              "p",
                              { className: "font-bold text-gray-900 text-sm truncate" },
                              candidate.fullname
                            ),
                            React.createElement(
                              "p",
                              { className: "text-xs text-gray-600 truncate" },
                              positionName
                            )
                          ),
                          React.createElement(
                            "div",
                            { className: "flex-shrink-0" },
                            React.createElement(
                              "div",
                              { className: "bg-green-500 rounded-full p-1.5" },
                              React.createElement(
                                "svg",
                                { className: "w-4 h-4 text-white", fill: "currentColor", viewBox: "0 0 20 20" },
                                React.createElement("path", {
                                  fillRule: "evenodd",
                                  d: "M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z",
                                  clipRule: "evenodd"
                                })
                              )
                            )
                          )
                        );
                      })
                    )
                  )
                )
              : null,
            // Submit Button - Professional Design
            React.createElement(
              "button",
              {
                onClick: handleOpenModalWithValidation,
                disabled: Object.keys(selectedVotes).length !== Object.keys(groupedCandidates).length,
                className: `group relative w-full py-4 rounded-2xl font-bold text-base transition-all duration-300 overflow-hidden ${
                  Object.keys(selectedVotes).length === Object.keys(groupedCandidates).length
                    ? "bg-gradient-to-r from-green-600 via-green-700 to-emerald-700 text-white shadow-xl shadow-green-500/30 hover:shadow-2xl hover:shadow-green-500/40 hover:scale-[1.01]"
                    : "bg-gradient-to-r from-gray-300 to-gray-400 text-gray-600 cursor-not-allowed shadow-md"
                }`,
              },
              React.createElement(
                "div",
                { className: "relative z-10 flex items-center justify-center gap-3" },
                React.createElement(
                  "svg",
                  { className: "w-6 h-6", fill: "currentColor", viewBox: "0 0 20 20" },
                  React.createElement("path", {
                    fillRule: "evenodd",
                    d: "M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",
                    clipRule: "evenodd"
                  })
                ),
                React.createElement(
                  "span",
                  null,
                  Object.keys(selectedVotes).length === Object.keys(groupedCandidates).length
                    ? "Submit Your Vote"
                    : "Please Select All Positions"
                )
              ),
              Object.keys(selectedVotes).length === Object.keys(groupedCandidates).length
                ? React.createElement(
                    "div",
                    { className: "absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" }
                  )
                : null
            )
          )
        : null,

      // Confirmation Modal - Modern Design
      showModal
        ? React.createElement(
            "div",
            {
              className: "fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm",
            },
            React.createElement("div", {
              className: "absolute inset-0 bg-black/70",
              onClick: () => setShowModal(false),
            }),
            React.createElement(
              "div",
              {
                className:
                  "relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden z-10 border border-gray-200",
              },
              // Modal Header
              React.createElement(
                "div",
                {
                  className:
                    "bg-gradient-to-r from-[#791010] via-[#991515] to-[#b11c1c] p-5 sticky top-0 z-10",
                },
                React.createElement(
                  "div",
                  { className: "flex items-center justify-between mb-2" },
                  React.createElement(
                    "div",
                    { className: "flex items-center gap-3" },
                    React.createElement(
                      "div",
                      { className: "bg-white/20 backdrop-blur-sm rounded-full p-2" },
                      React.createElement(
                        "svg",
                        { className: "w-6 h-6 text-white", fill: "currentColor", viewBox: "0 0 20 20" },
                        React.createElement("path", {
                          fillRule: "evenodd",
                          d: "M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z",
                          clipRule: "evenodd"
                        })
                      )
                    ),
                    React.createElement(
                      "h2",
                      {
                        className:
                          "text-xl font-bold text-white",
                      },
                      "Confirm Your Vote"
                    )
                  ),
                  React.createElement(
                    "button",
                    {
                      onClick: () => setShowModal(false),
                      className:
                        "text-white/80 hover:text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition-all",
                    },
                    React.createElement(
                      "svg",
                      { className: "w-5 h-5", fill: "currentColor", viewBox: "0 0 20 20" },
                      React.createElement("path", {
                        fillRule: "evenodd",
                        d: "M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z",
                        clipRule: "evenodd"
                      })
                    )
                  )
                ),
                React.createElement(
                  "p",
                  { className: "text-white/90 text-sm" },
                  "Review your selections carefully. You cannot change your vote after submission."
                )
              ),
              // Modal Content
              React.createElement(
                "div",
                { className: "p-5 overflow-y-auto max-h-[calc(85vh-200px)]" },
                React.createElement(
                  "div",
                  { className: "space-y-3" },
                  ...Object.entries(selectedVotes).map(([key, candidateId]) => {
                    const parts = key.split(":");
                    const positionName = parts[1] ?? "Unknown";
                    const candidate = groupedCandidates[key].find(
                      (c) => c.id === candidateId
                    );
                    if (!candidate) return null;
                    return React.createElement(
                      "div",
                      {
                        key: candidate.id,
                        className:
                          "flex items-center gap-4 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow",
                      },
                      React.createElement(
                        "div",
                        { className: "flex-shrink-0" },
                        React.createElement("img", {
                          src: candidate.photo_url,
                          alt: candidate.fullname,
                          className: "w-16 h-16 rounded-full object-cover border-3 border-[#791010] shadow-lg",
                        })
                      ),
                      React.createElement(
                        "div",
                        { className: "flex-1 min-w-0" },
                        React.createElement(
                          "p",
                          { className: "font-bold text-gray-900 text-base truncate" },
                          candidate.fullname
                        ),
                        React.createElement(
                          "p",
                          { className: "text-sm text-gray-600 truncate" },
                          positionName
                        )
                      ),
                      React.createElement(
                        "div",
                        { className: "flex-shrink-0" },
                        React.createElement(
                          "div",
                          { className: "bg-green-500 rounded-full p-2" },
                          React.createElement(
                            "svg",
                            { className: "w-5 h-5 text-white", fill: "currentColor", viewBox: "0 0 20 20" },
                            React.createElement("path", {
                              fillRule: "evenodd",
                              d: "M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z",
                              clipRule: "evenodd"
                            })
                          )
                        )
                      )
                    );
                  })
                ),
                React.createElement(
                  "div",
                  { className: "mt-5 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl" },
                  React.createElement(
                    "div",
                    { className: "flex items-start gap-3" },
                    React.createElement(
                      "div",
                      { className: "flex-shrink-0 mt-0.5" },
                      React.createElement(
                        "svg",
                        { className: "w-5 h-5 text-amber-600", fill: "currentColor", viewBox: "0 0 20 20" },
                        React.createElement("path", {
                          fillRule: "evenodd",
                          d: "M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z",
                          clipRule: "evenodd"
                        })
                      )
                    ),
                    React.createElement(
                      "div",
                      { className: "flex-1" },
                      React.createElement(
                        "h4",
                        { className: "text-sm font-bold text-amber-900 mb-1" },
                        "Important Notice"
                      ),
                      React.createElement(
                        "p",
                        { className: "text-xs text-amber-800" },
                        "You will be redirected to face verification to complete and secure your vote."
                      )
                    )
                  )
                )
              ),
              // Modal Footer
              React.createElement(
                "div",
                { className: "p-5 bg-gradient-to-r from-gray-50 to-white border-t border-gray-200 sticky bottom-0" },
                React.createElement(
                  "div",
                  { className: "flex gap-3" },
                  React.createElement(
                    "button",
                    {
                      onClick: () => setShowModal(false),
                      className:
                        "flex-1 px-5 py-3 rounded-xl border-2 border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-100 hover:border-gray-400 transition-all",
                    },
                    "Cancel"
                  ),
                  React.createElement(
                    "button",
                    {
                      onClick: handleConfirmVote,
                      className:
                        "flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-700 text-white text-sm font-bold hover:from-green-700 hover:to-emerald-800 transition-all shadow-lg shadow-green-500/30 hover:shadow-xl flex items-center justify-center gap-2",
                    },
                    React.createElement(
                      "svg",
                      { className: "w-4 h-4", fill: "currentColor", viewBox: "0 0 20 20" },
                      React.createElement("path", {
                        fillRule: "evenodd",
                        d: "M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z",
                        clipRule: "evenodd"
                      })
                    ),
                    "Confirm Vote"
                  )
                )
              )
            )
          )
        : null
    ),
    React.createElement(Footer)
  );
};

export default VotePage;
