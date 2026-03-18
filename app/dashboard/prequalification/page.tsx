"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Subcontractor {
  id: string;
  name: string;
  email: string;
  trade: string;
  prequal_status:
    | "pending"
    | "approved"
    | "rejected"
    | "expired"
    | "not_started";
  compliance_flag_count: number;
  last_checked: string | null;
  license_expiry: string | null;
  insurance_expiry: string | null;
}

interface PrequalStats {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  expired: number;
  not_started: number;
  with_flags: number;
}

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-orange-100 text-orange-800",
  not_started: "bg-gray-100 text-gray-800",
};

const STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  pending: "Pending Review",
  rejected: "Rejected",
  expired: "Expired",
  not_started: "Not Started",
};

export default function PrequalificationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [stats, setStats] = useState<PrequalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningCheck, setRunningCheck] = useState<string | null>(null);
  const [checkResults, setCheckResults] = useState<Record<string, string>>({});
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<keyof Subcontractor>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchSubcontractors();
    }
  }, [status]);

  async function fetchSubcontractors() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/prequalification/subcontractors");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch subcontractors");
      }
      const data = await res.json();
      setSubcontractors(data.subcontractors || []);
      setStats(data.stats || null);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function runComplianceCheck(subcontractorId: string) {
    setRunningCheck(subcontractorId);
    setCheckResults((prev) => ({ ...prev, [subcontractorId]: "" }));
    try {
      const res = await fetch("/api/prequalification/compliance-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subcontractorId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Compliance check failed");
      }
      const data = await res.json();
      setCheckResults((prev) => ({
        ...prev,
        [subcontractorId]: data.summary || "Check complete",
      }));
      // Refresh list to get updated flag counts
      await fetchSubcontractors();
    } catch (err: any) {
      setCheckResults((prev) => ({
        ...prev,
        [subcontractorId]: `Error: ${err.message}`,
      }));
    } finally {
      setRunningCheck(null);
    }
  }

  function handleSort(field: keyof Subcontractor) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const filtered = subcontractors
    .filter((s) => {
      if (filterStatus !== "all" && s.prequal_status !== filterStatus)
        return false;
      if (
        searchQuery &&
        !s.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !s.trade.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !s.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });

  function isExpiringSoon(dateStr: string | null): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    const diff = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  }

  function isExpired(dateStr: string | null): boolean {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading prequalification data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Error Loading Data
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchSubcontractors}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Subcontractor Prequalification
              </h1>
              <p className="text-gray-500 mt-1">
                Manage compliance status and run AI-powered checks for all
                subcontractors
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={fetchSubcontractors}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </button>
              <Link
                href="/dashboard/prequalification/new"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Subcontractor
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">
                {stats.total}
              </div>
              <div className="text-xs text-gray-500 mt-1">Total</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-green-200 p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {stats.approved}
              </div>
              <div className="text-xs text-gray-500 mt-1">Approved</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-yellow-200 p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {stats.pending}
              </div>
              <div className="text-xs text-gray-500 mt-1">Pending</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-red-200 p-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {stats.rejected}
              </div>
              <div className="text-xs text-gray-500 mt-1">Rejected</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-orange-200 p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">
                {stats.expired}
              </div>
              <div className="text-xs text-gray-500 mt-1">Expired</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-gray-600">
                {stats.not_started}
              </div>
              <div className="text-xs text-gray-500 mt-1">Not Started</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-red-200 p-4 text-center">
              <div className="text-2xl font-bold text-red-500">
                {stats.with_flags}
              </div>
              <div className="text-xs text-gray-500 mt-1">With Flags</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Search by name, trade, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[
                "all",
                "approved",
                "pending",
                "rejected",
                "expired",
                "not_started",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === s
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {s === "all" ? "All" : STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <svg
                className="w-12 h-12 text-gray-300 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-gray-500 text-lg font-medium">
                No subcontractors found
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {searchQuery || filterStatus !== "all"
                  ? "Try adjusting your filters"
                  : "Add your first subcontractor to get started"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {[
                      { key: "name", label: "Subcontractor" },
                      { key: "trade", label: "Trade" },
                      { key: "prequal_status", label: "Status" },
                      { key: "compliance_flag_count", label: "Flags" },
                      { key: "license_expiry", label: "License Expiry" },
                      { key: "insurance_expiry", label: "Insurance Expiry" },
                      { key: "last_checked", label: "Last Checked" },
                    ].map(({ key, label }) => (
                      <th
                        key={key}
                        onClick={() => handleSort(key as keyof Subcontractor)}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      >
                        <div className="flex items-center gap-1">
                          {label}
                          {sortField === key && (
                            <span className="text-blue-500">
                              {sortDir === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((sub) => (
                    <>
                      <tr
                        key={sub.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-4">
                          <div>
                            <div className="font-medium text-gray-900">
                              {sub.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {sub.email}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-700">
                            {sub.trade || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              STATUS_COLORS[sub.prequal_status] ||
                              "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {STATUS_LABELS[sub.prequal_status] ||
                              sub.prequal_status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {sub.compliance_flag_count > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              <svg
                                className="w-3 h-3"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              {sub.compliance_flag_count} flag
                              {sub.compliance_flag_count !== 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">None</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`text-sm ${
                              isExpired(sub.license_expiry)
                                ? "text-red-600 font-medium"
                                : isExpiringSoon(sub.license_expiry)
                                  ? "text-orange-600 font-medium"
                                  : "text-gray-700"
                            }`}
                          >
                            {formatDate(sub.license_expiry)}
                            {isExpired(sub.license_expiry) && (
                              <span className="ml-1 text-xs text-red-500">
                                (Expired)
                              </span>
                            )}
                            {!isExpired(sub.license_expiry) &&
                              isExpiringSoon(sub.license_expiry) && (
                                <span className="ml-1 text-xs text-orange-500">
                                  (Soon)
                                </span>
                              )}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`text-sm ${
                              isExpired(sub.insurance_expiry)
                                ? "text-red-600 font-medium"
                                : isExpiringSoon(sub.insurance_expiry)
                                  ? "text-orange-600 font-medium"
                                  : "text-gray-700"
                            }`}
                          >
                            {formatDate(sub.insurance_expiry)}
                            {isExpired(sub.insurance_expiry) && (
                              <span className="ml-1 text-xs text-red-500">
                                (Expired)
                              </span>
                            )}
                            {!isExpired(sub.insurance_expiry) &&
                              isExpiringSoon(sub.insurance_expiry) && (
                                <span className="ml-1 text-xs text-orange-500">
                                  (Soon)
                                </span>
                              )}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-500">
                            {formatDate(sub.last_checked)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/dashboard/prequalification/${sub.id}`}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                            >
                              View
                            </Link>
                            <span className="text-gray-300">|</span>
                            <button
                              onClick={() => runComplianceCheck(sub.id)}
                              disabled={runningCheck === sub.id}
                              className={`text-sm font-medium transition-colors ${
                                runningCheck === sub.id
                                  ? "text-gray-400 cursor-not-allowed"
                                  : "text-purple-600 hover:text-purple-800"
                              }`}
                            >
                              {runningCheck === sub.id ? (
                                <span className="flex items-center gap-1">
                                  <svg
                                    className="animate-spin w-3 h-3"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                  >
                                    <circle
                                      className="opacity-25"
                                      cx="12"
                                      cy="12"
                                      r="10"
                                      stroke="currentColor"
                                      strokeWidth="4"
                                    />
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                    />
                                  </svg>
                                  Checking...
                                </span>
                              ) : (
                                "AI Check"
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {checkResults[sub.id] && (
                        <tr key={`${sub.id}-result`} className="bg-purple-50">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="flex items-start gap-2">
                              <svg
                                className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                                />
                              </svg>
                              <div>
                                <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                                  AI Compliance Check Result
                                </span>
                                <p className="text-sm text-purple-900 mt-0.5">
                                  {checkResults[sub.id]}
                                </p>
                              </div>
                              <button
                                onClick={() =>
                                  setCheckResults((prev) => {
                                    const next = { ...prev };
                                    delete next[sub.id];
                                    return next;
                                  })
                                }
                                className="ml-auto text-purple-400 hover:text-purple-600 transition-colors"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
              Showing {filtered.length} of {subcontractors.length}{" "}
              subcontractors
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-orange-400 inline-block"></span>
            Expiring within 30 days
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
            Already expired
          </div>
          <div className="flex items-center gap-1">
            <svg
              className="w-3 h-3 text-purple-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                clipRule="evenodd"
              />
            </svg>
            AI Check uses Claude to analyze compliance documents
          </div>
        </div>
      </div>
    </div>
  );
}
