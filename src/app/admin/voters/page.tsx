"use client";
export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";

type Voter = {
  id: number;
  school_id: number;
  fullname: string;
  email: string;
  course: string | null;
  year_level: string | number | null;
  age: number | null;
  gender: string;
  role: string;
  approval_status: string | null;
  user_status: string | null;
};

// Add type for edit form
type EditVoterForm = {
  fullname: string;
  email: string;
  course: string | null;
  year_level: string | number | null;
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
    type: "approve" | "decline" | "delete";
    voter: Voter | null;
  }>({ type: "approve", voter: null });
  
  // Add state for edit modal
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    voter: Voter | null;
    formData: EditVoterForm;
  }>({ isOpen: false, voter: null, formData: {} as EditVoterForm });

  useEffect(() => {
    // Prevent background scrolling when modal is open
    if (confirmAction.voter || editModal.isOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [confirmAction.voter, editModal.isOpen]);

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

  // Add edit functions
  const handleEditClick = (voter: Voter): void => {
    setEditModal({
      isOpen: true,
      voter,
      formData: {
        fullname: voter.fullname,
        email: voter.email,
        course: voter.course,
        year_level: voter.year_level,
        age: voter.age,
        gender: voter.gender,
        role: voter.role,
        approval_status: voter.approval_status,
        user_status: voter.user_status,
      },
    });
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setEditModal(prev => ({
      ...prev,
      formData: {
        ...prev.formData,
        [name]: value || null,
      },
    }));
  };

  const handleEditSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!editModal.voter) return;

    try {
      const res = await fetch(`/api/users/${editModal.voter.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editModal.formData),
      });

      if (!res.ok) throw new Error("Failed to update voter");

      const updatedVoter = await res.json();
      setVoters(prev =>
        prev.map(v => (v.id === editModal.voter!.id ? { ...v, ...updatedVoter } : v))
      );

      setEditModal({ isOpen: false, voter: null, formData: {} as EditVoterForm });
    } catch (error) {
      console.error("Edit failed:", error);
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete voter");

      setVoters(prev => prev.filter(v => v.id !== id));
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const confirmHandler = async (): Promise<void> => {
    if (!confirmAction.voter) return;
    if (confirmAction.type === "approve") {
      await handleApprove(confirmAction.voter.id);
    } else if (confirmAction.type === "decline") {
      await handleDecline(confirmAction.voter.id);
    } else if (confirmAction.type === "delete") {
      await handleDelete(confirmAction.voter.id);
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

  const years = ["All", ...new Set(
    voters
      .map((v) => v.year_level)
      .filter((year): year is string | number => year !== null)
      .map((year) => String(year))
  )];

  const filteredVoters = voters.filter((v) => {
    // Only show voters, not admins
    const isVoter = v.role === "voter";
    
    const matchesSearch =
      v.fullname.toLowerCase().includes(search.toLowerCase()) ||
      v.email.toLowerCase().includes(search.toLowerCase());
    const matchesYear =
      yearFilter === "All" || String(v.year_level || "") === yearFilter;
      
    return isVoter && matchesSearch && matchesYear;
  });

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#791010] mb-6 bg-white rounded-xl p-4 md:p-6 shadow">
          👥 Voters Management
        </h1>

        {/* Search & Filters - Responsive grid */}
        <div className="mb-6 bg-white p-4 md:p-5 rounded-xl shadow-md grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="🔍 Search by name, email, or school ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 md:px-5 py-2 md:py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-[#791010] focus:border-[#791010] outline-none text-base transition-all text-gray-800"
            />
          </div>

          <div>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full px-3 md:px-5 py-2 md:py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-[#791010] focus:border-[#791010] outline-none text-base bg-white transition-all text-gray-800"
            >
              {years.map((yr) => (
                <option key={yr} value={yr} className="text-gray-800">
                  {yr === "All" ? "All Years" : 
                   yr === "1" ? "1st Year" :
                   yr === "2" ? "2nd Year" :
                   yr === "3" ? "3rd Year" :
                   yr === "4" ? "4th Year" :
                   `${yr} Year`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              onClick={handleExportCSV}
              className="w-full px-4 py-2 md:px-6 md:py-3 bg-[#791010] text-white rounded-xl shadow-lg hover:bg-[#5a0c0c] transition-all duration-200 font-medium flex items-center justify-center gap-2 text-sm md:text-base"
            >
              <span className="text-lg">📤</span> Export CSV
            </button>
          </div>
        </div>

        {/* Table - Made responsive without horizontal scrolling */}
        <div className="bg-white shadow-xl rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-hidden">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-gradient-to-r from-[#791010] to-[#5a0c0c] text-white">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold w-16" data-label="School ID">ID</th>
                  <th className="px-2 py-2 text-left font-semibold w-32" data-label="Full Name">Name</th>
                  <th className="px-2 py-2 text-left font-semibold w-32 hidden md:table-cell" data-label="Email">Email</th>
                  <th className="px-2 py-2 text-left font-semibold w-20 hidden lg:table-cell" data-label="Course">Course</th>
                  <th className="px-2 py-2 text-left font-semibold w-16 hidden xl:table-cell" data-label="Year">Year</th>
                  <th className="px-2 py-2 text-center font-semibold w-24" data-label="Approval">Approval</th>
                  <th className="px-2 py-2 text-center font-semibold w-24" data-label="Status">Status</th>
                  <th className="px-2 py-2 text-center font-semibold w-28" data-label="Actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVoters.map((voter, idx) => (
                  <tr
                    key={voter.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-all ${
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                    }`}
                  >
                    <td className="px-2 py-2 font-medium text-gray-800 whitespace-nowrap" data-label="School ID">{voter.school_id ?? "-"}</td>
                    <td className="px-2 py-2 font-medium text-gray-900 whitespace-nowrap" data-label="Full Name">
                      {voter.fullname}
                    </td>
                    <td className="px-2 py-2 text-gray-700 whitespace-nowrap hidden md:table-cell" data-label="Email">{voter.email}</td>
                    <td className="px-2 py-2 text-gray-700 hidden lg:table-cell whitespace-nowrap" data-label="Course">
                      {voter.course ?? "-"}
                    </td>
                    <td className="px-2 py-2 text-gray-700 hidden xl:table-cell whitespace-nowrap" data-label="Year">
                      {voter.year_level ?? "-"}
                    </td>

                    {/* Approval Status */}
                    <td className="px-2 py-2 text-center align-middle" data-label="Approval">
                      {voter.approval_status === "approved" ? (
                        <span className="bg-green-100 text-green-800 px-1 py-0.5 rounded-full text-xs font-bold whitespace-nowrap inline-flex items-center">
                          <span className="mr-0.5">✅</span>
                          <span className="hidden md:inline">Approved</span>
                        </span>
                      ) : voter.approval_status === "declined" ? (
                        <span className="bg-red-100 text-red-800 px-1 py-0.5 rounded-full text-xs font-bold whitespace-nowrap inline-flex items-center">
                          <span className="mr-0.5">❌</span>
                          <span className="hidden md:inline">Declined</span>
                        </span>
                      ) : (
                        <span className="bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded-full text-xs font-bold whitespace-nowrap inline-flex items-center">
                          <span className="mr-0.5">⏳</span>
                          <span className="hidden md:inline">Pending</span>
                        </span>
                      )}
                    </td>

                    {/* User Status */}
                    <td className="px-2 py-2 text-center align-middle" data-label="Status">
                      {voter.user_status === "active" ? (
                        <span className="bg-green-50 text-green-800 px-1 py-0.5 rounded-full text-xs font-bold whitespace-nowrap inline-flex items-center">
                          <span className="mr-0.5">🔵</span>
                          <span className="hidden md:inline">Active</span>
                        </span>
                      ) : voter.user_status === "inactive" ? (
                        <span className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded-full text-xs font-bold whitespace-nowrap inline-flex items-center">
                          <span className="mr-0.5">⚪</span>
                          <span className="hidden md:inline">Inactive</span>
                        </span>
                      ) : (
                        <span className="bg-purple-50 text-purple-800 px-1 py-0.5 rounded-full text-xs font-bold whitespace-nowrap inline-flex items-center">
                          <span className="mr-0.5">🎓</span>
                          <span className="hidden md:inline">Graduate</span>
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-2 py-2 text-center align-middle" data-label="Actions">
                      {(!voter.approval_status ||
                        voter.approval_status === "pending") && (
                        <div className="flex flex-col gap-0.5 justify-center mb-1">
                          <button
                            onClick={() =>
                              setConfirmAction({ type: "approve", voter })
                            }
                            className="px-1.5 py-1 bg-green-600 text-white rounded shadow hover:bg-green-700 transition-all duration-200 text-xs font-medium flex items-center justify-center gap-0.5"
                          >
                            <span className="text-xs">✓</span> <span className="hidden sm:inline">Approve</span>
                          </button>
                          <button
                            onClick={() =>
                              setConfirmAction({ type: "decline", voter })
                            }
                            className="px-1.5 py-1 bg-red-600 text-white rounded shadow hover:bg-red-700 transition-all duration-200 text-xs font-medium flex items-center justify-center gap-0.5"
                          >
                            <span className="text-xs">✗</span> <span className="hidden sm:inline">Decline</span>
                          </button>
                        </div>
                      )}
                      
                      {/* Edit and Delete Actions */}
                      <div className="flex flex-col gap-0.5 justify-center">
                        <button
                          onClick={() => handleEditClick(voter)}
                          className="px-1.5 py-1 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition-all duration-200 text-xs font-medium flex items-center justify-center gap-0.5"
                        >
                          <span className="text-xs">✏️</span> <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                          onClick={() => setConfirmAction({ type: "delete", voter })}
                          className="px-1.5 py-1 bg-gray-600 text-white rounded shadow hover:bg-gray-700 transition-all duration-200 text-xs font-medium flex items-center justify-center gap-0.5"
                        >
                          <span className="text-xs">🗑️</span> <span className="hidden sm:inline">Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredVoters.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 md:py-12 text-center text-gray-500"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <div className="text-4xl md:text-5xl mb-3 md:mb-4">📊</div>
                        <h3 className="text-lg md:text-xl font-semibold text-gray-700 mb-1 md:mb-2">No voters found</h3>
                        <p className="text-gray-500 text-sm md:text-base">Try adjusting your search or filter criteria</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {confirmAction.voter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Blurred background */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
          
          {/* Modal */}
          <div className="relative bg-white p-6 rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-gray-200 z-10 max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-4">
              <div className="text-3xl mb-3">
                {confirmAction.type === "approve" ? "✅" : 
                 confirmAction.type === "decline" ? "❌" : "🗑️"}
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                {confirmAction.type === "delete" 
                  ? "Confirm Delete" 
                  : `Confirm ${confirmAction.type === "approve" ? "Approval" : "Decline"}`}
              </h2>
            </div>
            
            <p className="mb-6 text-gray-700 text-center text-sm">
              {confirmAction.type === "delete" ? (
                <>
                  Are you sure you want to delete <span className="font-bold text-[#791010]">
                    {confirmAction.voter.fullname}
                  </span>? This action cannot be undone.
                </>
              ) : (
                <>
                  Are you sure you want to <span className="font-bold">
                    {confirmAction.type === "approve" ? "approve" : "decline"}
                  </span>{" "}
                  <span className="font-bold text-[#791010]">
                    {confirmAction.voter.fullname}
                  </span>?
                </>
              )}
            </p>
            
            <div className="flex justify-center gap-3">
              <button
                onClick={() =>
                  setConfirmAction({ type: "approve", voter: null })
                }
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-all duration-200 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmHandler}
                className={`px-4 py-2 rounded-lg text-white font-medium transition-all duration-200 text-sm ${
                  confirmAction.type === "approve"
                    ? "bg-green-600 hover:bg-green-700 shadow hover:shadow-green-200"
                    : confirmAction.type === "decline"
                    ? "bg-red-600 hover:bg-red-700 shadow hover:shadow-red-200"
                    : "bg-gray-600 hover:bg-gray-700 shadow hover:shadow-gray-200"
                }`}
              >
                {confirmAction.type === "delete" ? "Delete" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal.isOpen && editModal.voter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Blurred background */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
          
          {/* Modal */}
          <div className="relative bg-white p-6 rounded-2xl shadow-2xl max-w-lg w-full mx-4 border border-gray-200 z-10 max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Edit Voter Information
              </h2>
              <p className="text-gray-600">Editing: {editModal.voter.fullname}</p>
            </div>
            
            <form onSubmit={handleEditSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="fullname"
                    value={editModal.formData.fullname}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#791010] focus:border-[#791010] outline-none text-gray-800"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={editModal.formData.email}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#791010] focus:border-[#791010] outline-none text-gray-800"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Course
                  </label>
                  <input
                    type="text"
                    name="course"
                    value={editModal.formData.course || ""}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#791010] focus:border-[#791010] outline-none text-gray-800"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Year Level
                  </label>
                  <input
                    type="text"
                    name="year_level"
                    value={editModal.formData.year_level || ""}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#791010] focus:border-[#791010] outline-none text-gray-800"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Age
                  </label>
                  <input
                    type="number"
                    name="age"
                    value={editModal.formData.age || ""}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#791010] focus:border-[#791010] outline-none text-gray-800"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gender
                  </label>
                  <select
                    name="gender"
                    value={editModal.formData.gender}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#791010] focus:border-[#791010] outline-none text-gray-800"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    name="role"
                    value={editModal.formData.role}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#791010] focus:border-[#791010] outline-none text-gray-800"
                  >
                    <option value="voter">Voter</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Approval Status
                  </label>
                  <select
                    name="approval_status"
                    value={editModal.formData.approval_status || ""}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#791010] focus:border-[#791010] outline-none text-gray-800"
                  >
                    <option value="">Select Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="declined">Declined</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    User Status
                  </label>
                  <select
                    name="user_status"
                    value={editModal.formData.user_status || ""}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#791010] focus:border-[#791010] outline-none text-gray-800"
                  >
                    <option value="">Select Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="graduate">Graduate</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditModal({ isOpen: false, voter: null, formData: {} as EditVoterForm })}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#791010] text-white rounded-lg shadow hover:bg-[#5a0c0c] font-medium transition-all duration-200"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
