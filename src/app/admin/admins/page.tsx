"use client";

import { useEffect, useState } from "react";
import { FiTrash2, FiEye, FiEyeOff, FiUserCheck } from "react-icons/fi";

interface Admin {
  id: number;
  fullname: string;
  email: string;
  created_at?: string | null;
  last_login_at?: string | null;
  can_vote?: number | null;
  approval_status?: string | null;
}

export default function AdminsListPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [canVote, setCanVote] = useState(true); // default for created admins
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [operatingId, setOperatingId] = useState<number | null>(null); // per-row action loading

  async function loadAdmins() {
    setLoading(true);
    try {
      const res = await fetch("/api/admins");
      if (!res.ok) throw new Error("Failed to fetch admins");
      const data = await res.json();
      setAdmins(data || []);
    } catch (err) {
      console.error(err);
      setMessage("Failed to load admins");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdmins();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setOperatingId(-1);
    try {
      const res = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullname, email, password, can_vote: canVote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to create");
      setMessage("Admin created");
      setFullname("");
      setEmail("");
      setPassword("");
      setShowCreate(false);
      await loadAdmins();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setOperatingId(null);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete admin "${name}"? This action cannot be undone.`))
      return;

    setOperatingId(id);
    setMessage(null);

    try {
      const res = await fetch(`/api/admins/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to delete");
      setMessage("Admin deleted");
      await loadAdmins();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setOperatingId(null);
    }
  };

  const approveAdminToVote = async (id: number) => {
    if (
      !confirm(
        "Approve this admin to vote? This will set approval_status='approved' and enable voting."
      )
    )
      return;

    setOperatingId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admins/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approval_status: "approved" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to approve");
      setMessage("Admin approved to vote");
      await loadAdmins();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setOperatingId(null);
    }
  };

  const renderApprovalBadge = (status?: string | null) => {
    if (status === "approved") {
      return (
        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-semibold inline-block">
          Approved
        </span>
      );
    }
    if (status === "declined") {
      return (
        <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-semibold inline-block">
          Declined
        </span>
      );
    }
    // pending or null
    return (
      <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-semibold inline-block">
        Pending
      </span>
    );
  };

  const renderCanVoteBadge = (flag?: number | null) => {
    if (Number(flag) === 1) {
      return (
        <span className="bg-green-50 text-green-700 px-2 py-1 rounded-full text-xs font-semibold inline-block">
          Yes
        </span>
      );
    }
    return (
      <span className="bg-gray-50 text-gray-700 px-2 py-1 rounded-full text-xs font-semibold inline-block">
        No
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold">Admins</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreate((s) => !s)}
            className="bg-blue-600 text-white px-3 py-2 rounded shadow-sm hover:bg-blue-700"
          >
            {showCreate ? "Close" : "Add Admin"}
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 text-sm text-gray-700 rounded border p-3 bg-white">
          {message}
        </div>
      )}

      {/* Create form - responsive */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="bg-white p-4 rounded shadow grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end"
        >
          <div className="col-span-1">
            <label className="block text-sm font-medium mb-1">Full name</label>
            <input
              className="border px-3 py-2 rounded w-full"
              placeholder="Full name"
              value={fullname}
              onChange={(e) => setFullname(e.target.value)}
              required
            />
          </div>

          <div className="col-span-1">
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              className="border px-3 py-2 rounded w-full"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="col-span-1 relative">
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              className="border px-3 py-2 rounded w-full pr-10"
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-8 text-gray-600 hover:text-gray-800"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>

          <div className="col-span-1 sm:col-span-2 lg:col-span-1 flex items-center space-x-3">
            <label className="text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={canVote}
                onChange={(e) => setCanVote(e.target.checked)}
                className="mr-2"
              />
              Allow to vote
            </label>
            <span className="text-xs text-gray-500">
              If checked, this admin can also act as a voter.
            </span>
          </div>

          <div className="col-span-1 sm:col-span-2 lg:col-span-1 flex items-end">
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded"
              disabled={operatingId === -1}
            >
              {operatingId === -1 ? "Creating..." : "Create Admin"}
            </button>
          </div>
        </form>
      )}

      {/* Desktop / tablet table */}
      <div className="hidden md:block bg-white rounded shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Approval</th>
              <th className="text-left px-4 py-3">Can Vote</th>
              <th className="text-left px-4 py-3">Last login</th>
              <th className="text-left px-4 py-3">Joined</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center">
                  Loading...
                </td>
              </tr>
            ) : admins.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center">
                  No admins found.
                </td>
              </tr>
            ) : (
              admins.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-4 py-3 align-top">{a.fullname}</td>
                  <td className="px-4 py-3 align-top">{a.email}</td>
                  <td className="px-4 py-3 align-top">
                    {renderApprovalBadge(a.approval_status)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {renderCanVoteBadge(a.can_vote)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {a.last_login_at
                      ? new Date(a.last_login_at).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {a.created_at
                      ? new Date(a.created_at).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {/* Inline actions: Approve + Delete */}
                    <div className="flex items-center gap-2">
                      {a.approval_status === "approved" ? (
                        <span className="text-green-600 text-sm px-2">
                          Approved
                        </span>
                      ) : (
                        <button
                          onClick={() => approveAdminToVote(a.id)}
                          disabled={
                            operatingId === a.id || Number(a.can_vote) === 1
                          }
                          title="Approve to vote"
                          className="flex items-center gap-2 text-gray-600 hover:text-green-600 px-2 py-1 rounded"
                        >
                          {operatingId === a.id ? (
                            "..."
                          ) : (
                            <>
                              <FiUserCheck />
                              <span className="hidden lg:inline text-sm">
                                Approve
                              </span>
                            </>
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(a.id, a.fullname)}
                        disabled={operatingId === a.id}
                        title="Delete"
                        className="flex items-center justify-center text-gray-600 hover:text-red-600 px-2 py-1 rounded border border-transparent hover:border-red-100"
                      >
                        {operatingId === a.id ? "..." : <FiTrash2 />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards with inline actions */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="p-4 bg-white rounded shadow text-center">
            Loading...
          </div>
        ) : admins.length === 0 ? (
          <div className="p-4 bg-white rounded shadow text-center">
            No admins found.
          </div>
        ) : (
          admins.map((a) => (
            <div key={a.id} className="bg-white rounded shadow p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800">
                    {a.fullname}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {a.email}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 items-center">
                    <div>{renderApprovalBadge(a.approval_status)}</div>
                    <div>{renderCanVoteBadge(a.can_vote)}</div>
                  </div>

                  <div className="mt-2 text-xs text-gray-600">
                    <div>
                      <strong>Last login:</strong>{" "}
                      {a.last_login_at
                        ? new Date(a.last_login_at).toLocaleString()
                        : "—"}
                    </div>
                    <div>
                      <strong>Joined:</strong>{" "}
                      {a.created_at
                        ? new Date(a.created_at).toLocaleString()
                        : "—"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    {a.approval_status === "approved" ? (
                      <span className="text-green-600 text-sm">Approved</span>
                    ) : (
                      <button
                        onClick={() => approveAdminToVote(a.id)}
                        disabled={
                          operatingId === a.id || Number(a.can_vote) === 1
                        }
                        title="Approve to vote"
                        className="bg-green-600 text-white px-3 py-1 rounded text-xs flex items-center gap-2"
                      >
                        {operatingId === a.id ? "..." : "Approve"}
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(a.id, a.fullname)}
                      disabled={operatingId === a.id}
                      title="Delete"
                      className="p-2 text-gray-600 hover:text-red-600 rounded border"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
