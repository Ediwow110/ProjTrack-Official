import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import {
  ChevronDown,
  ChevronLeft,
  ExternalLink,
  FileText,
  Search,
  Users,
  X,
} from "lucide-react";
import { StatusChip } from "../../components/ui/StatusChip";
import { GradeChip } from "../../components/ui/GradeChip";
import {
  PortalEmptyState,
  PortalHero,
  PortalPage,
  PortalPanel,
} from "../../components/portal/PortalPage";
import { studentService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import { useDebouncedValue } from "../../lib/hooks/useDebouncedValue";

export default function StudentMySubmissions() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  const fetchSubmissions = useMemo(
    () => () => studentService.getSubmissions({ search: debouncedSearch, status: statusFilter }),
    [debouncedSearch, statusFilter],
  );
  const { data, loading, error } = useAsyncData(fetchSubmissions, [fetchSubmissions]);
  const submissions = data ?? [];
  const statuses = [
    "All",
    "Submitted",
    "Late",
    "Reviewed",
    "Graded",
    "Draft",
    "Needs Revision",
    "Reopened",
  ];
  const backTarget = searchParams.get("back");
  const backLabel = backTarget?.includes("/student/calendar")
    ? "Back to Calendar"
    : backTarget?.includes("/student/dashboard")
      ? "Back to Dashboard"
      : backTarget?.includes("/student/subjects/")
        ? "Back to Activities"
        : "Back";

  const toggleExpanded = (submissionId: string) => {
    setExpandedId(expandedId === submissionId ? null : submissionId);
  };

  useEffect(() => {
    if (submissions.length === 0) return;
    const openId = searchParams.get("openId");
    const openActivityId = searchParams.get("activityId");
    const match = openId
      ? submissions.find((item) => String(item.id) === String(openId))
      : openActivityId
        ? submissions.find(
            (item) => String(item.activityId || "") === String(openActivityId),
          )
        : null;

    if (match) {
      setExpandedId(String(match.id));
      const suggested = String(match.status || "").trim();
      if (suggested && statuses.includes(suggested)) setStatusFilter(suggested);
      if (!search) setSearch(match.title || match.activityTitle || "");
    }
  }, [search, searchParams, statuses, submissions]);

  const gradedCount = submissions.filter((item) => item.grade !== "—").length;
  const groupCount = submissions.filter((item) => item.type === "Group").length;

  return (
    <PortalPage className="space-y-6">
      {backTarget ? (
        <button
          onClick={() => navigate(backTarget)}
          className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.4)] transition hover:bg-white dark:hover:bg-slate-800"
        >
          <ChevronLeft size={15} />
          {backLabel}
        </button>
      ) : null}

      <PortalHero
        tone="blue"
        eyebrow="Submission History"
        title="My Submissions"
        description="Review every project and activity you have turned in, reopen the ones that need attention, and drill into feedback without losing context."
        icon={FileText}
        meta={[
          { label: "Search", value: search.trim() ? "Filtered" : "All records" },
          { label: "Status", value: statusFilter },
          { label: "Expanded", value: expandedId ? "1 open" : "None" },
        ]}
        stats={[
          {
            label: "Visible",
            value: String(submissions.length),
            hint: "Records shown in the current filtered view.",
          },
          {
            label: "Graded",
            value: String(gradedCount),
            hint: "Submissions with released scores.",
          },
          {
            label: "Group",
            value: String(groupCount),
            hint: "Entries tied to collaboration workspaces.",
          },
          {
            label: "Filter",
            value: statusFilter,
            hint: "Current status lens applied to the list.",
          },
        ]}
      />

      <PortalPanel
        title="Search and refine"
        description="Find a submission fast, then narrow the workspace by its current status."
      >
        <div className="space-y-4">
          <label className="flex items-center gap-3 rounded-[24px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-4 py-3 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.42)]">
            <Search size={16} className="shrink-0 text-slate-400 dark:text-slate-300" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search submissions, activities, or subjects..."
              aria-label="Search my submissions"
              className="w-full bg-transparent text-sm text-slate-700 dark:text-slate-200 outline-none placeholder:text-slate-400"
            />
            {search ? (
              <button type="button" onClick={() => setSearch("")} aria-label="Clear submission search">
                <X size={14} className="text-slate-400 dark:text-slate-300 transition hover:text-slate-600" />
              </button>
            ) : null}
          </label>

          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                  statusFilter === status
                    ? "bg-blue-700 text-white shadow-[0_16px_35px_-24px_rgba(29,78,216,0.55)]"
                    : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </PortalPanel>

      {loading ? (
        <PortalPanel title="Loading submissions" description="Pulling your latest submission records.">
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-[24px] bg-slate-100 dark:bg-slate-800/80" />
            ))}
          </div>
        </PortalPanel>
      ) : error ? (
        <div className="rounded-[24px] border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : submissions.length === 0 ? (
        <PortalEmptyState
          title="No submissions in this view"
          description="Try broadening the current search or switching back to all statuses to bring more records into view."
          icon={FileText}
        />
      ) : (
        <PortalPanel
          title="Submission Workspace"
          description="Open any card to inspect feedback, attached files, and group context."
        >
          <div className="space-y-4">
            {submissions.map((submission) => {
              const isExpanded = expandedId === String(submission.id);
              return (
                <div
                  key={submission.id}
                  className={`overflow-hidden rounded-[28px] border transition ${
                    isExpanded
                      ? "border-blue-200 dark:border-blue-500/30 bg-blue-50/40 shadow-[0_24px_60px_-38px_rgba(29,78,216,0.4)]"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50/75 hover:border-slate-300"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleExpanded(String(submission.id))}
                    className="flex w-full items-start justify-between gap-4 px-5 py-5 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusChip status={submission.status} size="xs" />
                        <span className="rounded-full bg-white dark:bg-slate-900/85 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {submission.type}
                        </span>
                      </div>
                      <h2 className="mt-3 font-display text-xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-slate-100">
                        {submission.title}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{submission.subject}</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-300">
                            Due
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">{submission.due}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-300">
                            Submitted
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                            {submission.submitted}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-300">
                            Grade
                          </p>
                          <div className="mt-1"><GradeChip grade={submission.grade} status={submission.status} size="sm" /></div>
                        </div>
                      </div>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`mt-1 shrink-0 text-slate-400 dark:text-slate-300 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isExpanded ? (
                    <div className="border-t border-slate-200/70 bg-white/70 dark:bg-slate-900/70 px-5 py-5">
                      <div className="grid gap-5 lg:grid-cols-2">
                        <div className="rounded-[24px] border border-slate-200 dark:border-slate-700 bg-slate-50/85 dark:bg-slate-800/70 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-300">
                            Teacher Feedback
                          </p>
                          {submission.feedback ? (
                            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                              {submission.feedback}
                            </p>
                          ) : (
                            <p className="mt-3 text-sm italic text-slate-400 dark:text-slate-300">
                              No feedback yet. Check back after your teacher reviews this submission.
                            </p>
                          )}

                          {submission.files && submission.files.length > 0 ? (
                            <div className="mt-4 space-y-2">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-300">
                                Files
                              </p>
                              {submission.files.map((file) => {
                                const [label, href] = file.split("|||");
                                return (
                                  <div key={file} className="text-sm text-slate-500 dark:text-slate-400">
                                    {href ? (
                                      <a
                                        href={href}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-blue-700 dark:text-blue-300 hover:underline"
                                      >
                                        {label}
                                      </a>
                                    ) : (
                                      label
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}

                          {submission.externalLinks?.length ? (
                            <div className="mt-4 space-y-2">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-300">
                                External Links
                              </p>
                              {submission.externalLinks.map((link) => (
                                <div key={link} className="break-all text-sm text-slate-500 dark:text-slate-400">
                                  <a
                                    href={link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-700 dark:text-blue-300 hover:underline"
                                  >
                                    {link}
                                  </a>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="space-y-4">
                          {submission.type === "Group" ? (
                            <div className="rounded-[24px] border border-teal-200 bg-teal-50/75 p-4">
                              <div className="flex items-center gap-2 text-teal-700 dark:text-teal-300">
                                <Users size={15} />
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                                  Group Details
                                </p>
                              </div>
                              <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                                <p>
                                  <span className="font-semibold text-slate-800 dark:text-slate-100">Group:</span>{" "}
                                  {submission.groupName}
                                </p>
                                <p>
                                  <span className="font-semibold text-slate-800 dark:text-slate-100">Leader:</span>{" "}
                                  {submission.leader}
                                </p>
                                <p>
                                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                                    Submitted By:
                                  </span>{" "}
                                  {submission.submittedBy}
                                </p>
                              </div>
                              {submission.members?.length ? (
                                <div className="mt-4">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-300">
                                    Members
                                  </p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {submission.members.map((member) => (
                                      <span
                                        key={member}
                                        className="rounded-full bg-white dark:bg-slate-900/85 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300"
                                      >
                                        {member}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              const detailBack = backTarget || `${location.pathname}${location.search}`;
                              navigate(
                                `/student/submissions/${encodeURIComponent(String(submission.id))}?back=${encodeURIComponent(detailBack)}`,
                              );
                            }}
                            className="inline-flex items-center gap-2 rounded-2xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-28px_rgba(29,78,216,0.55)] transition hover:bg-blue-800"
                          >
                            <ExternalLink size={15} />
                            Open full submission view
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </PortalPanel>
      )}
    </PortalPage>
  );
}
