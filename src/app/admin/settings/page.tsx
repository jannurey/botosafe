"use client";

import React, { useEffect, useState } from "react";

type Settings = {
  default_school_year?: string | null;
  site_timezone?: string | null;
  allow_registration?: boolean | null;
};

const TIMEZONES = [
  "UTC",
  "UTC+00:00",
  "UTC+01:00",
  "UTC+08:00",
  "UTC-05:00",
  "Asia/Manila",
  "America/New_York",
  "Europe/London",
];

function normalizeIncoming(value: unknown) {
  if (value === null || typeof value === "undefined") return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return value;
      }
    }
    return value;
  }
  return value;
}

/** Compute default school year based on rule:
 * - School starts in August and ends in May (10 months), summer = June-July.
 * - Sensible default: if current month is June (6) or later, default startYear = currentYear (upcoming/ongoing),
 *   otherwise (Jan-May) default startYear = currentYear - 1.
 * Examples:
 *  - 2025-11-08 => 2025-2026
 *  - 2026-02-10 => 2025-2026
 *  - 2025-06-15 => 2025-2026 (summer -> upcoming)
 */
function computeDefaultSchoolYear(today = new Date()): string {
  const year = today.getFullYear();
  const month = today.getMonth() + 1; // 1-12
  const startYear = month >= 6 ? year : year - 1;
  const endYear = startYear + 1;
  return `${startYear}-${endYear}`;
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    default_school_year: "",
    site_timezone: "UTC",
    allow_registration: false,
  });

  const [yearError, setYearError] = useState<string | null>(null);
  const successTimeoutMs = 4000;

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setMessage(null);
      setIsSuccess(false);
      try {
        const res = await fetch("/api/admins/settings");
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.message || "Failed to load settings");
        }
        const data = await res.json();

        // Normalize incoming values defensively
        const normalized: Settings = {
          default_school_year:
            normalizeIncoming(data.default_school_year) ?? null,
          site_timezone: normalizeIncoming(data.site_timezone) ?? "UTC",
          allow_registration:
            typeof data.allow_registration === "boolean"
              ? data.allow_registration
              : normalizeIncoming(data.allow_registration) === "true" ||
                normalizeIncoming(data.allow_registration) === true
              ? true
              : false,
        };

        // If default_school_year is empty/missing, prefill a sensible computed value (but do not save automatically)
        if (
          !normalized.default_school_year ||
          normalized.default_school_year === ""
        ) {
          normalized.default_school_year = computeDefaultSchoolYear();
        }

        if (mounted) {
          setSettings((s) => ({ ...s, ...normalized }));
        }
      } catch (err: any) {
        setMessage(err?.message || "Failed to load settings");
        setIsSuccess(false);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const onChange = (patch: Partial<Settings>) =>
    setSettings((s) => ({ ...s, ...patch }));

  function validateSchoolYear(value?: string | null) {
    if (!value || value.trim() === "") {
      setYearError(null);
      return true;
    }
    const m = value.trim().match(/^(\d{4})-(\d{4})$/);
    if (!m) {
      setYearError("Use format YYYY-YYYY (e.g. 2025-2026)");
      return false;
    }
    const start = Number(m[1]);
    const end = Number(m[2]);
    if (end !== start + 1) {
      setYearError("End year must equal start year + 1 (e.g. 2025-2026)");
      return false;
    }
    setYearError(null);
    return true;
  }

  useEffect(() => {
    validateSchoolYear(settings.default_school_year ?? undefined);
  }, [settings.default_school_year]);

  // helper to show success then clear after timeout
  function showSuccess(msg: string) {
    setMessage(msg);
    setIsSuccess(true);
    window.setTimeout(() => {
      setMessage(null);
      setIsSuccess(false);
    }, successTimeoutMs);
  }

  // Save the full settings object (prefilled) to the API
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setMessage(null);
    setIsSuccess(false);

    if (!validateSchoolYear(settings.default_school_year ?? undefined)) {
      setMessage("Fix errors before saving");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admins/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to save");
      // show success
      showSuccess("Settings saved");
    } catch (err: any) {
      setMessage(err?.message || "Save failed");
      setIsSuccess(false);
    } finally {
      setSaving(false);
    }
  };

  // Compute current school year and save it immediately (Reset to current year)
  const handleResetToCurrentYear = async () => {
    const computed = computeDefaultSchoolYear();
    onChange({ default_school_year: computed });
    setMessage(null);
    setIsSuccess(false);
    setSaving(true);
    try {
      const res = await fetch("/api/admins/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, default_school_year: computed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to save");
      showSuccess(`Default school year set to ${computed}`);
    } catch (err: any) {
      setMessage(err?.message || "Save failed");
      setIsSuccess(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="bg-white shadow rounded-lg p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Site Settings</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleSave()}
              disabled={saving || Boolean(yearError)}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>

            <button
              type="button"
              onClick={handleResetToCurrentYear}
              disabled={saving}
              className="bg-gray-100 text-gray-800 px-3 py-1 rounded text-sm hover:bg-gray-200 disabled:opacity-60"
              title="Compute and save the current school year"
            >
              Reset to current year
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : (
          <>
            <form onSubmit={handleSave} className="space-y-4">
              {message && (
                <div
                  className={`text-sm ${
                    isSuccess
                      ? "text-green-800 bg-green-50 border-green-100"
                      : "text-gray-700 bg-gray-50"
                  } p-2 rounded border`}
                >
                  {message}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    School year
                  </label>
                  <input
                    className={`w-full border rounded px-3 py-2 ${
                      yearError ? "border-red-400" : ""
                    }`}
                    value={settings.default_school_year ?? ""}
                    onChange={(e) =>
                      onChange({ default_school_year: e.target.value })
                    }
                    placeholder="e.g. 2025-2026"
                  />
                  {yearError && (
                    <p className="text-xs text-red-500 mt-1">{yearError}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Format: YYYY-YYYY
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Timezone
                  </label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={settings.site_timezone ?? "UTC"}
                    onChange={(e) =>
                      onChange({ site_timezone: e.target.value })
                    }
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.allow_registration)}
                    onChange={(e) =>
                      onChange({ allow_registration: e.target.checked })
                    }
                  />
                  <span className="text-sm">Allow public registration</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="submit"
                  disabled={saving || Boolean(yearError)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
