import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Pool } from "pg";
import Link from "next/link";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function getDashboardStats(userId: string) {
  const client = await pool.connect();
  try {
    const projectCountResult = await client.query(
      `SELECT COUNT(*) as count FROM projects WHERE user_id = $1`,
      [userId],
    );

    const pendingBidsResult = await client.query(
      `SELECT COUNT(*) as count FROM bids 
       WHERE user_id = $1 AND status = 'pending'`,
      [userId],
    );

    const complianceFlagsResult = await client.query(
      `SELECT COUNT(*) as count FROM compliance_flags 
       WHERE user_id = $1 AND resolved = false`,
      [userId],
    );

    const recentProjectsResult = await client.query(
      `SELECT id, name, status, created_at 
       FROM projects 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [userId],
    );

    const recentBidsResult = await client.query(
      `SELECT b.id, b.amount, b.status, b.created_at, p.name as project_name
       FROM bids b
       LEFT JOIN projects p ON b.project_id = p.id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC
       LIMIT 5`,
      [userId],
    );

    return {
      projectCount: parseInt(projectCountResult.rows[0]?.count ?? "0"),
      pendingBids: parseInt(pendingBidsResult.rows[0]?.count ?? "0"),
      complianceFlags: parseInt(complianceFlagsResult.rows[0]?.count ?? "0"),
      recentProjects: recentProjectsResult.rows,
      recentBids: recentBidsResult.rows,
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return {
      projectCount: 0,
      pendingBids: 0,
      complianceFlags: 0,
      recentProjects: [],
      recentBids: [],
    };
  } finally {
    client.release();
  }
}

function StatCard({
  title,
  value,
  description,
  href,
  colorClass,
  icon,
}: {
  title: string;
  value: number;
  description: string;
  href: string;
  colorClass: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="block">
      <div
        className={`rounded-lg border p-6 shadow-sm hover:shadow-md transition-shadow bg-white`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className={`text-3xl font-bold mt-1 ${colorClass}`}>{value}</p>
            <p className="text-xs text-gray-400 mt-1">{description}</p>
          </div>
          <div className={`p-3 rounded-full ${colorClass} bg-opacity-10`}>
            {icon}
          </div>
        </div>
      </div>
    </Link>
  );
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusBadgeClass(status: string) {
  switch (status?.toLowerCase()) {
    case "active":
    case "approved":
      return "bg-green-100 text-green-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "rejected":
    case "cancelled":
      return "bg-red-100 text-red-800";
    case "completed":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const stats = await getDashboardStats(session.user.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Welcome back, {session.user.name ?? session.user.email}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Total Projects"
            value={stats.projectCount}
            description="All your projects"
            href="/dashboard/projects"
            colorClass="text-blue-600"
            icon={
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            }
          />

          <StatCard
            title="Pending Bids"
            value={stats.pendingBids}
            description="Awaiting review or approval"
            href="/dashboard/bids"
            colorClass="text-amber-600"
            icon={
              <svg
                className="w-6 h-6 text-amber-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            }
          />

          <StatCard
            title="Compliance Flags"
            value={stats.complianceFlags}
            description="Unresolved issues requiring attention"
            href="/dashboard/compliance"
            colorClass={
              stats.complianceFlags > 0 ? "text-red-600" : "text-green-600"
            }
            icon={
              <svg
                className={`w-6 h-6 ${stats.complianceFlags > 0 ? "text-red-600" : "text-green-600"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            }
          />
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Projects */}
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Projects
              </h2>
              <Link
                href="/dashboard/projects"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View all →
              </Link>
            </div>
            <div className="divide-y">
              {stats.recentProjects.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-400">
                  <p>No projects yet.</p>
                  <Link
                    href="/dashboard/projects/new"
                    className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-800"
                  >
                    Create your first project
                  </Link>
                </div>
              ) : (
                stats.recentProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/dashboard/projects/${project.id}`}
                    className="block px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {project.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatDate(project.created_at)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(
                          project.status,
                        )}`}
                      >
                        {project.status}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Recent Bids */}
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Bids
              </h2>
              <Link
                href="/dashboard/bids"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View all →
              </Link>
            </div>
            <div className="divide-y">
              {stats.recentBids.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-400">
                  <p>No bids yet.</p>
                  <Link
                    href="/dashboard/bids/new"
                    className="mt-2 inline-block text-sm text-blue-600 hover:text-blue-800"
                  >
                    Submit your first bid
                  </Link>
                </div>
              ) : (
                stats.recentBids.map((bid) => (
                  <Link
                    key={bid.id}
                    href={`/dashboard/bids/${bid.id}`}
                    className="block px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {bid.project_name ?? "Unknown Project"}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          ${Number(bid.amount).toLocaleString()} ·{" "}
                          {formatDate(bid.created_at)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(
                          bid.status,
                        )}`}
                      >
                        {bid.status}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Compliance Alert Banner */}
        {stats.complianceFlags > 0 && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Compliance Action Required
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  You have {stats.complianceFlags} unresolved compliance{" "}
                  {stats.complianceFlags === 1 ? "flag" : "flags"} that require
                  your attention.{" "}
                  <Link
                    href="/dashboard/compliance"
                    className="font-medium underline hover:no-underline"
                  >
                    Review now
                  </Link>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
