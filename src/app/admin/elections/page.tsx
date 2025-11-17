"use client";

import React, { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { FaTrash, FaEdit } from "react-icons/fa";

type Election = {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  filing_start_time: string | null;
  filing_end_time: string | null;
  status: string;
  created_at: string;
};

type Partylist = {
  id: number;
  election_id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

// Add a function to compute the current status
const computeStatus = (election: Election) => {
  const now = new Date();
  const filingStart = election.filing_start_time
    ? new Date(election.filing_start_time)
    : null;
  const filingEnd = election.filing_end_time 
    ? new Date(election.filing_end_time) 
    : null;
  const start = new Date(election.start_time);
  const end = new Date(election.end_time);

  if (filingStart && now >= filingStart && filingEnd && now <= filingEnd)
    return "filing";
  if (now >= start && now <= end) return "ongoing";
  if (now > end) return "closed";
  return "upcoming";
};

export default function ElectionsPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [partylists, setPartylists] = useState<Partylist[]>([]);
  const [isElectionModalOpen, setIsElectionModalOpen] = useState(false);
  const [isPositionModalOpen, setIsPositionModalOpen] = useState(false);
  const [isPartylistModalOpen, setIsPartylistModalOpen] = useState(false);
  const [editingElection, setEditingElection] = useState<Election | null>(null);
  const [editingPartylist, setEditingPartylist] = useState<Partylist | null>(null);
  const [selectedElectionForPartylist, setSelectedElectionForPartylist] = useState<Election | null>(null);

  // election fields
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [filingStartTime, setFilingStartTime] = useState("");
  const [filingEndTime, setFilingEndTime] = useState("");
  const [loading, setLoading] = useState(false);

  // position fields
  const [selectedElectionId, setSelectedElectionId] = useState("");
  const [positionName, setPositionName] = useState("");
  const [posLoading, setPosLoading] = useState(false);

  // partylist fields
  const [partylistName, setPartylistName] = useState("");
  const [partylistDescription, setPartylistDescription] = useState("");
  const [partylistLoading, setPartylistLoading] = useState(false);

  // Fetch elections
  const refreshElections = async () => {
    const res = await fetch("/api/elections");
    if (res.ok) {
      const data = await res.json();
      setElections(data);
    }
  };

  // Fetch partylists for an election
  const refreshPartylists = async (electionId: number) => {
    const res = await fetch(`/api/partylists?election_id=${electionId}`);
    if (res.ok) {
      const data = await res.json();
      setPartylists(data);
    }
  };

  useEffect(() => {
    refreshElections();
    const interval = setInterval(refreshElections, 30000); // Refresh every 30 seconds instead of 60
    return () => clearInterval(interval);
  }, []);

  // Format for datetime-local input - handle timezone properly
  const formatForInput = (dateStr: string | null) => {
    if (!dateStr) return "";
    
    try {
      // Since we store times as the user selected them (without timezone conversion),
      // we can directly use the stored string for the input
      return dateStr.replace(' ', 'T').substring(0, 16);
    } catch (error) {
      console.error("Error formatting date for input:", error);
      return "";
    }
  };

  // Save election - ensure times are properly formatted
  const handleSaveElection = async () => {
    setLoading(true);

    // Format the times properly for the backend
    // We store the exact time the user selected without timezone conversion
    const formatForStorage = (localTime: string) => {
      if (!localTime) return null;
      // Simply return the local time string as-is
      // This preserves the exact time the user selected
      return localTime;
    };

    const payload = {
      title,
      start_time: formatForStorage(startTime),
      end_time: formatForStorage(endTime),
      filing_start_time: formatForStorage(filingStartTime),
      filing_end_time: formatForStorage(filingEndTime),
    };

    const res = await fetch(
      editingElection
        ? `/api/elections/${editingElection.id}`
        : "/api/elections",
      {
        method: editingElection ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (res.ok) {
      await refreshElections();
      closeElectionModal();
    }
    setLoading(false);
  };

  // Save position
  const handleSavePosition = async () => {
    if (!selectedElectionId || !positionName) return;
    setPosLoading(true);

    const res = await fetch("/api/positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        election_id: Number(selectedElectionId),
        name: positionName,
      }),
    });

    if (res.ok) {
      setSelectedElectionId("");
      setPositionName("");
      setIsPositionModalOpen(false);
    }

    setPosLoading(false);
  };

  // Save partylist
  const handleSavePartylist = async () => {
    if (!selectedElectionForPartylist || !partylistName) return;
    setPartylistLoading(true);

    const method = editingPartylist ? "PUT" : "POST";
    const url = editingPartylist 
      ? `/api/partylists/${editingPartylist.id}` 
      : "/api/partylists";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        election_id: selectedElectionForPartylist.id,
        name: partylistName,
        description: partylistDescription || null,
      }),
    });

    if (res.ok) {
      setPartylistName("");
      setPartylistDescription("");
      setIsPartylistModalOpen(false);
      setEditingPartylist(null);
      if (selectedElectionForPartylist) {
        refreshPartylists(selectedElectionForPartylist.id);
      }
    }

    setPartylistLoading(false);
  };

  // Delete election
  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this election?")) return;
    const res = await fetch(`/api/elections/${id}`, { method: "DELETE" });
    if (res.ok) {
      setElections(elections.filter((e) => e.id !== id));
    }
  };

  // Delete partylist
  const handleDeletePartylist = async (id: number) => {
    if (!confirm("Are you sure you want to delete this partylist?")) return;
    const res = await fetch(`/api/partylists/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (selectedElectionForPartylist) {
        refreshPartylists(selectedElectionForPartylist.id);
      }
    }
  };

  // Edit election
  const handleEdit = (election: Election) => {
    setEditingElection(election);
    setTitle(election.title);
    setStartTime(formatForInput(election.start_time));
    setEndTime(formatForInput(election.end_time));
    setFilingStartTime(formatForInput(election.filing_start_time));
    setFilingEndTime(formatForInput(election.filing_end_time));
    setIsElectionModalOpen(true);
  };

  // Edit partylist
  const handleEditPartylist = (partylist: Partylist) => {
    setEditingPartylist(partylist);
    setPartylistName(partylist.name);
    setPartylistDescription(partylist.description || "");
    setIsPartylistModalOpen(true);
  };

  // Open partylist modal for an election
  const handleOpenPartylistModal = (election: Election) => {
    setSelectedElectionForPartylist(election);
    refreshPartylists(election.id);
    setIsPartylistModalOpen(true);
  };

  const closeElectionModal = () => {
    setIsElectionModalOpen(false);
    setEditingElection(null);
    setTitle("");
    setStartTime("");
    setEndTime("");
    setFilingStartTime("");
    setFilingEndTime("");
  };

  const closePartylistModal = () => {
    setIsPartylistModalOpen(false);
    setEditingPartylist(null);
    setPartylistName("");
    setPartylistDescription("");
    setSelectedElectionForPartylist(null);
  };

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isElectionModalOpen || isPositionModalOpen || isPartylistModalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isElectionModalOpen, isPositionModalOpen, isPartylistModalOpen]);

  // Add this missing function
  const openElectionModal = () => {
    setEditingElection(null);
    setTitle("");
    setStartTime("");
    setEndTime("");
    setFilingStartTime("");
    setFilingEndTime("");
    setIsElectionModalOpen(true);
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#791010]">
              🗳️ Elections Management
            </h1>
            <p className="text-gray-600 mt-1">
              Manage elections, positions, and partylists
            </p>
          </div>
          <button
            onClick={openElectionModal}
            className="px-4 py-2 bg-[#791010] text-white rounded-lg shadow hover:bg-[#5a0c0c] font-medium transition-all duration-200"
          >
            + Create Election
          </button>
        </div>

        {/* Create Position Button */}
        <div className="mb-6">
          <button
            onClick={() => setIsPositionModalOpen(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg shadow hover:bg-purple-700 font-medium transition-all duration-200"
          >
            + Create Position
          </button>
        </div>

        {/* Table - Made responsive */}
        <div className="overflow-x-auto bg-white shadow-xl rounded-xl border border-gray-200">
          <table className="w-full border-collapse text-sm min-w-full responsive-table">
            <thead className="bg-gradient-to-r from-[#791010] to-[#5a0c0c] text-white">
              <tr>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold min-w-32 md:min-w-40">Title</th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold w-32 md:w-48">Filing Period</th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-left font-semibold w-32 md:w-48">Voting Period</th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-center font-semibold w-24 md:w-32">Status</th>
                <th className="px-3 md:px-4 py-2 md:py-3 text-center font-semibold w-36 md:w-48">Actions</th>
              </tr>
            </thead>
            <tbody>
              {elections.map((e, idx) => (
                <tr
                  key={e.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-all ${
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                  }`}
                >
                  <td className="px-3 md:px-4 py-2 md:py-3 font-medium text-gray-900" data-label="Title">{e.title}</td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-gray-700" data-label="Filing Period">
                    {e.filing_start_time
                      ? `${format(
                          parseISO(e.filing_start_time),
                          "PPP"
                        )} - ${format(parseISO(e.filing_end_time!), "PPP")}`
                      : "N/A"}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-gray-700" data-label="Voting Period">
                    {format(parseISO(e.start_time), "PPP")} -{" "}
                    {format(parseISO(e.end_time), "PPP")}
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-center align-middle" data-label="Status">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap inline-flex items-center ${
                        computeStatus(e) === "ongoing"
                          ? "bg-green-100 text-green-800"
                          : computeStatus(e) === "upcoming"
                          ? "bg-blue-100 text-blue-800"
                          : computeStatus(e) === "filing"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      {computeStatus(e) === "ongoing" ? "🟢 Ongoing" : 
                       computeStatus(e) === "upcoming" ? "🔵 Upcoming" : 
                       computeStatus(e) === "filing" ? "🟡 Filing" : "⚪ Ended"}
                    </span>
                  </td>
                  <td className="px-3 md:px-4 py-2 md:py-3 text-center align-middle" data-label="Actions">
                    <div className="flex flex-col sm:flex-row gap-1 justify-center">
                      <button
                        onClick={() => handleOpenPartylistModal(e)}
                        className="px-2 py-1 md:px-3 md:py-1.5 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition-all duration-200 text-xs font-medium flex items-center justify-center gap-1"
                      >
                        <span className="hidden sm:inline">Partylists</span>
                        <span className="sm:hidden">P</span>
                      </button>
                      <button
                        onClick={() => handleEdit(e)}
                        className="px-2 py-1 md:px-3 md:py-1.5 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-all duration-200 text-xs font-medium flex items-center justify-center gap-1"
                      >
                        <FaEdit size={10} className="md:w-3 md:h-3" /> <span className="hidden sm:inline">Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(e.id)}
                        className="px-2 py-1 md:px-3 md:py-1.5 bg-gray-600 text-white rounded-lg shadow hover:bg-gray-700 transition-all duration-200 text-xs font-medium flex items-center justify-center gap-1"
                      >
                        <FaTrash size={10} className="md:w-3 md:h-3" /> <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {elections.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 md:py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="text-4xl md:text-5xl mb-3 md:mb-4">📊</div>
                      <h3 className="text-lg md:text-xl font-semibold text-gray-700 mb-1 md:mb-2">No elections found</h3>
                      <p className="text-gray-500 text-sm md:text-base">Create your first election to get started</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Election Modal */}
        {(isElectionModalOpen || isPositionModalOpen || isPartylistModalOpen) && (
          <div className="modal-overlay flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
          </div>
        )}

        {isElectionModalOpen && (
          <div className="modal-overlay flex items-center justify-center">
            <div className="modal-content relative bg-white p-6 rounded-2xl shadow-2xl max-w-lg w-full mx-4 border border-gray-200">
              <div className="text-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  {editingElection ? "Edit Election" : "Create Election"}
                </h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    placeholder="Election Title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#791010] focus:border-[#791010] outline-none text-gray-800"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filing Start
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#791010] focus:border-[#791010] outline-none text-gray-800"
                    value={filingStartTime}
                    onChange={(e) => setFilingStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filing End
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#791010] focus:border-[#791010] outline-none text-gray-800"
                    value={filingEndTime}
                    onChange={(e) => setFilingEndTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Election Start
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#791010] focus:border-[#791010] outline-none text-gray-800"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Election End
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#791010] focus:border-[#791010] outline-none text-gray-800"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={closeElectionModal}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveElection}
                  disabled={loading}
                  className="px-4 py-2 bg-[#791010] text-white rounded-lg shadow hover:bg-[#5a0c0c] font-medium transition-all duration-200 disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Position Modal */}
        {isPositionModalOpen && (
          <div className="modal-overlay flex items-center justify-center">
            <div className="modal-content relative bg-white p-6 rounded-2xl shadow-2xl max-w-lg w-full mx-4 border border-gray-200">
              <div className="text-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  Create Position
                </h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Election
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-purple-600 outline-none text-gray-800"
                    value={selectedElectionId}
                    onChange={(e) => setSelectedElectionId(e.target.value)}
                  >
                    <option value="">-- Select Election --</option>
                    {elections.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Position Name
                  </label>
                  <input
                    type="text"
                    placeholder="Position Name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-purple-600 outline-none text-gray-800"
                    value={positionName}
                    onChange={(e) => setPositionName(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setIsPositionModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePosition}
                  disabled={posLoading}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg shadow hover:bg-purple-700 font-medium transition-all duration-200 disabled:opacity-50"
                >
                  {posLoading ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Partylist Modal */}
        {isPartylistModalOpen && selectedElectionForPartylist && (
          <div className="modal-overlay flex items-center justify-center">
            <div className="modal-content relative bg-white p-6 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 border border-gray-200">
              <div className="text-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  Manage Partylists for &quot;{selectedElectionForPartylist.title}&quot;
                </h2>
              </div>
              
              {/* Partylist Form */}
              <div className="space-y-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-800">
                  {editingPartylist ? "Edit Partylist" : "Add New Partylist"}
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Partylist Name
                  </label>
                  <input
                    type="text"
                    placeholder="Partylist Name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-green-600 outline-none text-gray-800"
                    value={partylistName}
                    onChange={(e) => setPartylistName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    placeholder="Partylist Description"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-green-600 outline-none text-gray-800"
                    value={partylistDescription}
                    onChange={(e) => setPartylistDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  {editingPartylist && (
                    <button
                      onClick={() => {
                        setEditingPartylist(null);
                        setPartylistName("");
                        setPartylistDescription("");
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-all duration-200"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    onClick={handleSavePartylist}
                    disabled={partylistLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 font-medium transition-all duration-200 disabled:opacity-50"
                  >
                    {partylistLoading ? "Saving..." : editingPartylist ? "Update" : "Add Partylist"}
                  </button>
                </div>
              </div>
              
              {/* Partylists List */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Existing Partylists</h3>
                {partylists.length > 0 ? (
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {partylists.map((p) => (
                      <div key={p.id} className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900">{p.name}</div>
                          {p.description && (
                            <div className="text-sm text-gray-600 mt-1">{p.description}</div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditPartylist(p)}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeletePartylist(p.id)}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    No partylists created yet for this election
                  </div>
                )}
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={closePartylistModal}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-all duration-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}