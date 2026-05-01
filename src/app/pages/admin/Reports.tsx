import { Suspense, lazy, useMemo, useState } from "react";
import { Download, RefreshCcw } from "lucide-react";
import { adminService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";

const AdminReportsCharts = lazy(() => import("./components/AdminReportsCharts"));

export default function AdminReports() {
  const [schoolYear, setSchoolYear] = useState("2025–2026");
  const [semester, setSemester] = useState("2nd Semester");
  const [section, setSection] = useState("All Sections");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchReports = useMemo(
    () => () => adminService.getReports({ schoolYear, semester, section }),
    [schoolYear, semester, section],
  );
  const { data, loading, error, reload } = useAsyncData(fetchReports, [fetchReports]);
  const resultCount = data?.tableRows?.length ?? 0;

  const exportCurrentView = async () => {
    if (!data) return;
    setExportError(null);
    setExporting(true);
    try {
      await adminService.exportReportsCsv(data.tableRows, section);
    } catch {
      setExportError("Unable to export the current report view.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className={`flex items-start justify-between ${loading || exporting ? "opacity-95" : ""}`}>
        <div>
          <h1 className={`text-slate-900 dark:text-slate-100 font-bold ${loading || exporting ? "opacity-80" : ""}`} style={{ fontSize: "1.3rem", letterSpacing: "-0.02em" }}>
            Reports
          </h1>
          <p className={`text-slate-400 dark:text-slate-300 text-sm mt-0.5 ${loading || exporting ? "opacity-80" : ""}`}>Institutional analytics and submission insights.</p>
          <p className={`text-slate-400 dark:text-slate-300 text-xs mt-1 ${loading || exporting ? "opacity-80" : ""}`}>
            {loading ? "Loading reports…" : `${resultCount} row${resultCount === 1 ? "" : "s"}`}
          </p>
          <p className={`text-slate-400 dark:text-slate-300 text-xs mt-1 ${loading || exporting ? "opacity-80" : ""}`}>
            {loading ? "Refreshing report data…" : "Current report data."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={loading || exporting}
            onClick={reload}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50"
          >
            <RefreshCcw size={14} /> Refresh
          </button>
          <button
            disabled={loading || exporting || !data}
            onClick={exportCurrentView}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50"
          >
            <Download size={14} /> {exporting ? "Exporting…" : "Export Current View"}
          </button>
        </div>
      </div>

      {exportError && <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300">{exportError}</div>}

      <div className={`flex flex-wrap gap-3 items-center p-4 bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm ${loading || exporting ? "opacity-80" : ""}`}>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">School Year:</label>
          <select
            disabled={loading || exporting}
            value={schoolYear}
            onChange={(e) => setSchoolYear(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 text-xs outline-none disabled:opacity-50"
          >
            {["2025–2026", "2024–2025"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Semester:</label>
          <select
            disabled={loading || exporting}
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 text-xs outline-none disabled:opacity-50"
          >
            {["2nd Semester", "1st Semester"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Section:</label>
          <select
            disabled={loading || exporting}
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 text-xs outline-none disabled:opacity-50"
          >
            {["All Sections", "BSIT 3A", "BSIT 3B", "BSCS 4A"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto text-[11px] text-slate-400 dark:text-slate-300">Operational reporting view</div>
      </div>

      {loading && <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-5 text-sm text-slate-500 dark:text-slate-400">Loading reports…</div>}
      {error && <div className="bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-xl p-4 text-sm">{error}</div>}
      {data && data.metrics.length === 0 && (
        <div className={`rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 p-6 text-sm text-slate-400 dark:text-slate-300 ${loading ? "opacity-80" : ""}`}>
          No report data is available for the selected filters.
        </div>
      )}

      {data && data.metrics.length > 0 && (
        <>
          <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 ${loading ? "opacity-80" : ""}`}>
            {data.metrics.map((k) => (
              <div key={k.label} className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-4">
                <p className="text-slate-400 dark:text-slate-300 text-xs font-medium">{k.label}</p>
                <p className="text-slate-900 dark:text-slate-100 font-bold text-2xl mt-1">{k.value}</p>
                <p className={`text-xs mt-1 font-semibold ${k.good ? "text-emerald-600" : "text-rose-600"}`}>{k.delta}</p>
              </div>
            ))}
          </div>

          <Suspense
            fallback={
              <>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2 rounded-xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
                    <div className="h-[200px] animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/70" />
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
                    <div className="h-[200px] animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/70" />
                  </div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/85">
                  <div className="h-[200px] animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/70" />
                </div>
              </>
            }
          >
            <AdminReportsCharts
              completionData={data.completionData}
              lateData={data.lateData}
              turnaroundData={data.turnaroundData}
            />
          </Suspense>

          <div className={`bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm overflow-hidden ${loading ? "opacity-80" : ""}`}>
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/70 flex items-center justify-between">
              <div>
                <p className="text-slate-800 dark:text-slate-100 text-sm font-bold">Filtered Report View</p>
                <p className="text-slate-400 dark:text-slate-300 text-xs mt-0.5">Shows the current section filter selection.</p>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-300">{data.tableRows.length} rows</p>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-100 dark:border-slate-700/70">
                  {["Subject", "Section", "Completion", "Pending", "Graded", "Avg Review"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-[11px] text-slate-400 dark:text-slate-300 font-semibold uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/60">
                {data.tableRows.map((row) => (
                  <tr key={`${row.subject}-${row.section}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/70">
                    <td className="px-5 py-3.5 text-slate-800 dark:text-slate-100 text-xs font-semibold">{row.subject}</td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-xs">{row.section}</td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-xs">{row.completionRate}</td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-xs">{row.pending}</td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-xs">{row.graded}</td>
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-xs">{row.avgReview}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
