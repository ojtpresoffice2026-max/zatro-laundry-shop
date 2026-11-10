
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Search,
  RefreshCw,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  User,
  CalendarDays,
  Filter,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "../../lib/supabase";

interface ActivityLog {
  id: string;
  actor_id: string | null;
  action: string;
  module: string;
  entity_type: string;
  entity_id: string | null;
  description: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
  actor_name?: string;
  actor_email?: string;
}

interface AdminProfile {
  id: string;
  full_name: string;
  email: string;
}

const ROWS_PER_PAGE = 10;

const modules = [
  "Customers",
  "Laundry Orders",
  "Order Tracking",
  "Payments",
  "Inventory",
  "Inventory Transactions",
  "Admin Management",
];

const actionStyles: Record<string, string> = {
  INSERT: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
};

const formatAction = (action: string) =>
  action.charAt(0) + action.slice(1).toLowerCase();

const formatDate = (value: string) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Invalid date"
    : format(date, "MMM dd, yyyy hh:mm:ss a");
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "An unexpected error occurred.";

export default function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] =
    useState<ActivityLog | null>(null);

  const loadLogs = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      // Fetch audit records.
      const { data, error: logsError } = await supabase
        .from("activity_logs")
        .select(
          "id, actor_id, action, module, entity_type, entity_id, description, old_values, new_values, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(1000);

      if (logsError) throw logsError;

      const activityRows = (data ?? []) as ActivityLog[];

      // Fetch administrator names separately.
      // This avoids depending on a PostgREST relationship alias.
      const actorIds = [
        ...new Set(
          activityRows
            .map((log) => log.actor_id)
            .filter((id): id is string => Boolean(id))
        ),
      ];

      let profileMap = new Map<string, AdminProfile>();

      if (actorIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", actorIds);

        if (profilesError) throw profilesError;

        profileMap = new Map(
          ((profiles ?? []) as AdminProfile[]).map((profile) => [
            profile.id,
            profile,
          ])
        );
      }

      const enrichedLogs = activityRows.map((log) => {
        const profile = log.actor_id
          ? profileMap.get(log.actor_id)
          : undefined;

        return {
          ...log,
          actor_name: profile?.full_name ?? "System / Unknown",
          actor_email: profile?.email ?? "",
        };
      });

      setLogs(enrichedLogs);
    } catch (err) {
      console.error("Activity logs error:", err);
      setError(getErrorMessage(err));
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();

    // Refresh the page when new audit records are inserted.
    const channel = supabase
      .channel("activity-logs-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_logs",
        },
        () => {
          void loadLogs(true);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadLogs]);

  const filteredLogs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          log.actor_name,
          log.actor_email,
          log.description,
          log.module,
          log.action,
          log.entity_type,
          log.entity_id,
        ].some((value) =>
          String(value ?? "").toLowerCase().includes(normalizedSearch)
        );

      const matchesModule =
        moduleFilter === "all" || log.module === moduleFilter;

      const matchesAction =
        actionFilter === "all" || log.action === actionFilter;

      const logDate = new Date(log.created_at);

      const matchesStart =
        !startDate ||
        logDate >= new Date(`${startDate}T00:00:00`);

      const matchesEnd =
        !endDate ||
        logDate < new Date(`${endDate}T00:00:00` + "Z");

      return (
        matchesSearch &&
        matchesModule &&
        matchesAction &&
        matchesStart &&
        matchesEnd
      );
    });
  }, [
    logs,
    search,
    moduleFilter,
    actionFilter,
    startDate,
    endDate,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredLogs.length / ROWS_PER_PAGE)
  );

  const safePage = Math.min(currentPage, totalPages);

  const paginatedLogs = filteredLogs.slice(
    (safePage - 1) * ROWS_PER_PAGE,
    safePage * ROWS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, moduleFilter, actionFilter, startDate, endDate]);

  const insertCount = logs.filter(
    (log) => log.action === "INSERT"
  ).length;

  const updateCount = logs.filter(
    (log) => log.action === "UPDATE"
  ).length;

  const deleteCount = logs.filter(
    (log) => log.action === "DELETE"
  ).length;

  const clearFilters = () => {
    setSearch("");
    setModuleFilter("all");
    setActionFilter("all");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Workspace / Management
          </p>

          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Activity Logs
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Monitor administrator activities and changes
            throughout ZATRO.
          </p>
        </div>

        <button
          onClick={() => void loadLogs(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={refreshing ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </header>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Total Activities"
          value={logs.length}
          icon={<Activity size={21} />}
          color="blue"
        />

        <SummaryCard
          title="Updates"
          value={updateCount}
          icon={<FileText size={21} />}
          color="indigo"
        />

        <SummaryCard
          title="New Records"
          value={insertCount}
          icon={<User size={21} />}
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryCard
          title="Deleted Records"
          value={deleteCount}
          icon={<AlertCircle size={21} />}
          color="red"
        />

        <SummaryCard
          title="Displayed Results"
          value={filteredLogs.length}
          icon={<Filter size={21} />}
          color="slate"
        />
      </div>

      {/* ERROR */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {/* FILTERS */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Filter size={18} className="text-slate-500" />
          <h2 className="font-semibold text-slate-800">
            Search and Filters
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search administrator, activity, ID..."
              className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <select
            value={moduleFilter}
            onChange={(event) => setModuleFilter(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="all">All Modules</option>
            {modules.map((module) => (
              <option key={module} value={module}>
                {module}
              </option>
            ))}
          </select>

          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="all">All Actions</option>
            <option value="INSERT">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
          </select>

          <button
            onClick={clearFilters}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Clear Filters
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-600">
            <span className="mb-1.5 flex items-center gap-2 font-medium">
              <CalendarDays size={15} />
              Start Date
            </span>
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500"
            />
          </label>

          <label className="text-sm text-slate-600">
            <span className="mb-1.5 flex items-center gap-2 font-medium">
              <CalendarDays size={15} />
              End Date
            </span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500"
            />
          </label>
        </div>
      </section>

      {/* ACTIVITY TABLE */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-800">
              System Activity
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Latest recorded database activities
            </p>
          </div>

          <span className="text-sm text-slate-500">
            {filteredLogs.length} record(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">Administrator</th>
                <th className="px-5 py-4">Module</th>
                <th className="px-5 py-4">Action</th>
                <th className="px-5 py-4">Description</th>
                <th className="px-5 py-4">Date & Time</th>
                <th className="px-5 py-4 text-center">Details</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-sm text-slate-500"
                  >
                    Loading activity logs...
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center">
                    <Activity
                      size={35}
                      className="mx-auto text-slate-300"
                    />
                    <p className="mt-3 font-semibold text-slate-700">
                      No activity found
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Try changing your search or filters.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-slate-800">
                        {log.actor_name}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {log.actor_email || "No actor identity"}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <span className="text-sm font-medium text-slate-700">
                        {log.module}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          actionStyles[log.action] ??
                          "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {formatAction(log.action)}
                      </span>
                    </td>

                    <td className="max-w-[260px] px-5 py-4">
                      <p className="truncate text-sm text-slate-600">
                        {log.description || "No description"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {log.entity_type}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">
                      {formatDate(log.created_at)}
                    </td>

                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Eye size={14} />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {!loading && filteredLogs.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Showing{" "}
              {(safePage - 1) * ROWS_PER_PAGE + 1} to{" "}
              {Math.min(
                safePage * ROWS_PER_PAGE,
                filteredLogs.length
              )}{" "}
              of {filteredLogs.length} records
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setCurrentPage((page) => Math.max(1, page - 1))
                }
                disabled={safePage === 1}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft size={17} />
              </button>

              <span className="px-3 text-sm font-medium text-slate-600">
                Page {safePage} of {totalPages}
              </span>

              <button
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.min(totalPages, page + 1)
                  )
                }
                disabled={safePage === totalPages}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ACTIVITY DETAILS MODAL */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Activity Details
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Audit record information
                </p>
              </div>

              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailField
                  label="Administrator"
                  value={selectedLog.actor_name || "System / Unknown"}
                />
                <DetailField
                  label="Module"
                  value={selectedLog.module}
                />
                <DetailField
                  label="Action"
                  value={formatAction(selectedLog.action)}
                />
                <DetailField
                  label="Entity Type"
                  value={selectedLog.entity_type}
                />
                <DetailField
                  label="Entity ID"
                  value={selectedLog.entity_id || "Not available"}
                />
                <DetailField
                  label="Date & Time"
                  value={formatDate(selectedLog.created_at)}
                />
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">
                  Description
                </h3>
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                  {selectedLog.description || "No description available."}
                </div>
              </div>

              <JsonSection
                title="Previous Values"
                value={selectedLog.old_values}
              />

              <JsonSection
                title="New Values"
                value={selectedLog.new_values}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: "blue" | "indigo" | "green" | "red" | "slate";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    indigo: "bg-indigo-50 text-indigo-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className={`rounded-xl p-2.5 ${colors[color]}`}>
          {icon}
        </div>
      </div>

      <p className="mt-4 text-2xl font-bold text-slate-900">
        {value.toLocaleString("en-PH")}
      </p>
    </div>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-1 break-all text-sm font-semibold text-slate-800">
        {value}
      </p>
    </div>
  );
}

function JsonSection({
  title,
  value,
}: {
  title: string;
  value: Record<string, unknown> | null;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">
        {title}
      </h3>

      <pre className="max-h-64 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-green-300">
        {value
          ? JSON.stringify(value, null, 2)
          : "No recorded values"}
      </pre>
    </div>
  );
}
