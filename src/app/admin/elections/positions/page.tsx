"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FaEdit, FaTrash, FaArrowLeft, FaPlus, FaMinus } from "react-icons/fa";

type Position = {
  id: number;
  name: string;
  election_id: number;
  election_title: string;
  created_at: string;
};

type NewPosition = {
  name: string;
  election_id: number | "";
};

type Election = {
  id: number;
  title: string;
};

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [name, setName] = useState("");
  const [electionId, setElectionId] = useState<number | "">("");
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(false);
  // Batch creation states
  const [newPositions, setNewPositions] = useState<NewPosition[]>([{ name: "", election_id: "" }]);
  const [isBatchMode, setIsBatchMode] = useState(true); // Set to true by default

  const router = useRouter();

  // Fetch data
  const refreshData = async (): Promise<void> => {
    try {
      const [positionsRes, electionsRes] = await Promise.all([
        fetch("/api/positions"),
        fetch("/api/elections"),
      ]);

      if (positionsRes.ok) {
        const positionsData: Position[] = await positionsRes.json();
        setPositions(positionsData);
      }
      if (electionsRes.ok) {
        const electionsData: Election[] = await electionsRes.json();
        setElections(electionsData);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 60000);
    return () => clearInterval(interval);
  }, []);

  // Modal controls
  const openModal = (position?: Position): void => {
    if (position) {
      setEditingPosition(position);
      setName(position.name);
      setElectionId(position.election_id);
      setIsBatchMode(false); // Disable batch mode when editing
    } else {
      setEditingPosition(null);
      setName("");
      setElectionId("");
      // Reset batch mode when creating new
      setNewPositions([{ name: "", election_id: "" }]);
      setIsBatchMode(true); // Enable batch mode for new positions
    }
    setIsModalOpen(true);
  };

  const closeModal = (): void => {
    setIsModalOpen(false);
    setEditingPosition(null);
    setName("");
    setElectionId("");
    // Reset batch mode
    setNewPositions([{ name: "", election_id: "" }]);
    setIsBatchMode(true); // Always reset to batch mode for new positions
  };

  // Batch position handlers
  const addNewPositionField = () => {
    setNewPositions([...newPositions, { name: "", election_id: "" }]);
  };

  const removeNewPositionField = (index: number) => {
    if (newPositions.length > 1) {
      const updatedPositions = [...newPositions];
      updatedPositions.splice(index, 1);
      setNewPositions(updatedPositions);
    }
  };

  const updateNewPositionField = (index: number, field: keyof NewPosition, value: string | number) => {
    const updatedPositions = [...newPositions];
    updatedPositions[index] = { ...updatedPositions[index], [field]: value };
    setNewPositions(updatedPositions);
  };

  // Save position (single or batch)
  const handleSave = async (): Promise<void> => {
    if (editingPosition) {
      // Edit existing position (single mode)
      if (!name || !electionId) {
        alert("Please fill out all required fields.");
        return;
      }

      setLoading(true);

      const payload = { name, election_id: Number(electionId) };
      const url = `/api/positions/${editingPosition.id}`;
      const method = "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await refreshData();
        closeModal();
      } else {
        console.error("Failed to save position");
      }

      setLoading(false);
    } else {
      // Batch creation mode (always used for new positions)
      const validPositions = newPositions.filter(pos => pos.name && pos.election_id);
      
      if (validPositions.length === 0) {
        alert("Please add at least one valid position.");
        return;
      }

      setLoading(true);

      try {
        const res = await fetch("/api/positions/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ positions: validPositions }),
        });

        if (res.ok) {
          await refreshData();
          closeModal();
        } else {
          const errorData = await res.json();
          console.error("Failed to save positions:", errorData.error);
          alert(`Failed to save positions: ${errorData.error}`);
        }
      } catch (error) {
        console.error("Failed to save positions:", error);
        alert("An error occurred while saving positions");
      }

      setLoading(false);
    }
  };

  // Delete position
  const handleDelete = async (id: number): Promise<void> => {
    if (!confirm("Are you sure you want to delete this position?")) return;
    const res = await fetch(`/api/positions/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPositions((prev) => prev.filter((p) => p.id !== id));
    }
  };

  return (
    <div className="p-4 md:p-8 relative min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push("/admin/elections")}
          className="flex items-center gap-2 px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition text-sm"
        >
          <FaArrowLeft />
          <span className="hidden sm:inline">Back</span>
        </button>

        {/* Desktop Create Button */}
        <button
          onClick={() => openModal()}
          className="hidden sm:flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow text-sm"
        >
          <FaPlus />
          Create Position
        </button>
      </div>

      <h1 className="text-2xl font-bold text-gray-800 mb-2">Positions</h1>
      <p className="text-sm text-gray-500 mb-4">
        Manage all positions across elections
      </p>

      {/* Floating Mobile Create Button (always visible) */}
      <button
        onClick={() => openModal()}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg sm:hidden z-50 transition-transform active:scale-95"
        aria-label="Create Position"
      >
        <FaPlus />
      </button>

      {/* Mobile List */}
      <div className="space-y-3 sm:hidden pb-20">
        {positions.length === 0 && (
          <p className="text-center text-gray-500 text-sm py-4">
            No positions found.
          </p>
        )}
        {positions.map((p) => (
          <div
            key={p.id}
            className="border rounded-lg p-4 bg-white shadow-sm flex flex-col gap-2"
          >
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-gray-900">{p.name}</h2>
              <div className="flex gap-3">
                <button
                  onClick={() => openModal(p)}
                  className="text-blue-600 hover:text-blue-800"
                  title="Edit"
                >
                  <FaEdit />
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-red-600 hover:text-red-800"
                  title="Delete"
                >
                  <FaTrash />
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Election: <span className="font-medium">{p.election_title}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="overflow-x-auto hidden sm:block bg-white shadow rounded-lg">
        <table className="min-w-full text-sm text-left border-collapse">
          <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
            <tr>
              <th className="p-3">osition Name</th>
              <th className="p-3">Election</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p, idx) => (
              <tr
                key={p.id}
                className={`border-t ${
                  idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                } hover:bg-gray-100 transition`}
              >
                <td className="p-3 font-medium text-gray-900">{p.name}</td>
                <td className="p-3 text-gray-700">{p.election_title}</td>
                <td className="p-3 flex justify-center gap-3">
                  <button
                    onClick={() => openModal(p)}
                    className="text-blue-600 hover:text-blue-800"
                    title="Edit"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-red-600 hover:text-red-800"
                    title="Delete"
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {positions.length === 0 && (
          <div className="text-center text-gray-500 py-6 text-sm">
            No positions found.
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-lg overflow-y-auto max-h-[90vh]">
            <h2 className="text-lg font-bold mb-4 text-gray-800">
              {editingPosition ? "Edit Position" : "Create Multiple Positions"}
            </h2>

            {editingPosition ? (
              // Edit single position form
              <div className="space-y-3">
                <label className="block text-sm text-gray-600">
                  Position Name
                  <input
                    type="text"
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 mt-1"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>

                <label className="block text-sm text-gray-600">
                  Select Election
                  <select
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 mt-1"
                    value={electionId}
                    onChange={(e) => setElectionId(Number(e.target.value))}
                  >
                    <option value="">Select Election</option>
                    {elections.map((el) => (
                      <option key={el.id} value={el.id}>
                        {el.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              // Batch creation form (always show for new positions)
              <div className="space-y-4">
                {newPositions.map((pos, index) => (
                  <div key={index} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Position {index + 1}</span>
                      {newPositions.length > 1 && (
                        <button
                          onClick={() => removeNewPositionField(index)}
                          className="text-red-600 hover:text-red-800"
                          title="Remove Position"
                        >
                          <FaMinus />
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Position Name"
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        value={pos.name}
                        onChange={(e) => updateNewPositionField(index, "name", e.target.value)}
                      />
                      <select
                        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        value={pos.election_id}
                        onChange={(e) => updateNewPositionField(index, "election_id", Number(e.target.value))}
                      >
                        <option value="">Select Election</option>
                        {elections.map((el) => (
                          <option key={el.id} value={el.id}>
                            {el.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
                <button
                  onClick={addNewPositionField}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                >
                  <FaPlus size={12} /> Add Another Position
                </button>
              </div>
            )}

            <div className="mt-5 flex flex-col sm:flex-row justify-end gap-2">
              <button
                onClick={closeModal}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100 w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow w-full sm:w-auto"
              >
                {loading ? "Saving..." : editingPosition ? "Save" : "Save All Positions"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}