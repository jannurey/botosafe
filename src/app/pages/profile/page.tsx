"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { FiSettings, FiEdit2 } from "react-icons/fi";
import Header from "@/components/partials/Header";
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
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
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
        const res = await fetch("/api/users/me", {
          method: "GET",
          credentials: "include",
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
        localStorage.removeItem("user");
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
        <p className="text-gray-600 animate-pulse text-lg">Loading...</p>
      </main>
    );
  }
  if (!user) return null;

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-red-100">
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

      {/* Settings Icon */}
      <div className="flex justify-end pr-6 mt-6 relative z-50">
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          className="p-3 rounded-full bg-white/80 shadow hover:bg-white transition relative z-50"
        >
          <FiSettings className="text-xl text-[#791010]" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-12 w-48 bg-white/95 backdrop-blur-md border rounded-lg shadow-lg overflow-hidden z-[60]">
            <button
              onClick={() => {
                setActiveModal("edit");
                setMenuOpen(false);
              }}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              Edit Profile
            </button>
            <button
              onClick={() => {
                setActiveModal("applications");
                setMenuOpen(false);
              }}
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              My Applications
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100"
            >
              Log Out
            </button>
          </div>
        )}
      </div>

      {/* Profile Section */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 mt-6">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/40 p-6 flex flex-col lg:flex-row gap-6">
          {/* Left Column */}
          <div className="flex flex-col items-center lg:items-start gap-4 w-full lg:w-1/3">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#791010] to-[#b11c1c] flex items-center justify-center text-white text-4xl font-bold shadow-md">
              {user.fullname?.charAt(0) ?? "U"}
            </div>
            <h2 className="text-2xl font-bold text-[#791010]">
              {user.fullname}
            </h2>
            <p className="text-gray-600">{user.email}</p>
            <p className="text-sm text-gray-500">
              🎓 {user.course} • {user.year_level}
            </p>
            <button
              onClick={() => setActiveModal("edit")}
              className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#791010] to-[#b11c1c] text-white text-sm hover:opacity-90 transition"
            >
              <FiEdit2 /> Edit Profile
            </button>
          </div>

          {/* Right Column */}
          <div className="w-full lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ProfileField label="School ID" value={user.school_id} />
            <ProfileField label="Age" value={user.age} />
            <ProfileField label="Status" value={user.status} />
            <ProfileField label="Gender" value={user.gender} />
            <ProfileField label="Course" value={user.course} />
            <ProfileField label="Year Level" value={user.year_level} />
            <ProfileField label="Email" value={user.email} />
          </div>
        </div>
      </div>

      {/* 🔹 Modals */}
      {activeModal === "edit" && (
        <Modal title="Edit Profile" onClose={() => setActiveModal(null)}>
          <form
            className="space-y-4"
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
            <InputField
              name="age"
              label="Age"
              defaultValue={user.age?.toString() ?? ""}
            />

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
            <SelectField
              name="gender"
              label="Gender"
              defaultValue={user.gender ?? ""}
              options={["Male", "Female", "Other"]}
            />

            <InputField name="password" label="New Password" defaultValue="" />

            <button
              type="submit"
              className="w-full py-2.5 bg-gradient-to-r from-[#791010] to-[#b11c1c] text-white rounded-lg shadow-md hover:opacity-90 transition"
            >
              Save Changes
            </button>
          </form>
        </Modal>
      )}

      {activeModal === "applications" && (
        <Modal title="My Applications" onClose={() => setActiveModal(null)}>
          {appsLoading ? (
            <p className="text-gray-600">Loading applications...</p>
          ) : applications.length > 0 ? (
            <div className="space-y-4">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="p-5 border rounded-xl shadow-sm bg-white/80 hover:shadow-md transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div>
                    <p className="font-semibold text-gray-800 text-lg">
                      {app.position_name} — {app.election_title}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {app.description}
                    </p>
                    <p className="text-xs mt-2">
                      Status:{" "}
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          app.status === "approved"
                            ? "bg-green-100 text-green-700"
                            : app.status === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {app.status}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {app.coc_file_url && (
                      <a
                        href={app.coc_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 text-xs rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition"
                      >
                        View CoC
                      </a>
                    )}
                    <button
                      onClick={() => handleWithdraw(app.id)}
                      className="px-4 py-2 text-xs rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition"
                    >
                      Withdraw
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 italic">No applications found.</p>
          )}
        </Modal>
      )}

      {showConfirm && (
        <Modal title="Confirm Logout" onClose={() => setShowConfirm(false)}>
          <p className="text-gray-600 mb-6">
            Are you sure you want to log out?
          </p>
          <div className="flex justify-between gap-4">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 py-2 rounded-lg bg-gradient-to-r from-[#791010] to-[#b11c1c] text-white hover:opacity-90 transition"
            >
              Yes, Logout
            </button>
          </div>
        </Modal>
      )}
    </main>
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
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
      <div className="relative w-full max-w-lg bg-gradient-to-br from-white/90 via-pink-50 to-red-50 backdrop-blur-lg border border-white/60 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
        <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-[#791010] to-[#b11c1c] text-white font-semibold text-lg">
          <h2>{title}</h2>
          <button onClick={onClose} className="hover:opacity-80 transition">
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
    <div className="bg-white/60 p-3 rounded-lg border border-white/40 hover:shadow-md transition">
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className="font-semibold text-lg text-gray-800">{value ?? "-"}</p>
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
      <label className="text-sm font-medium text-gray-600 block mb-1">
        {label}
      </label>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#791010] focus:outline-none bg-white/70 backdrop-blur-sm"
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
      <label className="text-sm font-medium text-gray-600 block mb-1">
        {label}
      </label>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#791010] focus:outline-none bg-white/70 backdrop-blur-sm"
      >
        <option value="">-- Select {label} --</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
