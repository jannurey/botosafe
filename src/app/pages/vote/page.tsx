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
  const router = useRouter();

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
    if (!electionId || !electionStatus || !electionStatus.hasStarted) return;

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
        "relative min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-red-100 overflow-x-hidden",
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
        className: "object-contain opacity-5",
        priority: true,
      })
    ),

    React.createElement(Header),

    React.createElement(
      "div",
      { className: "relative z-10 max-w-4xl mx-auto p-4" },
      React.createElement(
        "h1",
        { className: "text-2xl font-bold text-center mb-6" },
        "Cast Your Vote"
      ),

      // Candidates Section
      ...Object.keys(groupedCandidates).map((key) => {
        const parts = key.split(":");
        const positionName = parts[1] ?? "Unknown";
        return React.createElement(
          "div",
          { key, className: "mb-6" },
          React.createElement(
            "h2",
            { className: "text-xl font-semibold mb-3" },
            positionName
          ),
          React.createElement(
            "div",
            { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
            ...groupedCandidates[key].map((candidate) =>
              React.createElement(
                "div",
                {
                  key: candidate.id,
                  className: `p-4 border rounded-xl cursor-pointer transition-transform transform hover:scale-105 ${
                    selectedVotes[key] === candidate.id
                      ? "bg-blue-100 border-blue-500"
                      : "hover:bg-gray-100"
                  }`,
                  onClick: () => handleSelect(key, candidate.id),
                },
                React.createElement(Image, {
                  src: candidate.photo_url,
                  alt: candidate.fullname,
                  width: 96,
                  height: 96,
                  className: "object-cover rounded-full mx-auto mb-3",
                }),
                React.createElement(
                  "h3",
                  { className: "text-center font-bold" },
                  candidate.fullname
                ),
                React.createElement(
                  "p",
                  { className: "text-center text-sm text-gray-600" },
                  candidate.description
                )
              )
            )
          )
        );
      }),

      // Submit Button
      React.createElement(
        "button",
        {
          onClick: handleOpenModalWithValidation,
          className:
            "w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl mt-6 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg",
        },
        "Submit Vote"
      ),
      showSelectionError
        ? React.createElement(
            "p",
            { className: "text-red-500 text-center mt-2" },
            "⚠️ Please select at least one candidate for each position."
          )
        : null,

      // Confirmation Modal
      showModal
        ? React.createElement(
            "div",
            {
              className: "fixed inset-0 z-50 flex items-center justify-center",
            },
            React.createElement("div", {
              className: "absolute inset-0 bg-black/50 backdrop-blur-sm",
            }),
            React.createElement(
              "div",
              {
                className:
                  "relative bg-white rounded-2xl shadow-2xl w-11/12 md:w-2/3 max-h-[80vh] p-6 overflow-y-auto z-10",
              },
              React.createElement(
                "h2",
                {
                  className:
                    "text-2xl font-bold mb-4 text-center text-gray-800",
                },
                "Confirm Your Vote"
              ),
              React.createElement(
                "div",
                { className: "space-y-4" },
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
                        "flex items-center gap-4 border rounded-lg p-3 shadow-sm hover:shadow-md transition",
                    },
                    React.createElement(Image, {
                      src: candidate.photo_url,
                      alt: candidate.fullname,
                      width: 56,
                      height: 56,
                      className: "rounded-full object-cover",
                    }),
                    React.createElement(
                      "div",
                      null,
                      React.createElement(
                        "p",
                        { className: "font-semibold text-gray-800" },
                        candidate.fullname
                      ),
                      React.createElement(
                        "p",
                        { className: "text-sm text-gray-500" },
                        positionName
                      )
                    )
                  );
                })
              ),
              React.createElement(
                "div",
                { className: "flex justify-end gap-4 mt-6" },
                React.createElement(
                  "button",
                  {
                    onClick: () => setShowModal(false),
                    className:
                      "px-5 py-2 rounded-xl border border-gray-300 hover:bg-gray-100 transition",
                  },
                  "Cancel"
                ),
                React.createElement(
                  "button",
                  {
                    onClick: handleConfirmVote,
                    className:
                      "px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transition-all",
                  },
                  "Confirm Vote"
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
