"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { FiEdit2 } from "react-icons/fi";
import Header from "@/components/partials/Header";
import Footer from "@/components/partials/Footer";
import Image from "next/image";

// 🔹 Types
type Candidate = {
  id: number;
  user_id: number;
  election_title: string;
  position_name: string;
  description: string;
  photo_url?: string;
  coc_file_url?: string;
  status: string;
};

type User = {
  id: number;
  fullname: string;
  email: string;
  school_id?: string;
  course?: string;
  year_level?: string;
  age?: number;
  status?: string;
  gender?: string;
};

type Election = {
  id: number;
  title: string;
  status: string;
  start_time: string;
};
type Position = { id: number; name: string };

type Achievement = {
  id?: number;
  title: string;
  description?: string;
};

/* Helper for status label */
const formatStatusLabel = (
  s: string
): "Approved" | "Pending" | "Declined" | "Withdrawn" | string => {
  const ls = s?.toLowerCase?.() ?? "";
  if (ls === "approved") return "Approved";
  if (ls === "pending") return "Pending";
  if (ls === "declined") return "Declined";
  if (ls === "withdrawn") return "Withdrawn";
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default function ProfilePage() {
  const router = useRouter();

  // core states
  const [loading, setLoading] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const [appsLoading, setAppsLoading] = useState<boolean>(true);
  const [applications, setApplications] = useState<Candidate[]>([]);

  // UI state
  const [activeModal, setActiveModal] = useState<
    "edit" | "applications" | null
  >(null);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  // edit profile / change password
  const [isEditProfileOpen, setIsEditProfileOpen] = useState<boolean>(false);
  const [profileSuccessMessage, setProfileSuccessMessage] =
    useState<string>("");

  const [isChangePasswordOpen, setIsChangePasswordOpen] =
    useState<boolean>(false);
  const [cpCurrent, setCpCurrent] = useState<string>("");
  const [cpNew, setCpNew] = useState<string>("");
  const [cpConfirm, setCpConfirm] = useState<string>("");
  const [cpLoading, setCpLoading] = useState<boolean>(false);
  const [cpError, setCpError] = useState<string>("");

  // Filing modal (used for both new filing and edit existing pending)
  const [isFilingModalOpen, setIsFilingModalOpen] = useState<boolean>(false);
  const [latestElection, setLatestElection] = useState<Election | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [formError, setFormError] = useState<string>("");
  const [selectedPositionId, setSelectedPositionId] = useState<string>("");
  const [positions, setPositions] = useState<Position[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [partylist, setPartylist] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState<string>(""); // preview URL (existing or newly chosen)
  const [photoFile, setPhotoFile] = useState<File | null>(null); // newly selected
  const [cocUrl, setCocUrl] = useState<string>(""); // existing coc url preview
  const [cocFile, setCocFile] = useState<File | null>(null); // newly selected
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  // Filing context: if editing existing candidate, hold its id and original snapshot
  const [editingCandidateId, setEditingCandidateId] = useState<number | null>(
    null
  );
  const [originalCandidateSnapshot, setOriginalCandidateSnapshot] =
    useState<Candidate | null>(null);

  /* small CSS injected for pulse + card gradient */
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
    `;
    document.head.appendChild(style);
    return () => void document.head.removeChild(style);
  }, []);

  /* Fetch current user */
  useEffect(() => {
    const fetchUser = async (): Promise<void> => {
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
                const data: { user: User } = await res.json();
                setUser(data.user);
                setLoading(false);
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
        if (!res.ok) {
          router.push("/signin/login");
          return;
        }
        const data: { user: User } = await res.json();
        setUser(data.user);
      } catch (err) {
        console.error(err);
        router.push("/signin/login");
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [router]);

  /* Fetch user applications (use user.id from session context) */
  useEffect(() => {
    if (!user) return;
    const fetchApps = async (): Promise<void> => {
      try {
        setAppsLoading(true);
        const res = await fetch(
          `/api/candidates?user_id=${encodeURIComponent(String(user.id))}`
        );
        if (!res.ok) throw new Error("Failed to fetch applications");
        const data: Candidate[] = await res.json();
        setApplications(
          data.filter((c) => c.status?.toLowerCase() !== "withdrawn")
        );
      } catch (err) {
        console.error(err);
      } finally {
        setAppsLoading(false);
      }
    };
    fetchApps();
  }, [user]);

  const handleWithdraw = async (id: number) => {
    if (!confirm("Are you sure you want to withdraw this application?")) return;
    try {
      const res = await fetch(`/api/candidates/${id}`, { method: "DELETE" });
      if (res.ok)
        setApplications((prev) => prev.filter((app) => app.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        // Clear local storage items
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        localStorage.removeItem("tempLogin");
        localStorage.removeItem("userId");
        localStorage.removeItem("username");
        localStorage.removeItem("userRole");
        localStorage.removeItem("tempAuthToken");
        
        // Dispatch a custom event to notify other components
        window.dispatchEvent(new CustomEvent("user-logout"));
        
        // Redirect to login page
        router.push("/signin/login");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveProfile = async (formData: FormData) => {
    try {
      const body = {
        fullname: formData.get("fullname") as string | null,
        email: formData.get("email") as string | null,
        school_id: formData.get("school_id") as string | null,
        course: formData.get("course") as string | null,
        age: formData.get("age") ? Number(formData.get("age")) : null,
        year_level: formData.get("year_level") as string | null,
        status: formData.get("status") as string | null,
        gender: formData.get("gender") as string | null,
        password: formData.get("password") as string | null,
      };
      const res = await fetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated: { user: User } = await res.json();
        setUser(updated.user);
        setActiveModal(null);
      } else {
        alert("Failed to update profile.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-pink-100 to-red-100">
        <div className="text-center p-8 bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg max-w-md w-full mx-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#791010] mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Loading your profile...</p>
        </div>
      </main>
    );
  }
  if (!user) return null;

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-red-100">
        <main className="relative overflow-x-hidden pb-8">
          {/* Watermark Logo */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <Image
              src="/images/botosafe-logo.png"
              alt="Logo Watermark"
              fill
              className="object-contain opacity-5"
              priority
            />
          </div>

          <Header />

          {/* Profile Section */}
          <div className="relative z-10 max-w-6xl mx-auto px-4 mt-6">
            {/* Header Section with Profile Card */}
            <div className="bg-gradient-to-r from-[#791010] to-[#b11c1c] rounded-2xl shadow-xl p-6 mb-6">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center text-[#791010] text-3xl font-bold border-4 border-white shadow-lg">
                    {user.fullname?.charAt(0) ?? "U"}
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-2 shadow-md">
                    <FiEdit2 className="text-[#791010]" />
                  </div>
                </div>
                <div className="text-center md:text-left text-white flex-1">
                  <h1 className="text-2xl font-bold">{user.fullname}</h1>
                  <p className="text-white/90 mb-2">{user.email}</p>
                  <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-3">
                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                      🎓 {user.course}
                    </span>
                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                      {user.year_level}
                    </span>
                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                      ID: {user.school_id}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setActiveModal("edit")}
                    className="bg-white text-[#791010] px-4 py-2 rounded-lg font-medium hover:bg-white/90 transition flex items-center gap-2"
                  >
                    <FiEdit2 size={16} /> Edit Profile
                  </button>
                  <button
                    onClick={() => setShowConfirm(true)}
                    className="bg-white/20 text-white px-4 py-2 rounded-lg font-medium hover:bg-white/30 transition"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Personal Info */}
              <div className="lg:col-span-2 space-y-6">
                {/* Personal Information Card */}
                <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/40 p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-[#791010]">Personal Information</h2>
                    <button
                      onClick={() => setActiveModal("edit")}
                      className="text-[#791010] hover:underline text-sm font-medium"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border-l-4 border-[#791010] pl-4 py-1">
                      <p className="text-sm text-gray-700">Full Name</p>
                      <p className="font-semibold">{user.fullname}</p>
                    </div>
                    <div className="border-l-4 border-[#791010] pl-4 py-1">
                      <p className="text-sm text-gray-700">Email</p>
                      <p className="font-semibold">{user.email}</p>
                    </div>
                    <div className="border-l-4 border-[#791010] pl-4 py-1">
                      <p className="text-sm text-gray-700">School ID</p>
                      <p className="font-semibold">{user.school_id || "Not set"}</p>
                    </div>
                    <div className="border-l-4 border-[#791010] pl-4 py-1">
                      <p className="text-sm text-gray-700">Age</p>
                      <p className="font-semibold">{user.age || "Not set"}</p>
                    </div>
                    <div className="border-l-4 border-[#791010] pl-4 py-1">
                      <p className="text-sm text-gray-700">Course</p>
                      <p className="font-semibold">{user.course || "Not set"}</p>
                    </div>
                    <div className="border-l-4 border-[#791010] pl-4 py-1">
                      <p className="text-sm text-gray-700">Year Level</p>
                      <p className="font-semibold">{user.year_level || "Not set"}</p>
                    </div>
                    <div className="border-l-4 border-[#791010] pl-4 py-1">
                      <p className="text-sm text-gray-700">Gender</p>
                      <p className="font-semibold">{user.gender || "Not set"}</p>
                    </div>
                    <div className="border-l-4 border-[#791010] pl-4 py-1">
                      <p className="text-sm text-gray-700">Status</p>
                      <p className="font-semibold">{user.status || "Not set"}</p>
                    </div>
                  </div>
                </div>

                {/* Applications Section */}
                <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/40 p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-[#791010]">My Applications</h2>
                    <button
                      onClick={() => setActiveModal("applications")}
                      className="text-[#791010] hover:underline text-sm font-medium"
                    >
                      View All
                    </button>
                  </div>
                
                  {appsLoading ? (
                    <div className="flex justify-center items-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#791010]"></div>
                    </div>
                  ) : applications.length > 0 ? (
                    <div className="space-y-4">
                      {applications.slice(0, 3).map((app) => (
                        <div key={app.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                          <div className="flex justify-between">
                            <h3 className="font-bold text-gray-800">{app.position_name}</h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              app.status === "approved"
                                ? "bg-green-100 text-green-700"
                                : app.status === "pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                            }`}>
                              {formatStatusLabel(app.status)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mt-1">{app.election_title}</p>
                          <div className="flex justify-between items-center mt-3">
                            <span className="text-xs text-gray-700">
                              Filed on {new Date().toLocaleDateString()}
                            </span>
                            {app.coc_file_url && (
                              <a
                                href={app.coc_file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#791010] hover:underline"
                              >
                                View CoC
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                      {applications.length > 3 && (
                        <div className="text-center pt-2">
                          <p className="text-sm text-gray-500">
                            + {applications.length - 3} more applications
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-3">📝</div>
                      <p className="text-gray-700 mb-4">You haven&apos;t filed any applications yet</p>
                      <button
                        onClick={() => router.push('/pages/candidates')}
                        className="bg-[#791010] text-white px-4 py-2 rounded-lg hover:opacity-90 transition text-sm font-medium"
                      >
                        File a Candidacy
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Quick Stats and Actions */}
              <div className="space-y-6">
                {/* Quick Stats */}
                <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/40 p-6">
                  <h2 className="text-xl font-bold text-[#791010] mb-4">Quick Stats</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-[#791010]/10 to-[#b11c1c]/10 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-[#791010]">{applications.length}</p>
                      <p className="text-sm text-gray-600">Total Applications</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {applications.filter(app => app.status === 'approved').length}
                      </p>
                      <p className="text-sm text-gray-600">Approved</p>
                    </div>
                    <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-yellow-600">
                        {applications.filter(app => app.status === 'pending').length}
                      </p>
                      <p className="text-sm text-gray-600">Pending</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {applications.filter(app => app.status === 'declined').length}
                      </p>
                      <p className="text-sm text-gray-600">Declined</p>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/40 p-6">
                  <h2 className="text-xl font-bold text-[#791010] mb-4">Quick Actions</h2>
                  <div className="space-y-3">
                    <button
                      onClick={() => router.push('/pages/candidates')}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition"
                    >
                      <div className="bg-[#791010]/10 p-2 rounded-lg">
                        <span className="text-[#791010]">🗳️</span>
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-gray-800">File Candidacy</p>
                        <p className="text-xs text-gray-500">Apply for a position</p>
                      </div>
                    </button>
                    <button
                      onClick={() => router.push('/pages/vote')}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition"
                    >
                      <div className="bg-[#791010]/10 p-2 rounded-lg">
                        <span className="text-[#791010]">✅</span>
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-gray-800">Cast Vote</p>
                        <p className="text-xs text-gray-500">Participate in elections</p>
                      </div>
                    </button>
                    <button
                      onClick={() => router.push('/pages/dashboard')}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition"
                    >
                      <div className="bg-[#791010]/10 p-2 rounded-lg">
                        <span className="text-[#791010]">📊</span>
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-gray-800">View Results</p>
                        <p className="text-xs text-gray-500">Check election results</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 🔹 Modals */}
          {activeModal === "edit" && (
            <Modal title="Edit Profile" onClose={() => setActiveModal(null)}>
              <form
                className="space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveProfile(new FormData(e.currentTarget));
                }}
              >
                <InputField
                  name="fullname"
                  label="Full Name"
                  defaultValue={user.fullname}
                />
                <InputField name="email" label="Email" defaultValue={user.email} />
                <InputField
                  name="school_id"
                  label="School ID"
                  defaultValue={user.school_id ?? ""}
                />
                <InputField
                  name="course"
                  label="Course"
                  defaultValue={user.course ?? ""}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <InputField
                    name="age"
                    label="Age"
                    defaultValue={user.age?.toString() ?? ""}
                  />
                  <SelectField
                    name="gender"
                    label="Gender"
                    defaultValue={user.gender ?? ""}
                    options={["Male", "Female", "Other"]}
                  />
                </div>
              
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <SelectField
                    name="year_level"
                    label="Year Level"
                    defaultValue={user.year_level ?? ""}
                    options={[
                      "1st Year",
                      "2nd Year",
                      "3rd Year",
                      "4th Year",
                      "5th Year",
                    ]}
                  />
                  <SelectField
                    name="status"
                    label="Status"
                    defaultValue={user.status ?? ""}
                    options={["Active", "Inactive", "Graduated"]}
                  />
                </div>

                <div className="border-t border-gray-200/50 pt-5">
                  <InputField name="password" label="New Password (leave blank to keep current)" defaultValue="" />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-[#791010] to-[#b11c1c] text-white rounded-lg shadow-md hover:opacity-90 transition font-medium"
                >
                  Save Changes
                </button>
              </form>
            </Modal>
          )}

          {activeModal === "applications" && (
            <Modal title="My Applications" onClose={() => setActiveModal(null)}>
              {appsLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#791010]"></div>
                </div>
              ) : applications.length > 0 ? (
                <div className="space-y-4">
                  {applications.map((app) => (
                    <div
                      key={app.id}
                      className="p-5 border rounded-xl shadow-sm bg-white/80 hover:shadow-md transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 text-lg">
                          {app.position_name} — {app.election_title}
                        </p>
                        <p className="text-sm text-gray-600 mt-2">
                          {app.description}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              app.status === "approved"
                                ? "bg-green-100 text-green-700"
                                : app.status === "pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {formatStatusLabel(app.status)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {app.coc_file_url && (
                          <a
                            href={app.coc_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              // For locally stored files, use our serve-file endpoint
                              if (app.coc_file_url?.startsWith('/uploads/candidates/')) {
                                // Extract filename from URL
                                const fileName = app.coc_file_url.split('/').pop();
                                if (fileName) {
                                  const serveUrl = `/api/serve-file?file=${encodeURIComponent(fileName)}`;
                                  window.open(serveUrl, '_blank');
                                  return;
                                }
                              }
                              
                              // For Supabase Storage files, open directly (they're public URLs with proper content types)
                              if (app.coc_file_url?.includes('/storage/v1/object/public/')) {
                                window.open(app.coc_file_url, '_blank');
                                return;
                              }
                              
                              // For Cloudinary files, redirect to our local serving endpoint
                              if (app.coc_file_url?.startsWith('https://res.cloudinary.com/')) {
                                // Extract the filename from the Cloudinary URL
                                try {
                                  const urlParts = app.coc_file_url.split('/');
                                  const fileName = urlParts[urlParts.length - 1];
                                  if (fileName) {
                                    // For PDF files, we'll need to migrate them to local storage
                                    // For now, we can still try to open them with the attachment flag
                                    if (app.coc_file_url.toLowerCase().endsWith('.pdf')) {
                                      let pdfUrl = app.coc_file_url;
                                      if (app.coc_file_url.includes('/upload/') && !app.coc_file_url.includes('fl_attachment:false')) {
                                        // Add the attachment flag to prevent forced download
                                        if (app.coc_file_url.includes('/raw/upload/')) {
                                          pdfUrl = app.coc_file_url.replace('/raw/upload/', '/raw/upload/fl_attachment:false/');
                                        } else {
                                          pdfUrl = app.coc_file_url.replace('/upload/', '/upload/fl_attachment:false/');
                                        }
                                      }
                                      window.open(pdfUrl, '_blank');
                                      return;
                                    } else {
                                      // For other file types, use proxy
                                      e.preventDefault();
                                      window.open(`/api/proxy-file?url=${encodeURIComponent(app.coc_file_url)}`, '_blank');
                                      return;
                                    }
                                  }
                                } catch (e) {
                                  // If parsing fails, fall through to default behavior
                                }
                              }
                              
                              // Non-Cloudinary files open directly
                              window.open(app.coc_file_url, '_blank');
                            }}
                            className="px-4 py-2 text-sm rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition font-medium"
                          >
                            View CoC
                          </a>
                        )}
                        {app.status === "pending" && (
                          <button
                            onClick={() => handleWithdraw(app.id)}
                            className="px-4 py-2 text-sm rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition font-medium"
                          >
                            Withdraw
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">📝</div>
                  <p className="text-gray-600 mb-6">
                    You haven&apos;t filed any candidacy applications yet.
                  </p>
                  <button
                    onClick={() => {
                      setActiveModal(null);
                      router.push('/pages/candidates');
                    }}
                    className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#791010] to-[#b11c1c] text-white hover:opacity-90 transition font-medium"
                  >
                    File a Candidacy Now
                  </button>
                </div>
              )}
            </Modal>
          )}

          {showConfirm && (
            <Modal title="Confirm Logout" onClose={() => setShowConfirm(false)}>
              <div className="text-center py-4">
                <div className="text-4xl mb-4">👋</div>
                <p className="text-gray-600 mb-8">
                  Are you sure you want to log out?
                </p>
                <div className="flex justify-between gap-4">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-[#791010] to-[#b11c1c] text-white hover:opacity-90 transition font-medium"
                  >
                    Yes, Logout
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </main>
      </div>
    </>
  );
}

// 🔹 Modal Component (Trendy + Gradient + Scrollable)
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 p-4">
      <div className="relative w-full max-w-2xl bg-gradient-to-br from-white/90 via-pink-50 to-red-50 backdrop-blur-lg border border-white/60 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
        <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-[#791010] to-[#b11c1c] text-white font-semibold text-lg">
          <h2>{title}</h2>
          <button onClick={onClose} className="hover:opacity-80 transition text-xl">
            ✕
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}

// 🔹 Custom Scrollbar Styling
if (typeof window !== "undefined") {
  const style = document.createElement("style");
  style.innerHTML = `
    .custom-scrollbar::-webkit-scrollbar {
      width: 8px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
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
}

// 🔹 Profile Field Component
function ProfileField({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined;
}) {
  return (
    <div className="bg-white/60 p-4 rounded-lg border border-white/40 hover:shadow-md transition shadow-sm">
      <p className="text-xs uppercase text-gray-500 tracking-wide font-medium">{label}</p>
      <p className="font-semibold text-lg text-gray-800 mt-1">{value ?? "-"}</p>
    </div>
  );
}

// 🔹 Input Field Component
function InputField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-2">
        {label}
      </label>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#791010] focus:outline-none bg-white/70 backdrop-blur-sm placeholder-gray-500 shadow-sm"
      />
    </div>
  );
}

// 🔹 Select Field Component
function SelectField({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  options: string[];
}) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-2">
        {label}
      </label>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#791010] focus:outline-none bg-white/70 backdrop-blur-sm shadow-sm text-gray-700"
      >
        <option value="" className="text-gray-500">-- Select {label} --</option>
        {options.map((opt) => (
          <option key={opt} value={opt} className="text-gray-700">
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
