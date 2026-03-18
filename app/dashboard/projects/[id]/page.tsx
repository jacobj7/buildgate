import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Pool } from "pg";
import DocumentUploadForm from "@/components/DocumentUploadForm";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function getProject(projectId: string, userId: string) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT p.*, 
        (SELECT COUNT(*) FROM documents d WHERE d.project_id = p.id) as document_count,
        (SELECT COUNT(*) FROM invitations i WHERE i.project_id = p.id) as invitation_count,
        (SELECT COUNT(*) FROM bids b WHERE b.project_id = p.id) as bid_count
       FROM projects p 
       WHERE p.id = $1 AND p.owner_id = $2`,
      [projectId, userId],
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

async function getDocuments(projectId: string) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT d.*, u.name as uploaded_by_name 
       FROM documents d 
       LEFT JOIN users u ON d.uploaded_by = u.id
       WHERE d.project_id = $1 
       ORDER BY d.created_at DESC`,
      [projectId],
    );
    return result.rows;
  } finally {
    client.release();
  }
}

function formatFileSize(bytes: number): string {
  if (!bytes) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  if (!dateString) return "Unknown date";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadgeClass(status: string): string {
  switch (status?.toLowerCase()) {
    case "active":
      return "bg-green-100 text-green-800";
    case "draft":
      return "bg-gray-100 text-gray-800";
    case "closed":
      return "bg-red-100 text-red-800";
    case "awarded":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const project = await getProject(params.id, session.user.id);

  if (!project) {
    notFound();
  }

  const documents = await getDocuments(params.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            <li>
              <Link
                href="/dashboard"
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Dashboard
              </Link>
            </li>
            <li>
              <span className="text-gray-400 text-sm">/</span>
            </li>
            <li>
              <Link
                href="/dashboard/projects"
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Projects
              </Link>
            </li>
            <li>
              <span className="text-gray-400 text-sm">/</span>
            </li>
            <li>
              <span className="text-gray-900 text-sm font-medium">
                {project.name}
              </span>
            </li>
          </ol>
        </nav>

        {/* Project Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  {project.name}
                </h1>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(
                    project.status,
                  )}`}
                >
                  {project.status || "Draft"}
                </span>
              </div>
              {project.description && (
                <p className="text-gray-600 mt-2 max-w-3xl">
                  {project.description}
                </p>
              )}
              <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-500">
                <span>Created: {formatDate(project.created_at)}</span>
                {project.deadline && (
                  <span>Deadline: {formatDate(project.deadline)}</span>
                )}
                {project.budget && (
                  <span>
                    Budget: ${Number(project.budget).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/dashboard/projects/${params.id}/edit`}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Edit Project
              </Link>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {project.document_count || 0}
              </div>
              <div className="text-sm text-gray-500">Documents</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {project.invitation_count || 0}
              </div>
              <div className="text-sm text-gray-500">Invitations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {project.bid_count || 0}
              </div>
              <div className="text-sm text-gray-500">Bids</div>
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Invitations Card */}
          <Link
            href={`/dashboard/projects/${params.id}/invitations`}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <svg
                    className="w-6 h-6 text-purple-600"
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
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Invitations
                  </h3>
                  <p className="text-sm text-gray-500">
                    {project.invitation_count || 0} vendor
                    {project.invitation_count !== 1 ? "s" : ""} invited
                  </p>
                </div>
              </div>
              <svg
                className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              Manage vendor invitations and track responses
            </p>
          </Link>

          {/* Bid Comparison Card */}
          <Link
            href={`/dashboard/projects/${params.id}/bids`}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <svg
                    className="w-6 h-6 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Bid Comparison
                  </h3>
                  <p className="text-sm text-gray-500">
                    {project.bid_count || 0} bid
                    {project.bid_count !== 1 ? "s" : ""} received
                  </p>
                </div>
              </div>
              <svg
                className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              Compare and analyze bids from vendors side by side
            </p>
          </Link>
        </div>

        {/* Documents Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Documents
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Project files, specifications, and attachments
                </p>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {documents.length} file{documents.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Upload Form */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <DocumentUploadForm projectId={params.id} />
          </div>

          {/* Document List */}
          <div className="divide-y divide-gray-100">
            {documents.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No documents yet
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Upload your first document using the form above.
                </p>
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-blue-600"
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
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {doc.name || doc.filename}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500">
                          {formatFileSize(doc.file_size)}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">
                          {formatDate(doc.created_at)}
                        </span>
                        {doc.uploaded_by_name && (
                          <>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-500">
                              by {doc.uploaded_by_name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {doc.file_url && (
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg
                          className="w-3.5 h-3.5 mr-1.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                        Download
                      </a>
                    )}
                    <form
                      action={`/api/projects/${params.id}/documents/${doc.id}`}
                      method="DELETE"
                    >
                      <button
                        type="submit"
                        className="inline-flex items-center px-3 py-1.5 border border-red-200 rounded-md text-xs font-medium text-red-600 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <svg
                          className="w-3.5 h-3.5 mr-1.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
