"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  message: z.string().optional(),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface Invitation {
  id: string;
  email: string;
  status: "pending" | "accepted" | "declined" | "expired";
  message?: string;
  created_at: string;
  updated_at: string;
  invitee_name?: string;
}

type StatusBadgeVariant = "pending" | "accepted" | "declined" | "expired";

const statusConfig: Record<
  StatusBadgeVariant,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  },
  accepted: {
    label: "Accepted",
    className: "bg-green-100 text-green-800 border border-green-200",
  },
  declined: {
    label: "Declined",
    className: "bg-red-100 text-red-800 border border-red-200",
  },
  expired: {
    label: "Expired",
    className: "bg-gray-100 text-gray-600 border border-gray-200",
  },
};

function StatusBadge({ status }: { status: StatusBadgeVariant }) {
  const config = statusConfig[status] ?? statusConfig.pending;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

export default function InvitationsPage() {
  const params = useParams();
  const projectId = params?.id as string;
  const { data: session, status: sessionStatus } = useSession();

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const [formData, setFormData] = useState<InviteFormData>({
    email: "",
    message: "",
  });
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof InviteFormData, string>>
  >({});

  const fetchInvitations = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/invitations`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error ?? `Failed to load invitations (${res.status})`,
        );
      }
      const data = await res.json();
      setInvitations(data.invitations ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load invitations",
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      fetchInvitations();
    }
  }, [sessionStatus, fetchInvitations]);

  function validateForm(): boolean {
    const result = inviteSchema.safeParse(formData);
    if (!result.success) {
      const errors: Partial<Record<keyof InviteFormData, string>> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof InviteFormData;
        if (field) errors[field] = err.message;
      });
      setFormErrors(errors);
      return false;
    }
    setFormErrors({});
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email.trim(),
          message: formData.message?.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.error ?? `Failed to send invitation (${res.status})`,
        );
      }

      setSubmitSuccess(`Invitation sent to ${formData.email}`);
      setFormData({ email: "", message: "" });
      await fetchInvitations();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to send invitation",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(invitationId: string) {
    if (!confirm("Are you sure you want to revoke this invitation?")) return;
    setRevoking(invitationId);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/invitations/${invitationId}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to revoke invitation");
      }
      await fetchInvitations();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to revoke invitation",
      );
    } finally {
      setRevoking(null);
    }
  }

  async function handleResend(invitationId: string, email: string) {
    try {
      const res = await fetch(
        `/api/projects/${projectId}/invitations/${invitationId}/resend`,
        {
          method: "POST",
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to resend invitation");
      }
      setSubmitSuccess(`Invitation resent to ${email}`);
      await fetchInvitations();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to resend invitation",
      );
    }
  }

  if (sessionStatus === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (sessionStatus === "unauthenticated") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Please sign in to manage invitations.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Subcontractor Invitations
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Invite subcontractors to collaborate on this project by sending them
          an email invitation.
        </p>
      </div>

      {/* Invite Form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Invite a Subcontractor
        </h2>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, email: e.target.value }));
                if (formErrors.email)
                  setFormErrors((prev) => ({ ...prev, email: undefined }));
              }}
              placeholder="subcontractor@example.com"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                formErrors.email
                  ? "border-red-400 bg-red-50"
                  : "border-gray-300"
              }`}
              disabled={submitting}
              autoComplete="email"
            />
            {formErrors.email && (
              <p className="mt-1 text-xs text-red-600">{formErrors.email}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="message"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Personal Message{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="message"
              value={formData.message}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, message: e.target.value }))
              }
              placeholder="Add a personal note to your invitation..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
              disabled={submitting}
            />
          </div>

          {submitError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <svg
                className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm text-red-700">{submitError}</p>
            </div>
          )}

          {submitSuccess && (
            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <svg
                className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm text-green-700">{submitSuccess}</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {submitting ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
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
                  Sending...
                </>
              ) : (
                <>
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
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  Send Invitation
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Invitations List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            Sent Invitations
          </h2>
          <button
            onClick={fetchInvitations}
            disabled={loading}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 transition"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <svg
              className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : invitations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <svg
                className="w-6 h-6 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">
              No invitations sent yet
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Use the form above to invite subcontractors to this project.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="px-6 py-4 flex items-start justify-between gap-4 hover:bg-gray-50 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {invitation.invitee_name ?? invitation.email}
                    </span>
                    {invitation.invitee_name && (
                      <span className="text-xs text-gray-500 truncate">
                        ({invitation.email})
                      </span>
                    )}
                    <StatusBadge status={invitation.status} />
                  </div>
                  {invitation.message && (
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                      {invitation.message}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    Sent {formatDate(invitation.created_at)}
                    {invitation.updated_at !== invitation.created_at && (
                      <> · Updated {formatDate(invitation.updated_at)}</>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {invitation.status === "pending" && (
                    <>
                      <button
                        onClick={() =>
                          handleResend(invitation.id, invitation.email)
                        }
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium transition"
                      >
                        Resend
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => handleRevoke(invitation.id)}
                        disabled={revoking === invitation.id}
                        className="text-xs text-red-500 hover:text-red-600 font-medium disabled:opacity-50 transition"
                      >
                        {revoking === invitation.id ? "Revoking..." : "Revoke"}
                      </button>
                    </>
                  )}
                  {invitation.status === "expired" && (
                    <button
                      onClick={() =>
                        handleResend(invitation.id, invitation.email)
                      }
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium transition"
                    >
                      Resend
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
