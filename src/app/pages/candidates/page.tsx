"use client";

import React, { useEffect, useState, useRef } from "react";
import Header from "@/components/partials/Header";
import Footer from "@/components/partials/Footer";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

// --- Types ---
type Election = {
  id: number;
  title: string;
  status: string;
  start_time: string;
};
type Candidate = {
  id: number;
  user_id: number;
  election_id: number;
  election_title: string;
  position_id: number;
  position_name: string;
  achievements: Achievement[];
  photo_url: string;
  partylist: string;
  coc_file_url: string;
  status: string;
  fullname: string;
};
type Position = { id: number; name: string };

type Achievement = {
  title: string;
  type: string;
};

export default function CandidatesPage() {
  // --- state ---
  const router = useRouter();
  const [user, setUser] = useState<{ id: number; fullname: string } | null>(
    null
  );
  const [latestElection, setLatestElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [isFilingModalOpen, setIsFilingModalOpen] = useState(false);

  // form fields
  const [selectedPositionId, setSelectedPositionId] = useState("");
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [partylist, setPartylist] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [cocFile, setCocFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string>("");

  const [alreadyFiled, setAlreadyFiled] = useState(false);

  const modalRef = useRef<HTMLDivElement | null>(null);

  const [showHelpModal, setShowHelpModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(
    null
  );

  // Add partylists state
  const [partylists, setPartylists] = useState<{ id: number; name: string }[]>([]);
  const [selectedPartylistId, setSelectedPartylistId] = useState("");
  const [partylistInput, setPartylistInput] = useState(""); // For custom partylist input

  // --- focus trap for modal ---
  useEffect(() => {
    if (!isFilingModalOpen) return;
    const handleFocus = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !modalRef.current) return;
      const focusableEls = modalRef.current.querySelectorAll<
        | HTMLButtonElement
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
      >("button, [href], input, select, textarea");
      const firstEl = focusableEls[0];
      const lastEl = focusableEls[focusableEls.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        (lastEl as HTMLElement).focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        (firstEl as HTMLElement).focus();
      }
    };
    document.addEventListener("keydown", handleFocus);
    return () => document.removeEventListener("keydown", handleFocus);
  }, [isFilingModalOpen]);

  // --- data fetching ---
  useEffect(() => {
    const fetchUserData = async () => {
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

              if (res.ok) {
                const data = await res.json();
                setUser(data.user);
                return;
              } else {
                // Clear invalid temp token
                localStorage.removeItem("tempAuthToken");
              }
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
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          // If not authenticated, redirect to login
          router.push("/signin/login?returnTo=/pages/candidates");
        }
      } catch (error) {
        // If there's an error, redirect to login
        router.push("/signin/login?returnTo=/pages/candidates");
      }
    };

    fetchUserData();
  }, [router]);

  useEffect(() => {
    fetch("/api/elections")
      .then((res) => res.json())
      .then((data: Election[]) => {
        const ongoing = data.filter((e) => e.status !== "ended");
        if (ongoing.length > 0) {
          const latest = ongoing.reduce((prev, curr) =>
            new Date(prev.start_time) > new Date(curr.start_time) ? prev : curr
          );
          setLatestElection(latest);
        }
      });
  }, []);

  useEffect(() => {
    fetch("/api/positions")
      .then((res) => res.json())
      .then((data) => setPositions(data));
  }, []);

  useEffect(() => {
    if (!latestElection) return;
    fetch("/api/candidates")
      .then((res) => res.json())
      .then((data: Candidate[]) => {
        // Fetched candidates
        setCandidates(
          data.filter(
            (c) =>
              c.status === "approved" && c.election_id === latestElection.id
          )
        );
        // Filtered candidates

        if (user) {
          const filed = data.some(
            (c) => c.user_id === user.id && c.election_id === latestElection.id
          );
          setAlreadyFiled(filed);
        }
      });
  }, [latestElection, user]);

  // Fetch partylists when latest election changes
  useEffect(() => {
    if (!latestElection) return;
    
    const fetchPartylists = async () => {
      try {
        const res = await fetch(`/api/partylists?election_id=${latestElection.id}`);
        if (res.ok) {
          const data = await res.json();
          setPartylists(data);
        }
      } catch (error) {
        console.error("Error fetching partylists:", error);
      }
    };

    fetchPartylists();
  }, [latestElection]);

  // --- small CSS injected for pulse + card gradient ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes pulse-slow {
        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,193,7,0.12); }
        50% { transform: scale(1.02); box-shadow: 0 0 12px 6px rgba(255,193,7,0.10); }
        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,193,7,0); }
      }
      .pulse-pending { animation: pulse-slow 1.6s infinite ease-in-out; }
      .card-gradient { background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,240,240,0.7)); border: 1px solid rgba(151,16,16,0.08); }
      /* Custom scrollbar for modal - more specific selector */
      .modal-content .custom-scrollbar::-webkit-scrollbar {
        width: 8px;
      }
      .modal-content .custom-scrollbar::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, #b11c1c, #791010);
        border-radius: 6px;
      }
      .animate-fadeIn {
        animation: fadeIn 0.25s ease-in-out;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.97); }
        to { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
    return () => void document.head.removeChild(style);
  }, []);

  // --- group candidates ---
  const candidatesByPosition = candidates.reduce(
    (acc: Record<string, Candidate[]>, candidate) => {
      if (!acc[candidate.position_name]) acc[candidate.position_name] = [];
      acc[candidate.position_name].push(candidate);
      return acc;
    },
    {}
  );

  const filteredCandidatesByPosition = Object.fromEntries(
    Object.entries(candidatesByPosition).map(([pos, cands]) => [
      pos,
      cands.filter(
        (c) =>
          c.fullname.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.election_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.position_name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    ])
  );

  // --- file candidacy ---
  const handleFile = async () => {
    if (
      !latestElection ||
      !selectedPositionId ||
      !photoFile ||
      !cocFile ||
      !user
    ) {
      setFormError("All fields are required except achievements!");
      return;
    }

    setFormError("");
    setLoading(true);

    try {
      const photoForm = new FormData();
      photoForm.append("file", photoFile);
      const photoRes = await fetch("/api/upload", {
        method: "POST",
        body: photoForm,
      });
      if (!photoRes.ok) {
        const errorData = await photoRes.json();
        throw new Error(errorData.error || "Photo upload failed");
      }
      const photoData = await photoRes.json();

      const cocForm = new FormData();
      cocForm.append("file", cocFile);
      const cocRes = await fetch("/api/upload", {
        method: "POST",
        body: cocForm,
      });
      if (!cocRes.ok) {
        const errorData = await cocRes.json();
        throw new Error(errorData.error || "CoC upload failed");
      }
      const cocData = await cocRes.json();

      // Determine the partylist value
      let finalPartylist = "";
      if (partylists.length > 0) {
        if (selectedPartylistId === "independent") {
          finalPartylist = "Independent";
        } else if (selectedPartylistId === "custom") {
          finalPartylist = partylistInput;
        } else {
          // Find the selected partylist name
          const selectedPartylist = partylists.find(
            (p) => p.id.toString() === selectedPartylistId
          );
          finalPartylist = selectedPartylist ? selectedPartylist.name : "";
        }
      } else {
        finalPartylist = partylist;
      }

      const formData = new FormData();
      formData.append("election_id", latestElection.id.toString());
      formData.append("position_id", selectedPositionId);
      formData.append("partylist", finalPartylist);
      formData.append("photo_url", photoData.url);
      formData.append("coc_file_url", cocData.url);
      formData.append("achievements", JSON.stringify(achievements));

      const res = await fetch("/api/candidates", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setIsFilingModalOpen(false);
        setSelectedPositionId("");
        setAchievements([]);
        setPartylist("");
        setPhotoFile(null);
        setPhotoUrl("");
        setCocFile(null);

        fetch("/api/candidates")
          .then((res) => res.json())
          .then((data: Candidate[]) => {
            setCandidates(
              data.filter(
                (c) =>
                  c.status === "approved" && c.election_id === latestElection.id
              )
            );

            if (user) {
              const filed = data.some(
                (c) =>
                  c.user_id === user.id && c.election_id === latestElection.id
              );
              setAlreadyFiled(filed);
            }
          });
      } else {
        const errorData = await res.json();
        setFormError(errorData.error || "Failed to file candidacy.");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError("An unknown error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  // --- achievement handlers ---
  const addAchievement = () =>
    setAchievements([...achievements, { title: "", type: "" }]);

  const updateAchievement = (
    index: number,
    field: keyof Achievement,
    value: string
  ) => {
    const newAchievements = [...achievements];
    newAchievements[index][field] = value;
    setAchievements(newAchievements);
  };

  const removeAchievement = (index: number) => {
    setAchievements(achievements.filter((_, i) => i !== index));
  };

  // --- UI ---
  return (
    <>
      <main className="relative min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-red-100 overflow-hidden">
        {/* Watermark Logo - Moved down to avoid overlapping with navigation */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 pt-16">
          <Image
            src="/images/botosafe-logo.png"
            alt="Logo Watermark"
            width={600}
            height={600}
            className="w-full max-w-xl opacity-5 object-contain"
            priority
          />
        </div>

        <Header />

        <div className="relative z-10 p-4 max-w-7xl mx-auto">
          {/* Top */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                {latestElection
                  ? `Candidates — ${latestElection.title}`
                  : "Candidates"}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Browse candidates and file your candidacy for the current
                election.
              </p>
            </div>

            {latestElection && (
              <button
                onClick={() => setIsFilingModalOpen(true)}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-[#791010] to-[#b11c1c] text-white font-medium shadow hover:shadow-lg transform hover:-translate-y-0.5 transition"
              >
                + File Candidacy
              </button>
            )}
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <svg
                className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z"
                />
              </svg>
              <input
                type="text"
                aria-label="Search candidates"
                placeholder="Search by name, election, or position..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-[#791010] focus:border-[#791010] text-sm"
              />
            </div>
          </div>

          {/* Candidate list */}
          {Object.entries(filteredCandidatesByPosition).map(([pos, cands]) => (
            <div key={pos} className="mb-10">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                {pos.toUpperCase()}
              </h2>

              {cands.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {cands.map((c) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-md overflow-hidden hover:shadow-xl transform hover:-translate-y-1 transition border cursor-pointer"
                      onClick={() => setSelectedCandidate(c)} // open modal
                    >
                      <div className="w-full h-48 relative">
                        <img
                          src={c.photo_url || "/images/default-avatar.png"}
                          alt={c.fullname}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                        <div className="absolute left-4 bottom-3 text-white">
                          <h3 className="text-lg font-bold drop-shadow">
                            {c.fullname}
                          </h3>
                          <p className="text-sm drop-shadow">{c.position_name}</p>
                        </div>
                        {c.partylist && (
                          <div className="absolute top-3 right-3 bg-[#791010]/80 text-white text-xs font-semibold px-2 py-1 rounded-full">
                            {c.partylist}
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">
                            {c.election_title}
                          </span>
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                            {c.achievements?.length || 0} achievements
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No candidates found.</p>
              )}
            </div>
          ))}

          {/* Candidate Details Modal */}
          <AnimatePresence>
            {selectedCandidate && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-0 relative overflow-hidden"
                >
                  {/* Modal Header with Gradient */}
                  <div className="bg-gradient-to-r from-[#791010] to-[#b11c1c] p-6 text-white">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <img
                            src={
                              selectedCandidate.photo_url ||
                              "/images/default-avatar.png"
                            }
                            alt={selectedCandidate.fullname}
                            className="w-20 h-20 object-cover rounded-full border-2 border-white"
                          />
                          {selectedCandidate.partylist && (
                            <div className="absolute -bottom-1 -right-1 bg-white text-[#791010] text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap">
                              {selectedCandidate.partylist}
                            </div>
                          )}
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold">
                            {selectedCandidate.fullname}
                          </h2>
                          <p className="text-lg opacity-90">
                            {selectedCandidate.position_name}
                          </p>
                          <p className="text-sm opacity-80 mt-1">
                            {selectedCandidate.election_title}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedCandidate(null)}
                        className="text-white hover:text-gray-200 text-2xl"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {/* Achievements Section */}
                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">
                        Achievements
                      </h3>
                      {selectedCandidate.achievements &&
                      selectedCandidate.achievements.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedCandidate.achievements.map(
                            (achievement: Achievement, idx: number) => (
                              <div
                                key={idx}
                                className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-sm transition"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="mt-1">
                                    {achievement.type === "Academic" && (
                                      <span className="text-blue-500">🎓</span>
                                    )}
                                    {achievement.type === "Leadership" && (
                                      <span className="text-green-500">👑</span>
                                    )}
                                    {achievement.type === "Community Service" && (
                                      <span className="text-purple-500">🤝</span>
                                    )}
                                    {achievement.type === "Extracurricular" && (
                                      <span className="text-yellow-500">🏆</span>
                                    )}
                                    {achievement.type === "Other" && (
                                      <span className="text-gray-500">⭐</span>
                                    )}
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-gray-800">
                                      {achievement.title}
                                    </h4>
                                    <span className="inline-block mt-1 text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
                                      {achievement.type}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <p>No achievements listed for this candidate.</p>
                        </div>
                      )}
                    </div>

                    {/* Additional Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <h4 className="font-semibold text-blue-800 mb-2">
                          Election Information
                        </h4>
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Election:</span>{" "}
                          {selectedCandidate.election_title}
                        </p>
                      </div>
                      
                      <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                        <h4 className="font-semibold text-green-800 mb-2">
                          Position
                        </h4>
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Role:</span>{" "}
                          {selectedCandidate.position_name}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                    <button
                      onClick={() => setSelectedCandidate(null)}
                      className="px-5 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300 transition font-medium"
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Filing Modal */}
        <AnimatePresence>
          {isFilingModalOpen && latestElection && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
              aria-modal="true"
              role="dialog"
            >
              <motion.div
                ref={modalRef}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-2xl bg-gradient-to-br from-white/90 via-pink-50 to-red-50 backdrop-blur-lg border border-white/60 rounded-2xl shadow-2xl overflow-hidden"
              >
                {/* Modal Header */}
                <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-[#791010] to-[#b11c1c] text-white font-semibold text-lg">
                  <h2>File Candidacy — {latestElection.title}</h2>
                  <button 
                    onClick={() => setIsFilingModalOpen(false)} 
                    className="hover:opacity-80 transition text-xl"
                  >
                    ✕
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  {alreadyFiled ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-4">✅</div>
                      <p className="text-gray-700 mb-6">
                        You have already filed your candidacy for this election.
                      </p>
                      <button
                        onClick={() => setIsFilingModalOpen(false)}
                        className="px-6 py-2 rounded-lg bg-gradient-to-r from-[#791010] to-[#b11c1c] text-white hover:opacity-90 transition"
                      >
                        Close
                      </button>
                    </div>
                  ) : (
                    <>
                      {formError && (
                        <div className="p-3 mb-4 bg-red-100 text-red-700 text-sm rounded-lg border border-red-200">
                          {formError}
                        </div>
                      )}

                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-600 block mb-1">
                            Position
                          </label>
                          <select
                            value={selectedPositionId}
                            onChange={(e) => setSelectedPositionId(e.target.value)}
                            aria-label="Select position"
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#791010] focus:outline-none bg-white/70 backdrop-blur-sm text-gray-700"
                          >
                            <option value="" className="text-gray-500">-- Select Position --</option>
                            {positions.map((p) => (
                              <option key={p.id} value={p.id} className="text-gray-700">
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-sm font-medium text-gray-600 block mb-1">
                            Partylist
                          </label>
                          {partylists.length > 0 ? (
                            <div className="space-y-2">
                              <select
                                value={selectedPartylistId}
                                onChange={(e) => {
                                  setSelectedPartylistId(e.target.value);
                                  if (e.target.value !== "custom") {
                                    setPartylistInput("");
                                  }
                                }}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#791010] focus:outline-none bg-white/70 backdrop-blur-sm text-gray-700"
                              >
                                <option value="">-- Select Partylist --</option>
                                <option value="independent">Independent</option>
                                {partylists.map((p) => (
                                  <option key={p.id} value={p.id.toString()}>
                                    {p.name}
                                  </option>
                                ))}
                                <option value="custom">-- Other (Specify) --</option>
                              </select>
                              
                              {selectedPartylistId === "custom" && (
                                <input
                                  type="text"
                                  placeholder="Enter custom partylist"
                                  aria-label="Enter custom partylist"
                                  value={partylistInput}
                                  onChange={(e) => setPartylistInput(e.target.value)}
                                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#791010] focus:outline-none bg-white/70 backdrop-blur-sm placeholder-gray-500"
                                />
                              )}
                            </div>
                          ) : (
                            <input
                              type="text"
                              placeholder="Enter Partylist"
                              aria-label="Enter partylist"
                              value={partylist}
                              onChange={(e) => setPartylist(e.target.value)}
                              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#791010] focus:outline-none bg-white/70 backdrop-blur-sm placeholder-gray-500"
                            />
                          )}
                        </div>

                        {/* Achievements Section */}
                        <div className="border-t border-gray-200/50 pt-4">
                          <div className="flex items-center gap-2 mb-3">
                            <label className="text-sm font-medium text-gray-600">
                              Achievements
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowHelpModal(true)}
                              className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 text-xs"
                              title="Learn more about achievement types"
                            >
                              ?
                            </button>
                          </div>

                          {achievements.map((ach, i) => (
                            <div
                              key={i}
                              className="flex gap-2 mb-3 items-start"
                            >
                              <select
                                value={ach.type}
                                onChange={(e) =>
                                  updateAchievement(i, "type", e.target.value)
                                }
                                className="w-1/3 px-2 py-2 border rounded text-sm focus:ring-2 focus:ring-[#791010] focus:outline-none bg-white/70 backdrop-blur-sm text-gray-700"
                              >
                                <option value="" className="text-gray-500">Type</option>
                                <option value="Academic" className="text-gray-700">Academic</option>
                                <option value="Leadership" className="text-gray-700">Leadership</option>
                                <option value="Community Service" className="text-gray-700">
                                  Community Service
                                </option>
                                <option value="Extracurricular" className="text-gray-700">
                                  Extracurricular
                                </option>
                                <option value="Other" className="text-gray-700">Other</option>
                              </select>
                              <input
                                type="text"
                                placeholder="Achievement title"
                                value={ach.title}
                                onChange={(e) =>
                                  updateAchievement(i, "title", e.target.value)
                                }
                                className="flex-1 px-2 py-2 border rounded text-sm focus:ring-2 focus:ring-[#791010] focus:outline-none bg-white/70 backdrop-blur-sm placeholder-gray-500"
                              />
                              <button
                                type="button"
                                onClick={() => removeAchievement(i)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded"
                              >
                                ×
                              </button>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={addAchievement}
                            className="text-sm text-[#791010] hover:underline font-medium"
                          >
                            + Add Achievement
                          </button>
                        </div>

                        {/* Photo Upload */}
                        <div className="border-t border-gray-200/50 pt-4">
                          <label className="text-sm font-medium text-gray-600 block mb-1">
                            Photo
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setPhotoFile(file);
                                setPhotoUrl(URL.createObjectURL(file));
                              }
                            }}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#791010] focus:outline-none bg-white/70 backdrop-blur-sm file:mr-4 file:py-1 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-[#791010]/10 file:text-[#791010] hover:file:bg-[#791010]/20 text-gray-700"
                          />
                          {photoUrl && (
                            <div className="mt-3 relative w-24 h-24 mx-auto">
                              <img
                                src={photoUrl}
                                alt="Preview"
                                className="w-full h-full object-cover rounded-lg border"
                              />
                            </div>
                          )}
                        </div>

                        {/* CoC Upload */}
                        <div className="border-t border-gray-200/50 pt-4">
                          <label className="text-sm font-medium text-gray-600 block mb-1">
                            Certificate of Candidacy (PDF)
                          </label>
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setCocFile(file);
                            }}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#791010] focus:outline-none bg-white/70 backdrop-blur-sm file:mr-4 file:py-1 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-[#791010]/10 file:text-[#791010] hover:file:bg-[#791010]/20 text-gray-700"
                          />
                        </div>

                        <div className="flex justify-end gap-3 pt-6">
                          <button
                            type="button"
                            onClick={() => setIsFilingModalOpen(false)}
                            className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleFile}
                            disabled={loading}
                            className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#791010] to-[#b11c1c] text-white hover:opacity-90 disabled:opacity-50 transition"
                          >
                            {loading ? "Filing..." : "File Candidacy"}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Help Modal */}
        <AnimatePresence>
          {showHelpModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
              aria-modal="true"
              role="dialog"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-md bg-gradient-to-br from-white/90 via-pink-50 to-red-50 backdrop-blur-lg border border-white/60 rounded-2xl shadow-2xl overflow-hidden"
              >
                {/* Modal Header */}
                <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-[#791010] to-[#b11c1c] text-white font-semibold text-lg">
                  <h2>Achievement Types</h2>
                  <button 
                    onClick={() => setShowHelpModal(false)} 
                    className="hover:opacity-80 transition text-xl"
                  >
                    ✕
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar modal-content">
                  <ul className="space-y-4">
                    <li className="p-4 bg-white/60 rounded-lg border border-white/40 hover:shadow-md transition">
                      <div className="font-semibold text-[#791010] mb-1">Academic</div>
                      <p className="text-sm text-gray-600">Grades, scholarships, academic awards</p>
                    </li>
                    <li className="p-4 bg-white/60 rounded-lg border border-white/40 hover:shadow-md transition">
                      <div className="font-semibold text-[#791010] mb-1">Leadership</div>
                      <p className="text-sm text-gray-600">Club presidencies, team captain, organizational roles</p>
                    </li>
                    <li className="p-4 bg-white/60 rounded-lg border border-white/40 hover:shadow-md transition">
                      <div className="font-semibold text-[#791010] mb-1">Community Service</div>
                      <p className="text-sm text-gray-600">Volunteering, outreach programs, charity work</p>
                    </li>
                    <li className="p-4 bg-white/60 rounded-lg border border-white/40 hover:shadow-md transition">
                      <div className="font-semibold text-[#791010] mb-1">Extracurricular</div>
                      <p className="text-sm text-gray-600">Sports, arts, competitions, clubs</p>
                    </li>
                    <li className="p-4 bg-white/60 rounded-lg border border-white/40 hover:shadow-md transition">
                      <div className="font-semibold text-[#791010] mb-1">Other</div>
                      <p className="text-sm text-gray-600">Any other relevant accomplishments</p>
                    </li>
                  </ul>
                  <button
                    onClick={() => setShowHelpModal(false)}
                    className="mt-6 w-full py-2.5 rounded-lg bg-gradient-to-r from-[#791010] to-[#b11c1c] text-white hover:opacity-90 transition font-medium"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <Footer />
    </>
  );
}

// Add Footer component
Object.assign(CandidatesPage, { Footer });
