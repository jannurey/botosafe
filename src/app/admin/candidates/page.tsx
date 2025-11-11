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

  const handleStatusChange = async (id: number, status: string) => {
    const res = await fetch("/api/candidates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });

    if (res.ok) {
      const updated = await res.json();
      setCandidates((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: updated.status } : c))
      );
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this candidate?")) return;

    const res = await fetch(`/api/candidates?id=${id}`, { method: "DELETE" });

    if (res.ok) {
      setCandidates((prev) => prev.filter((c) => c.id !== id));
      setFilteredCandidates((prev) => prev.filter((c) => c.id !== id));
    } else {
      alert("Failed to delete candidate.");
    }
  };

  const openModal = (fileUrl: string) => {
    setModalFile(fileUrl);
    setModalIsPdf(/\.pdf$/i.test(fileUrl));
    setModalOpen(true);
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

  return (
    <div className="p-8 bg-gradient-to-b from-gray-50 to-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
              Candidate Approvals
            </h1>
            <p className="text-gray-500 mt-1">
              Review, approve, decline, or manage candidate applications
            </p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="mb-6 bg-white p-5 rounded-xl shadow-md flex flex-col md:flex-row gap-4 md:items-center">
          <input
            type="text"
            placeholder="🔍 Search candidates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="declined">Declined</option>
          </select>

          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Positions</option>
            {uniquePositions.map((pos) => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </select>

          <select
            value={electionFilter}
            onChange={(e) => setElectionFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Elections</option>
            {uniqueElections.map((el) => (
              <option key={el} value={el}>
                {el}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
          <table className="w-full border-collapse">
            <thead className="bg-gray-100 text-xs font-semibold text-gray-600 uppercase">
              <tr>
                <th className="p-3 text-left">Photo</th>
                <th className="p-3 text-left">Full Name</th>
                <th className="p-3 text-left">Position</th>
                <th className="p-3 text-left">Election</th>
                <th className="p-3 text-left">Partylist</th>
                <th className="p-3 text-left">Description</th>
                <th className="p-3 text-left">COC File</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((c, idx) => (
                <tr
                  key={c.id}
                  className={`border-t text-sm ${
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                  } hover:bg-gray-100 transition`}
                >
                  <td className="p-3">
                    <Image
                      src={c.photo_url}
                      alt={c.fullname}
                      width={48} // ~w-12
                      height={48} // ~h-12
                      className="object-cover rounded-full shadow cursor-pointer hover:scale-105 transition"
                      onClick={() => openModal(c.photo_url)}
                    />
                  </td>
                  <td className="p-3 font-medium text-gray-800">
                    {c.fullname}
                  </td>
                  <td className="p-3">{c.position_name}</td>
                  <td className="p-3">{c.election_title}</td>
                  <td className="p-3">{c.partylist || "—"}</td>
                  <td className="p-3 max-w-[200px] truncate">
                    {c.description}
                  </td>
                  <td className="p-3">
                    {c.coc_file_url ? (
                      <div className="flex flex-col gap-1 text-xs">
                        <button
                          onClick={() => openModal(c.coc_file_url)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Preview
                        </button>
                        <a
                          href={c.coc_file_url}
                          download
                          className="text-green-600 hover:text-green-800 font-medium"
                        >
                          Download
                        </a>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        c.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : c.status === "declined"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="p-3 text-center space-x-2">
                    {c.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleStatusChange(c.id, "approved")}
                          className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg shadow hover:bg-green-700 transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleStatusChange(c.id, "declined")}
                          className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg shadow hover:bg-red-700 transition"
                        >
                          Decline
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="px-3 py-1.5 bg-gray-600 text-white text-xs rounded-lg shadow hover:bg-gray-700 transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {currentItems.length === 0 && (
            <div className="text-center py-6 text-gray-500 text-sm">
              No candidates found.
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredCandidates.length > itemsPerPage && (
          <div className="flex justify-between items-center mt-6 text-sm text-gray-600">
            <span>
              Showing {startIdx + 1}–
              {Math.min(startIdx + itemsPerPage, filteredCandidates.length)} of{" "}
              {filteredCandidates.length}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1 rounded-lg border ${
                  currentPage === 1
                    ? "text-gray-400 cursor-not-allowed"
                    : "hover:bg-gray-100"
                }`}
              >
                Prev
              </button>
              <span className="px-3 py-1">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className={`px-3 py-1 rounded-lg border ${
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

      {/* Modal */}
      {modalOpen && modalFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-white p-6 rounded-xl shadow-lg max-w-4xl w-full relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-xl font-bold"
            >
              ×
            </button>

            {modalIsPdf ? (
              <iframe
                src={modalFile}
                className="w-full h-[600px] border rounded-lg"
                title="PDF Preview"
              />
            ) : (
              <Image
                src={modalFile}
                alt="Preview"
                width={800} // you can adjust these values
                height={600}
                className="w-full h-auto max-h-[600px] object-contain rounded-lg"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
