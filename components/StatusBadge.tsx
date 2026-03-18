type StatusBadgeProps = {
  status: string;
  className?: string;
};

const statusColorMap: Record<string, string> = {
  active: "bg-green-100 text-green-800 border-green-200",
  inactive: "bg-gray-100 text-gray-800 border-gray-200",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  approved: "bg-blue-100 text-blue-800 border-blue-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-orange-100 text-orange-800 border-orange-200",
  draft: "bg-slate-100 text-slate-800 border-slate-200",
  published: "bg-purple-100 text-purple-800 border-purple-200",
  archived: "bg-zinc-100 text-zinc-800 border-zinc-200",
  error: "bg-red-100 text-red-800 border-red-200",
  success: "bg-green-100 text-green-800 border-green-200",
  warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
  info: "bg-blue-100 text-blue-800 border-blue-200",
  open: "bg-green-100 text-green-800 border-green-200",
  closed: "bg-gray-100 text-gray-800 border-gray-200",
  "in-progress": "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  processing: "bg-indigo-100 text-indigo-800 border-indigo-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  expired: "bg-orange-100 text-orange-800 border-orange-200",
  suspended: "bg-red-100 text-red-800 border-red-200",
  verified: "bg-teal-100 text-teal-800 border-teal-200",
  unverified: "bg-gray-100 text-gray-800 border-gray-200",
  enabled: "bg-green-100 text-green-800 border-green-200",
  disabled: "bg-gray-100 text-gray-800 border-gray-200",
};

const defaultColor = "bg-gray-100 text-gray-800 border-gray-200";

function formatStatusLabel(status: string): string {
  return status
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function StatusBadge({
  status,
  className = "",
}: StatusBadgeProps) {
  const normalizedStatus = status?.toLowerCase?.() ?? "";
  const colorClasses = statusColorMap[normalizedStatus] ?? defaultColor;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses} ${className}`}
    >
      {formatStatusLabel(status)}
    </span>
  );
}
