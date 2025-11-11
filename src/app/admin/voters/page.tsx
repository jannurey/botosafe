"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";

type Voter = {
  id: number;
  school_id: number;
  fullname: string;
  email: string;
  course: string | null;
  year_level: string | number | null; // declared year: "1st Year" | "2nd Year" | ... or numeric
  age: number | null;
  gender: string;
  role: string;
  approval_status: string | null;
  user_status: string | null;
};

export default function VotersPage() {
  const [voters, setVoters] = useState<Voter[]>([]);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("All");
  const [confirmAction, setConfirmAction] = useState<{
    type: "approve" | "decline";
    voter: Voter | null;
  }>({ type: "approve", voter: null });

  useEffect(() => {
    const fetchVoters = async (): Promise<void> => {
      try {
        const res = await fetch("/api/voters");
        if (!res.ok) throw new Error("Failed to fetch voters");
        const data: Voter[] = await res.json();
        setVoters(data);
      } catch (error) {
        console.error("Failed to fetch voters:", error);
      }
    };

    fetchVoters();
  }, []);

  const handleApprove = async (id: number): Promise<void> => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approval_status: "approved",
          user_status: "active",
        }),
      });

      if (!res.ok) throw new Error("Failed to approve voter");

      setVoters((prev) =>
        prev.map((v) =>
          v.id === id
            ? { ...v, approval_status: "approved", user_status: "active" }
            : v
        )
      );
    } catch (error) {
      console.error("Approve failed:", error);
    }
  };

  const handleDecline = async (id: number): Promise<void> => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approval_status: "declined",
          user_status: "inactive",
        }),
      });

      if (!res.ok) throw new Error("Failed to decline voter");

      setVoters((prev) =>
        prev.map((v) =>
          v.id === id
            ? { ...v, approval_status: "declined", user_status: "inactive" }
            : v
        )
      );
    } catch (error) {
      console.error("Decline failed:", error);
    }
  };

  const confirmHandler = async (): Promise<void> => {
    if (!confirmAction.voter) return;
    if (confirmAction.type === "approve") {
      await handleApprove(confirmAction.voter.id);
    } else {
      await handleDecline(confirmAction.voter.id);
    }
    setConfirmAction({ type: "approve", voter: null });
  };

  const handleExportCSV = (): void => {
    if (filteredVoters.length === 0) {
      alert("No voters to export.");
      return;
    }

    const headers = [
      "School ID",
      "Full Name",
      "Email",
      "Course",
      "Year Level",
      "Age",
      "Gender",
      "Approval Status",
      "User Status",
      "Role",
    ];

    const rows = filteredVoters.map((v) => [
      v.school_id ?? "",
      v.fullname,
      v.email,
      v.course ?? "",
      v.year_level ?? "",
      v.age ?? "",
      v.gender ?? "",
      v.approval_status ?? "",
      v.user_status ?? "",
      v.role,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "voters.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const years = ["All", ...new Set(voters.map((v) => String(v.year_level)))];

  const filteredVoters = voters.filter((v) => {
    const matchesSearch =
      v.fullname.toLowerCase().includes(search.toLowerCase()) ||
      v.email.toLowerCase().includes(search.toLowerCase());
    const matchesYear =
      yearFilter === "All" || String(v.year_level) === yearFilter;
    return matchesSearch && matchesYear;
  });

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">
          Voters Management
        </h1>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
          />

          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
          >
            {years.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition text-sm sm:text-base"
          >
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto bg-white shadow-md rounded-lg">
          <table className="w-full border-collapse text-sm sm:text-base">
            <thead className="bg-gray-100 text-gray-700 uppercase text-xs sm:text-sm">
              <tr>
                <th className="px-4 py-3 text-left">School ID</th>
                <th className="px-4 py-3 text-left">Full Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 hidden sm:table-cell">Course</th>
                <th className="px-4 py-3 hidden sm:table-cell">Year</th>
                <th className="px-4 py-3 text-center">Approval</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVoters.map((voter, idx) => (
                <tr
                  key={voter.id}
                  className={`border-t hover:bg-gray-50 transition ${
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                  }`}
                >
                  <td className="px-4 py-3">{voter.school_id ?? "-"}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {voter.fullname}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{voter.email}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {voter.course ?? "-"}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {voter.year_level ?? "-"}
                  </td>

                  {/* Approval Status */}
                  <td className="px-4 py-3 text-center">
                    {voter.approval_status === "approved" ? (
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-semibold">
                        Approved
                      </span>
                    ) : voter.approval_status === "declined" ? (
                      <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-semibold">
                        Declined
                      </span>
                    ) : (
                      <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-semibold">
                        Pending
                      </span>
                    )}
                  </td>

                  {/* User Status */}
                  <td className="px-4 py-3 text-center">
                    {voter.user_status === "active" ? (
                      <span className="bg-green-50 text-green-700 px-2 py-1 rounded-full text-xs font-semibold">
                        Active
                      </span>
                    ) : voter.user_status === "inactive" ? (
                      <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs font-semibold">
                        Inactive
                      </span>
                    ) : (
                      <span className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded-full text-xs font-semibold">
                        Graduate
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-center">
                    {(!voter.approval_status ||
                      voter.approval_status === "pending") && (
                      <div className="flex flex-col sm:flex-row gap-2 justify-center">
                        <button
                          onClick={() =>
                            setConfirmAction({ type: "approve", voter })
                          }
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition text-xs sm:text-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() =>
                            setConfirmAction({ type: "decline", voter })
                          }
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition text-xs sm:text-sm"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredVoters.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-6 text-center text-gray-500"
                  >
                    No voters found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmAction.voter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-lg font-semibold mb-4">
              Confirm{" "}
              {confirmAction.type === "approve" ? "Approval" : "Decline"}
            </h2>
            <p className="mb-6 text-gray-700">
              Are you sure you want to{" "}
              <span className="font-bold">
                {confirmAction.type === "approve" ? "approve" : "decline"}
              </span>{" "}
              <span className="text-blue-600">
                {confirmAction.voter.fullname}
              </span>
              ?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() =>
                  setConfirmAction({ type: "approve", voter: null })
                }
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={confirmHandler}
                className={`px-4 py-2 rounded-lg text-white ${
                  confirmAction.type === "approve"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
