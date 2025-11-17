"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

type Candidate = {
  id: number;
  fullname: string;
  position_name: string;
  election_title: string;
  description: string;
  photo_url: string;
  partylist: string;
  coc_file_url: string;
  status: string;
  created_at: string;
};

// Add type for view modal
type ViewCandidate = Candidate | null;

// Add type for notifications
type Notification = {
  id: number;
  message: string;
  type: "success" | "error" | "info" | "warning";
  timestamp: number;
};

export default function AdminCandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [electionFilter, setElectionFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalFile, setModalFile] = useState<string | null>(null);
  const [modalIsPdf, setModalIsPdf] = useState(false);
  
  // Add state for view candidate modal
  const [viewCandidate, setViewCandidate] = useState<ViewCandidate>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Add state for edit status modal
  const [isEditStatusModalOpen, setIsEditStatusModalOpen] = useState(false);
  const [candidateToEdit, setCandidateToEdit] = useState<Candidate | null>(null);

  // Add state for notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch candidates
  useEffect(() => {
    fetch("/api/candidates")
      .then((res) => res.json())
      .then((data) => {
        setCandidates(data);
        setFilteredCandidates(data);
      });
  }, []);

  // Notification cleanup effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (notifications.length > 0) {
        setNotifications(prev => prev.slice(1));
      }
    }, 5000); // Auto-remove notifications after 5 seconds
    
    return () => clearTimeout(timer);
  }, [notifications]);

  // Filters & Search
  useEffect(() => {
    let filtered = [...candidates];

    if (search.trim() !== "") {
      const query = search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.fullname.toLowerCase().includes(query) ||
          c.partylist?.toLowerCase().includes(query) ||
          c.position_name.toLowerCase().includes(query) ||
          c.election_title.toLowerCase().includes(query) ||
          c.status.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    if (positionFilter !== "all") {
      filtered = filtered.filter((c) => c.position_name === positionFilter);
    }

    if (electionFilter !== "all") {
      filtered = filtered.filter((c) => c.election_title === electionFilter);
    }

    setFilteredCandidates(filtered);
    setCurrentPage(1); // reset pagination when filters change
  }, [search, statusFilter, positionFilter, electionFilter, candidates]);

  // Add function to show notifications
  const showNotification = (message: string, type: Notification["type"]) => {
    const newNotification: Notification = {
      id: Date.now(),
      message,
      type,
      timestamp: Date.now()
    };
    
    setNotifications(prev => [...prev, newNotification]);
  };

  const handleStatusChange = async (id: number, status: string) => {
    // Attempting to update candidate status
    
    try {
      const res = await fetch("/api/candidates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });

      // API response received

      if (res.ok) {
        const updated = await res.json();
        // Updated candidate data
        
        setCandidates((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: updated.status } : c))
        );
        // Also update the view candidate if it's the same one
        if (viewCandidate && viewCandidate.id === id) {
          setViewCandidate({ ...viewCandidate, status: updated.status });
        }
        // Close the edit status modal
        setIsEditStatusModalOpen(false);
        // Show success notification
        showNotification(`Candidate status updated to ${status}`, "success");
      } else {
        // Handle error responses
        let errorMessage = "Unknown error";
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || `HTTP ${res.status}: ${res.statusText}`;
        } catch (parseError) {
          errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        }
        console.error("Failed to update status:", errorMessage);
        showNotification(`Failed to update status: ${errorMessage}`, "error");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      showNotification("An error occurred while updating the status. Please try again.", "error");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this candidate?")) return;

    const res = await fetch(`/api/candidates?id=${id}`, { method: "DELETE" });

    if (res.ok) {
      setCandidates((prev) => prev.filter((c) => c.id !== id));
      setFilteredCandidates((prev) => prev.filter((c) => c.id !== id));
      showNotification("Candidate deleted successfully", "success");
    } else {
      showNotification("Failed to delete candidate.", "error");
    }
  };

  const openModal = (fileUrl: string) => {
    setModalFile(fileUrl);
    setModalIsPdf(/\.pdf$/i.test(fileUrl));
    setModalOpen(true);
  };

  // Add function to view candidate details
  const handleViewCandidate = (candidate: Candidate) => {
    setViewCandidate(candidate);
    setIsViewModalOpen(true);
  };

  // Add function to open edit status modal
  const openEditStatusModal = (candidate: Candidate) => {
    setCandidateToEdit(candidate);
    setIsEditStatusModalOpen(true);
  };

  // Unique filter options
  const uniquePositions = Array.from(
    new Set(candidates.map((c) => c.position_name))
  );
  const uniqueElections = Array.from(
    new Set(candidates.map((c) => c.election_title))
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredCandidates.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredCandidates.slice(
    startIdx,
    startIdx + itemsPerPage
  );

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (modalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [modalOpen]);

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Notifications */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 ${
                notification.type === "success"
                  ? "bg-green-500 text-white"
                  : notification.type === "error"
                  ? "bg-red-500 text-white"
                  : notification.type === "warning"
                  ? "bg-yellow-500 text-white"
                  : "bg-blue-500 text-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{notification.message}</span>
                <button
                  onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
                  className="ml-4 text-white hover:text-gray-200 font-bold"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Header */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#791010] mb-6 md:mb-8 bg-white rounded-xl p-4 md:p-6 shadow">
          🗳️ Candidates Management
        </h1>

        {/* Search & Filters - Responsive grid */}
        <div className="mb-6 md:mb-8 bg-white p-4 md:p-5 rounded-xl shadow-md grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
          <div className="md:col-span-4">
            <input
              type="text"
              placeholder="🔍 Search by name, position, election, partylist, or status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 md:px-5 py-2 md:py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-[#791010] focus:border-[#791010] outline-none text-base transition-all text-gray-800"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 md:px-5 py-2 md:py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-[#791010] focus:border-[#791010] outline-none text-base bg-white transition-all text-gray-800"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="declined">Declined</option>
            </select>
          </div>

          <div>
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="w-full px-3 md:px-5 py-2 md:py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-[#791010] focus:border-[#791010] outline-none text-base bg-white transition-all text-gray-800"
            >
              <option value="all">All Positions</option>
              {uniquePositions.map((pos) => (
                <option key={pos} value={pos} className="text-gray-800">
                  {pos}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={electionFilter}
              onChange={(e) => setElectionFilter(e.target.value)}
              className="w-full px-3 md:px-5 py-2 md:py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-[#791010] focus:border-[#791010] outline-none text-base bg-white transition-all text-gray-800"
            >
              <option value="all">All Elections</option>
              {uniqueElections.map((el) => (
                <option key={el} value={el} className="text-gray-800">
                  {el}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table - Made responsive */}
        <div className="overflow-x-auto bg-white shadow-xl rounded-xl border border-gray-200">
          <table className="w-full border-collapse text-sm min-w-full responsive-table">
            <thead className="bg-gradient-to-r from-[#791010] to-[#5a0c0c] text-white">
              <tr>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold min-w-32 md:min-w-40">Name</th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold w-24 md:w-32">Position</th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold w-20 md:w-24">Partylist</th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-center font-semibold w-20 md:w-24">Status</th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-center font-semibold w-28 md:w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((c, idx) => (
                <tr
                  key={c.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-all ${
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                  }`}
                >
                  <td className="px-3 md:px-4 py-2 md:py-3 font-medium text-gray-900 whitespace-nowrap" data-label="Name">
                    {c.fullname}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-gray-700 whitespace-nowrap" data-label="Position">{c.position_name}</td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-gray-700 whitespace-nowrap" data-label="Partylist">{c.partylist || "—"}</td>
                  <td 
                    className="px-3 md:px-4 py-2 md:py-3 text-center align-middle cursor-pointer hover:opacity-80" 
                    data-label="Status"
                    onClick={() => openEditStatusModal(c)}
                  >
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                        c.status === "approved"
                          ? "bg-green-100 text-green-800"
                          : c.status === "declined"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {c.status === "approved" ? "Approved" : 
                       c.status === "declined" ? "Declined" : "Pending"}
                    </span>
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-center align-middle" data-label="Actions">
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() => handleViewCandidate(c)}
                        className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-all duration-200 text-xs font-medium flex items-center justify-center"
                        title="View candidate details"
                      >
                        <span className="text-xs">👁️</span>
                      </button>
                      <button
                        onClick={() => openEditStatusModal(c)}
                        className="px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-all duration-200 text-xs font-medium flex items-center justify-center"
                        title="Edit candidate status"
                      >
                        <span className="text-xs">✏️</span>
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-all duration-200 text-xs font-medium flex items-center justify-center"
                        title="Delete candidate"
                      >
                        <span className="text-xs">🗑️</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {currentItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 md:py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="text-4xl md:text-5xl mb-3 md:mb-4">📊</div>
                      <h3 className="text-lg md:text-xl font-semibold text-gray-700 mb-1 md:mb-2">No candidates found</h3>
                      <p className="text-gray-500 text-sm md:text-base">Try adjusting your search or filter criteria</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination - Responsive */}
        {filteredCandidates.length > itemsPerPage && (
          <div className="flex flex-col sm:flex-row justify-between items-center mt-4 md:mt-6 text-sm text-gray-600 bg-white p-3 md:p-4 rounded-xl shadow">
            <span className="mb-2 sm:mb-0 text-xs md:text-sm">
              Showing {startIdx + 1}–
              {Math.min(startIdx + itemsPerPage, filteredCandidates.length)} of{" "}
              {filteredCandidates.length} candidates
            </span>
            <div className="flex gap-1 md:gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`px-2 py-1 md:px-3 md:py-1 rounded-lg border text-xs md:text-sm ${
                  currentPage === 1
                    ? "text-gray-400 cursor-not-allowed"
                    : "hover:bg-gray-100"
                }`}
              >
                Prev
              </button>
              <span className="px-2 py-1 md:px-3 md:py-1 text-xs md:text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className={`px-2 py-1 md:px-3 md:py-1 rounded-lg border text-xs md:text-sm ${
                  currentPage === totalPages
                    ? "text-gray-400 cursor-not-allowed"
                    : "hover:bg-gray-100"
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Candidate Modal - Responsive */}
      {isViewModalOpen && viewCandidate && (
        <div className="modal-overlay flex items-center justify-center p-2">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
          <div className="modal-content relative bg-gradient-to-br from-white/90 via-pink-50 to-red-50 p-4 md:p-6 rounded-2xl shadow-2xl w-full max-w-3xl mx-2 md:mx-4 border border-gray-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#791010] to-[#b11c1c] rounded-lg p-4 -m-4 mb-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-1">
                    Candidate Details
                  </h2>
                  <p className="text-red-100 text-sm">
                    Detailed information about the candidate
                  </p>
                </div>
                <div className="flex justify-end">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    viewCandidate.status === "approved"
                      ? "bg-green-100 text-green-800"
                      : viewCandidate.status === "declined"
                      ? "bg-red-100 text-red-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}>
                    {viewCandidate.status === "approved" ? "✅ Approved" : 
                     viewCandidate.status === "declined" ? "❌ Declined" : "⏳ Pending"}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
              {/* Left Column - Profile Card */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl p-5 flex flex-col items-center shadow-sm border border-gray-200/50">
                  <div className="relative mb-4">
                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg">
                      {viewCandidate.photo_url ? (
                        viewCandidate.photo_url.startsWith('/uploads/') ? (
                          // Local uploaded image - use img tag
                          <img
                            src={viewCandidate.photo_url}
                            alt={viewCandidate.fullname}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          // Cloudinary image - use regular img tag to avoid Next.js optimization conflicts
                          <img
                            src={viewCandidate.photo_url}
                            alt={viewCandidate.fullname}
                            className="object-cover w-full h-full"
                          />
                        )
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500">
                          No Photo
                        </div>
                      )}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 text-center mb-1">
                    {viewCandidate.fullname}
                  </h3>
                  <p className="text-gray-600 text-center text-base font-medium mb-1">
                    {viewCandidate.position_name}
                  </p>
                  <p className="text-[#791010] text-center text-sm font-semibold mb-3">
                    {viewCandidate.partylist || "No Partylist"}
                  </p>
                  <div className="w-full border-t border-gray-200/50 pt-3 mt-2">
                    <div className="text-center text-xs text-gray-500">
                      Registered for
                    </div>
                    <div className="text-center font-medium text-gray-800 truncate">
                      {viewCandidate.election_title}
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 bg-white border border-gray-200/50 rounded-xl p-4 shadow-sm">
                  <h4 className="font-bold text-gray-800 mb-3 text-center border-b border-gray-200/50 pb-2">Registration Info</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Registration Date:</span>
                      <span className="font-medium text-gray-800">
                        {new Date(viewCandidate.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Registration Status:</span>
                      <span className={`font-medium ${
                        viewCandidate.status === "approved"
                          ? "text-green-600"
                          : viewCandidate.status === "declined"
                          ? "text-red-600"
                          : "text-yellow-600"
                      }`}>
                        {viewCandidate.status.charAt(0).toUpperCase() + viewCandidate.status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Right Column - Details */}
              <div className="lg:col-span-2">
                <div className="bg-white border border-gray-200/50 rounded-xl p-5 shadow-sm mb-4">
                  <h4 className="font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200/50">Candidate Information</h4>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                      </label>
                      <div className="px-4 py-3 bg-gray-50 rounded-lg text-gray-800 text-sm min-h-[80px]">
                        {viewCandidate.description || "No description provided by the candidate."}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Position
                        </label>
                        <div className="px-4 py-2.5 bg-gray-50 rounded-lg text-gray-800 text-sm">
                          {viewCandidate.position_name}
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Partylist
                        </label>
                        <div className="px-4 py-2.5 bg-gray-50 rounded-lg text-gray-800 text-sm">
                          {viewCandidate.partylist || "No Partylist"}
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Election
                      </label>
                      <div className="px-4 py-2.5 bg-gray-50 rounded-lg text-gray-800 text-sm">
                        {viewCandidate.election_title}
                      </div>
                    </div>
                  </div>
                </div>
                
                {viewCandidate.coc_file_url && (
                  <div className="bg-white border border-gray-200/50 rounded-xl p-5 shadow-sm mb-4">
                    <h4 className="font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200/50">Supporting Documents</h4>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => openModal(viewCandidate.coc_file_url)}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-all duration-200 text-sm font-medium flex items-center justify-center gap-2"
                      >
                        <span>👁️</span>
                        <span>Preview COC</span>
                      </button>
                      <a
                        href={viewCandidate.coc_file_url}
                        download
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition-all duration-200 text-sm font-medium flex items-center justify-center gap-2 text-center"
                      >
                        <span>⬇️</span>
                        <span>Download COC</span>
                      </a>
                    </div>
                  </div>
                )}
                
                <div className="bg-white border border-gray-200/50 rounded-xl p-5 shadow-sm">
                  <h4 className="font-bold text-gray-800 mb-3 pb-2 border-b border-gray-200/50">Actions</h4>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => {
                        setIsViewModalOpen(false);
                        openEditStatusModal(viewCandidate);
                      }}
                      className="px-4 py-2 bg-[#791010] text-white rounded-lg shadow hover:bg-[#5a0c0c] transition-all duration-200 text-sm font-medium flex items-center gap-2"
                    >
                      <span>✏️</span>
                      <span>Update Status</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsViewModalOpen(false);
                        handleDelete(viewCandidate.id);
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition-all duration-200 text-sm font-medium flex items-center gap-2"
                    >
                      <span>🗑️</span>
                      <span>Delete Candidate</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end pt-3 border-t border-gray-200/50">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-all duration-200 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Status Modal - Responsive */}
      {isEditStatusModalOpen && candidateToEdit && (
        <div className="modal-overlay flex items-center justify-center p-2">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
          <div className="modal-content relative bg-white p-4 md:p-6 rounded-2xl shadow-2xl w-full max-w-md mx-2 md:mx-4 border border-gray-200">
            <div className="text-center mb-4 md:mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-2">
                Update Candidate Status
              </h2>
              <p className="text-gray-600 text-sm md:text-base">
                {candidateToEdit.fullname}
              </p>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm md:text-base font-medium text-gray-700 mb-2">
                Select New Status
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleStatusChange(candidateToEdit.id, "pending")}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    candidateToEdit.status === "pending"
                      ? "bg-yellow-500 text-white"
                      : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                  }`}
                >
                  ⏳ Pending
                </button>
                <button
                  onClick={() => handleStatusChange(candidateToEdit.id, "approved")}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    candidateToEdit.status === "approved"
                      ? "bg-green-500 text-white"
                      : "bg-green-100 text-green-800 hover:bg-green-200"
                  }`}
                >
                  ✅ Approved
                </button>
                <button
                  onClick={() => handleStatusChange(candidateToEdit.id, "declined")}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    candidateToEdit.status === "declined"
                      ? "bg-red-500 text-white"
                      : "bg-red-100 text-red-800 hover:bg-red-200"
                  }`}
                >
                  ❌ Declined
                </button>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 md:gap-3">
              <button
                onClick={() => setIsEditStatusModalOpen(false)}
                className="px-3 py-1.5 md:px-4 md:py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-all duration-200 text-sm md:text-base"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal - Responsive */}
      {modalOpen && modalFile && (
        <div className="modal-overlay flex items-center justify-center p-2">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
          <div className="modal-content relative bg-white p-3 md:p-6 rounded-2xl shadow-2xl w-full max-w-4xl mx-2 md:mx-4 border border-gray-200">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-2 right-2 md:top-3 md:right-3 text-gray-500 hover:text-gray-700 text-xl md:text-2xl font-bold"
            >
              ×
            </button>

            {modalIsPdf ? (
              <iframe
                src={modalFile}
                className="w-full h-[400px] md:h-[600px] border rounded-lg"
                title="PDF Preview"
              />
            ) : (
              <Image
                src={modalFile}
                alt="Preview"
                width={800}
                height={600}
                className="w-full h-auto max-h-[400px] md:max-h-[600px] object-contain rounded-lg"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}