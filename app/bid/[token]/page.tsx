import { notFound } from "next/navigation";
import { Pool } from "pg";
import BidSubmissionForm from "@/components/BidSubmissionForm";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface BidToken {
  id: string;
  project_id: string;
  subcontractor_id: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  bid_due_date: string | null;
  status: string;
  created_at: string;
}

interface ITBDocument {
  id: string;
  project_id: string;
  name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

interface LineItem {
  id: string;
  project_id: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  sort_order: number;
}

interface Subcontractor {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string;
}

async function getTokenData(token: string): Promise<{
  bidToken: BidToken;
  project: Project;
  documents: ITBDocument[];
  lineItems: LineItem[];
  subcontractor: Subcontractor;
} | null> {
  const client = await pool.connect();
  try {
    // Validate token
    const tokenResult = await client.query<BidToken>(
      `SELECT * FROM bid_tokens WHERE token = $1`,
      [token],
    );

    if (tokenResult.rows.length === 0) {
      return null;
    }

    const bidToken = tokenResult.rows[0];

    // Check expiration
    if (new Date(bidToken.expires_at) < new Date()) {
      return null;
    }

    // Get project
    const projectResult = await client.query<Project>(
      `SELECT * FROM projects WHERE id = $1`,
      [bidToken.project_id],
    );

    if (projectResult.rows.length === 0) {
      return null;
    }

    const project = projectResult.rows[0];

    // Get ITB documents
    const documentsResult = await client.query<ITBDocument>(
      `SELECT * FROM itb_documents WHERE project_id = $1 ORDER BY created_at ASC`,
      [bidToken.project_id],
    );

    // Get line items
    const lineItemsResult = await client.query<LineItem>(
      `SELECT * FROM bid_line_items WHERE project_id = $1 ORDER BY sort_order ASC`,
      [bidToken.project_id],
    );

    // Get subcontractor
    const subcontractorResult = await client.query<Subcontractor>(
      `SELECT * FROM subcontractors WHERE id = $1`,
      [bidToken.subcontractor_id],
    );

    if (subcontractorResult.rows.length === 0) {
      return null;
    }

    return {
      bidToken,
      project,
      documents: documentsResult.rows,
      lineItems: lineItemsResult.rows,
      subcontractor: subcontractorResult.rows[0],
    };
  } finally {
    client.release();
  }
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Not specified";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string | null): string {
  if (!fileType) return "📄";
  if (fileType.includes("pdf")) return "📕";
  if (fileType.includes("word") || fileType.includes("doc")) return "📘";
  if (
    fileType.includes("excel") ||
    fileType.includes("sheet") ||
    fileType.includes("xls")
  )
    return "📗";
  if (fileType.includes("image")) return "🖼️";
  return "📄";
}

export default async function BidSubmissionPage({
  params,
}: {
  params: { token: string };
}) {
  const data = await getTokenData(params.token);

  if (!data) {
    notFound();
  }

  const { bidToken, project, documents, lineItems, subcontractor } = data;

  const isAlreadySubmitted = bidToken.used_at !== null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Bid Submission Portal
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Secure invitation-only bid submission
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-700">
                {subcontractor.company_name}
              </p>
              {subcontractor.contact_name && (
                <p className="text-sm text-gray-500">
                  {subcontractor.contact_name}
                </p>
              )}
              <p className="text-sm text-gray-500">{subcontractor.email}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Already Submitted Banner */}
        {isAlreadySubmitted && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-start gap-3">
              <span className="text-green-600 text-xl">✅</span>
              <div>
                <h3 className="text-sm font-semibold text-green-800">
                  Bid Already Submitted
                </h3>
                <p className="text-sm text-green-700 mt-1">
                  Your bid for this project was submitted on{" "}
                  {formatDate(bidToken.used_at!)}. If you need to make changes,
                  please contact the project manager.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Expiration Warning */}
        {!isAlreadySubmitted && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <div className="flex items-start gap-3">
              <span className="text-amber-600 text-xl">⏰</span>
              <div>
                <h3 className="text-sm font-semibold text-amber-800">
                  Submission Deadline
                </h3>
                <p className="text-sm text-amber-700 mt-1">
                  This invitation expires on{" "}
                  <strong>{formatDate(bidToken.expires_at)}</strong>. Please
                  complete and submit your bid before this deadline.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Project Details */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">
              Project Details
            </h2>
          </div>
          <div className="px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="mt-2 text-gray-600 text-sm leading-relaxed">
                    {project.description}
                  </p>
                )}
              </div>
              <div className="space-y-3">
                {project.location && (
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 text-sm mt-0.5">📍</span>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Location
                      </p>
                      <p className="text-sm text-gray-800">
                        {project.location}
                      </p>
                    </div>
                  </div>
                )}
                {project.bid_due_date && (
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 text-sm mt-0.5">📅</span>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Bid Due Date
                      </p>
                      <p className="text-sm text-gray-800 font-medium">
                        {formatDate(project.bid_due_date)}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <span className="text-gray-400 text-sm mt-0.5">🏷️</span>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Status
                    </p>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                      {project.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ITB Documents */}
        {documents.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">
                Invitation to Bid Documents
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Please review all documents before submitting your bid
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {getFileIcon(doc.file_type)}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {doc.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {doc.file_type && (
                          <span className="uppercase mr-2">
                            {doc.file_type.split("/").pop()}
                          </span>
                        )}
                        {formatFileSize(doc.file_size)}
                      </p>
                    </div>
                  </div>
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
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
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Download
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Bid Submission Form */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">
              Bid Line Items
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Enter your pricing for each line item below
            </p>
          </div>
          <div className="px-6 py-5">
            {lineItems.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">
                  No line items have been defined for this project yet.
                </p>
              </div>
            ) : (
              <BidSubmissionForm
                token={params.token}
                lineItems={lineItems}
                projectId={project.id}
                subcontractorId={subcontractor.id}
                isAlreadySubmitted={isAlreadySubmitted}
              />
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-4">
          <p className="text-xs text-gray-400">
            This is a secure, invitation-only bid submission link. Do not share
            this URL with others.
          </p>
        </footer>
      </main>
    </div>
  );
}
