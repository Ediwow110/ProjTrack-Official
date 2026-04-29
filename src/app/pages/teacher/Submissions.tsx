import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  AlertCircle,
  Download,
  Filter,
  RefreshCcw,
  Search,
} from "lucide-react";
import { StatusChip } from "../../components/ui/StatusChip";
import { GradeChip } from "../../components/ui/GradeChip";
import {
  PortalEmptyState,
  PortalHero,
  PortalPage,
  PortalPanel,
} from "../../components/portal/PortalPage";
import { teacherService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";

const statuses = [
  "All",
  "Submitted",
  "Pending Review",
  "Late",
  "Reviewed",
  "Graded",
  "Needs Revision",
  "Reopened",
];
const types = ["All Types", "Individual", "Group"];

export default function TeacherSubmissions() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusF, setStatusF] = useState(searchParams.get("status") || "All");
  const [sectionF, setSectionF] = useState(
    searchParams.get("section") || "All Sections",
  );
  const [subjectF, setSubjectF] = useState(
    searchParams.get("subject") || "All Subjects",
  );
  const [subjectIdF, setSubjectIdF] = useState(searchParams.get("subjectId") || "");
  const [typeF, setTypeF] = useState(searchParams.get("type") || "All Types");
  const [currentPage, setCurrentPage] = useState(1);
  const [downloadNote, setDownloadNote] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsyncData(
    () =>
      teacherService.getSubmissions({
        search,
        status: statusF,
        section: sectionF,
        subject: subjectF,
        subjectId: subjectIdF || undefined,
        type: typeF,
      }),
    [search, statusF, sectionF, subjectF, subjectIdF, typeF],
  );

  const filtered = useMemo(() => data ?? [], [data]);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleSubmissions = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const sections = useMemo(
    () => ["All Sections", ...Array.from(new Set(filtered.map((item) => item.section).filter(Boolean)))],
    [filtered],
  );
  const subjects = useMemo(
    () => ["All Subjects", ...Array.from(new Set(filtered.map((item) => item.subject).filter(Boolean)))],
    [filtered],
  );
  const activeReviewCount = filtered.filter((item) =>
    ["Submitted", "Pending Review", "Late", "Needs Revision", "Reopened"].includes(item.status),
  ).length;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusF, sectionF, subjectF, subjectIdF, typeF]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const exportFiltered = async () => {
    await teacherService.exportSubmissionsCsv(
      filtered,
      sectionF === "All Sections" ? "all" : sectionF,
    );
    setDownloadNote(
      `Downloaded ${filtered.length} filtered records${sectionF !== "All Sections" ? ` for ${sectionF}` : ""}.`,
    );
    window.setTimeout(() => setDownloadNote(null), 2500);
  };

  const activeFilters = useMemo(
    () =>
      [
        sectionF !== "All Sections" ? `Section: ${sectionF}` : null,
        subjectF !== "All Subjects" ? `Subject: ${subjectF}` : null,
        typeF !== "All Types" ? `Type: ${typeF}` : null,
        statusF !== "All" ? `Status: ${statusF}` : null,
        search ? `Search: ${search}` : null,
      ].filter(Boolean) as string[],
    [sectionF, subjectF, typeF, statusF, search],
  );

  const openReview = (id: string) => {
    const back = `/teacher/submissions?section=${encodeURIComponent(sectionF)}&subject=${encodeURIComponent(subjectF)}${subjectIdF ? `&subjectId=${encodeURIComponent(subjectIdF)}` : ""}&status=${encodeURIComponent(statusF)}&type=${encodeURIComponent(typeF)}${search ? `&search=${encodeURIComponent(search)}` : ""}`;
    navigate(`/teacher/submissions/${id}?back=${encodeURIComponent(back)}`);
  };

  return (
    <PortalPage className="space-y-6">
      <PortalHero
        tone="teal"
        eyebrow="Review Queue"
        title="Submissions"
        description="Manage the full teacher review flow from one place, from search and filtering down to grading and export."
        icon={Filter}
        meta={[
          { label: "Status", value: statusF },
          { label: "Type", value: typeF },
          { label: "Section", value: sectionF },
        ]}
        stats={[
          {
            label: "Visible",
            value: String(filtered.length),
            hint: "Rows currently shown in this queue.",
          },
          {
            label: "Active Review",
            value: String(activeReviewCount),
            hint: "Items still requiring teacher action.",
          },
          {
            label: "Subject Filter",
            value: subjectF === "All Subjects" ? "All" : subjectF,
            hint: "Current subject scope for this list.",
          },
          {
            label: "Export",
            value: downloadNote ? "Ready" : "Available",
            hint: "CSV export mirrors the exact filtered table view.",
          },
        ]}
        actions={
          <div className="flex flex-wrap gap-3">
            <button
              onClick={reload}
              className="inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-900/85 px-4 py-3 text-sm font-semibold text-teal-800 dark:text-teal-200 shadow-lg shadow-slate-950/10 transition hover:bg-teal-50"
            >
              <RefreshCcw size={16} />
              Refresh
            </button>
            <button
              onClick={exportFiltered}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/16"
            >
              <Download size={16} />
              Download Records
            </button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-[24px] border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <PortalPanel
        title="Queue Filters"
        description="Search by title, student, or subject, then tighten the queue with section, subject, type, and status filters."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex min-w-[240px] flex-1 items-center gap-3 rounded-[24px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-4 py-3 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.42)]">
              <Search size={16} className="shrink-0 text-slate-400 dark:text-slate-300" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by title, student, subject..."
                className="w-full bg-transparent text-sm text-slate-700 dark:text-slate-200 outline-none placeholder:text-slate-400"
                aria-label="Search teacher submissions"
              />
            </label>

            <div className="inline-flex items-center gap-2 rounded-[20px] border border-amber-100 bg-amber-50 dark:bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-800">
              <AlertCircle size={14} />
              {activeReviewCount} active review items
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={sectionF}
              onChange={(event) => setSectionF(event.target.value)}
              className="rounded-[20px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 outline-none"
              aria-label="Filter submissions by section"
            >
              {sections.map((section) => (
                <option key={section}>{section}</option>
              ))}
            </select>

            <select
              value={subjectF}
              onChange={(event) => {
                const next = event.target.value;
                setSubjectF(next);
                if (next === "All Subjects") setSubjectIdF("");
              }}
              className="rounded-[20px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 outline-none"
              aria-label="Filter submissions by subject"
            >
              {subjects.map((subject) => (
                <option key={subject}>{subject}</option>
              ))}
            </select>

            <select
              value={typeF}
              onChange={(event) => setTypeF(event.target.value)}
              className="rounded-[20px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 outline-none"
              aria-label="Filter submissions by type"
            >
              {types.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => setStatusF(status)}
                className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                  statusF === status
                    ? "bg-teal-700 text-white shadow-[0_16px_35px_-24px_rgba(13,148,136,0.55)]"
                    : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {activeFilters.length > 0 || downloadNote ? (
            <div className="flex flex-wrap items-center gap-2">
              {activeFilters.map((entry) => (
                <span
                  key={entry}
                  className="rounded-full bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                >
                  {entry}
                </span>
              ))}
              {downloadNote ? (
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{downloadNote}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </PortalPanel>

      <PortalPanel
        title="Submission Table"
        description={`${filtered.length} record${filtered.length === 1 ? "" : "s"} in the current review queue.`}
        contentClassName="px-0 py-0"
      >
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading teacher submissions...
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-5 sm:px-6">
            <PortalEmptyState
              title="No submissions matched"
              description="Adjust the current filters to broaden the review queue and bring more records back into view."
              icon={Filter}
              className="border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/70"
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-sm">
              <thead>
                <tr className="border-b border-slate-200/70 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-800/70">
                  {[
                    "Title",
                    "Student / Group",
                    "Subject",
                    "Section",
                    "Type",
                    "Due Date",
                    "Submitted",
                    "Status",
                    "Grade",
                    "Action",
                  ].map((header) => (
                    <th
                      key={header}
                      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-300"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {visibleSubmissions.map((submission) => (
                  <tr
                    key={submission.id}
                    className={`cursor-pointer transition hover:bg-teal-50/35 ${
                      submission.status === "Late" ? "bg-rose-50/25 dark:bg-rose-500/10" : "bg-white/70 dark:bg-slate-900/70"
                    }`}
                    onClick={() => openReview(submission.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openReview(submission.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open submission ${submission.title}`}
                  >
                    <td className="px-4 py-4">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {submission.title}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-300">
                        {submission.activity}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{submission.owner}</p>
                      {submission.type === "Individual" && submission.studentId ? (
                        <p className="mt-1 font-mono text-[11px] text-slate-400 dark:text-slate-300">
                          {submission.studentId}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setSubjectF(submission.subject);
                          setSubjectIdF(submission.subjectId || "");
                        }}
                        className="font-semibold text-teal-700 dark:text-teal-300 hover:underline"
                      >
                        {submission.subject}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-600 dark:text-slate-300">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setSectionF(submission.section);
                        }}
                        className="font-semibold text-teal-700 dark:text-teal-300 hover:underline"
                      >
                        {submission.section}
                      </button>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400">{submission.type}</td>
                    <td className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400">{submission.due}</td>
                    <td className="px-4 py-4 text-xs text-slate-400 dark:text-slate-300">
                      {submission.submitted}
                    </td>
                    <td className="px-4 py-4">
                      <StatusChip status={submission.status} size="xs" />
                    </td>
                    <td className="px-4 py-4"><GradeChip grade={submission.grade} status={submission.status} size="xs" /></td>
                    <td className="px-4 py-4">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          openReview(submission.id);
                        }}
                        className="text-xs font-semibold text-teal-700 dark:text-teal-300 hover:underline"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            {totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-slate-200/70 dark:border-slate-700/60 px-4 py-4">
              <p className="text-xs font-medium text-slate-400 dark:text-slate-300">
                Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
          </>
        )}
      </PortalPanel>
    </PortalPage>
  );
}
