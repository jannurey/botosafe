"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Admin {
  id: number;
  fullname: string;
  email: string;
  role: string;
  age?: number | null;
  gender?: string | null;
  course?: string | null;
  year_level?: string | number | null;
  school_id?: string | null;
  approval_status?: string | null;
  can_vote?: number | null;
  approved_at?: string | null;
  last_login_at?: string | null;
  created_at?: string | null;
}

function ApprovalBadge({ status }: { status?: string | null }) {
  if (status === "approved") {
    return (
      <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-semibold">
        Approved
      </span>
    );
  }
  if (status === "declined") {
    return (
      <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-semibold">
        Declined
      </span>
    );
  }
  return (
    <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-semibold">
      Pending
    </span>
  );
}

function CanVoteBadge({ canVote }: { canVote?: number | null }) {
  return Number(canVote) === 1 ? (
    <span className="bg-green-50 text-green-700 px-2 py-1 rounded-full text-xs font-semibold">
      Can Vote
    </span>
  ) : (
    <span className="bg-gray-50 text-gray-700 px-2 py-1 rounded-full text-xs font-semibold">
      No Vote
    </span>
  );
}

export default function AdminProfilePage() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch("/api/admins/me");
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setAdmin(data);
      } catch (err) {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!admin)
    return <div className="p-6 text-center">Unable to load profile.</div>;

  const initials = admin.fullname
    ? admin.fullname
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "AD";

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="bg-white rounded-md shadow p-4 sm:p-6">
        {/* Top row: avatar + main info. On small screens stack; on larger screens side-by-side */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0 flex items-center justify-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl sm:text-3xl font-semibold">
              {initials}
            </div>
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-4">
              <div className="min-w-0">
                <h2 className="text-lg sm:text-2xl font-bold leading-tight truncate">
                  {admin.fullname}
                </h2>
                <p className="text-sm text-gray-600 truncate">{admin.email}</p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-500">Role:</span>
                  <span className="text-xs font-medium text-gray-700">
                    {admin.role}
                  </span>
                  <span className="mx-1 hidden sm:inline">•</span>
                  <ApprovalBadge status={admin.approval_status} />
                  <CanVoteBadge canVote={admin.can_vote} />
                </div>
              </div>

              {/* Edit button aligned to the top-right on wide screens; placed after info on small screens */}
              <div className="ml-auto">
                <Link
                  href="/admin/profile/edit"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                  aria-label="Edit profile"
                >
                  Edit Profile
                </Link>
              </div>
            </div>

            {/* Timestamps row - responsive */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-gray-600"></div>
          </div>
        </div>

        {/* Details grid */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
          <div className="bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-500">Age</div>
            <div className="font-medium">{admin.age ?? "—"}</div>
          </div>

          <div className="bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-500">Gender</div>
            <div className="font-medium">{admin.gender ?? "—"}</div>
          </div>

          <div className="bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-500">Course</div>
            <div className="font-medium">{admin.course ?? "—"}</div>
          </div>

          <div className="bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-500">Year level</div>
            <div className="font-medium">{admin.year_level ?? "—"}</div>
          </div>

          <div className="sm:col-span-2 bg-gray-50 rounded p-3">
            <div className="text-xs text-gray-500">School ID</div>
            <div className="font-medium break-words">
              {admin.school_id ?? "—"}
            </div>
          </div>
        </div>

        {/* Optional additional actions or meta at bottom */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-gray-600">
            <strong>Approval status:</strong>{" "}
            <span className="ml-1">{admin.approval_status ?? "Pending"}</span>
          </div>

          <div className="text-sm text-gray-600">
            <strong>Voting:</strong>{" "}
            <span className="ml-1">
              {Number(admin.can_vote) === 1 ? "Allowed" : "Not allowed"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
