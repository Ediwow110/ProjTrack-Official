import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
} from "lucide-react";
import { StatusChip } from "../../components/ui/StatusChip";
import {
  PortalEmptyState,
  PortalHero,
  PortalPage,
  PortalPanel,
} from "../../components/portal/PortalPage";
import {
  isEditableSubmissionStatus,
  isViewOnlySubmissionStatus,
} from "../../lib/submissionRules";
import { studentService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import type { CalendarEventItem } from "../../lib/api/contracts";

const subjectColors: Record<string, string> = {
  "Capstone Project": "bg-teal-500",
  "Information Management": "bg-blue-500",
  "Web Systems": "bg-amber-500",
};

function formatMonth(date: Date) {
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function buildEventTarget(event: CalendarEventItem) {
  const back = encodeURIComponent("/student/calendar");
  if (event.submissionId && isViewOnlySubmissionStatus(event.status)) {
    return `/student/submissions/${encodeURIComponent(String(event.submissionId))}?back=${back}`;
  }

  const params = new URLSearchParams();
  params.set("back", "/student/calendar");
  params.set("subject", event.subject || "");
  if (event.subjectId) params.set("subjectId", String(event.subjectId));
  params.set("activity", event.title || "");
  if (event.activityId) params.set("activityId", String(event.activityId));
  return `/student/submit?${params.toString()}`;
}

export default function StudentCalendar() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(new Date());
  const [selected, setSelected] = useState<CalendarEventItem | null>(null);
  const [view, setView] = useState("Month");
  const [subjectFilter, setSubjectFilter] = useState("All Subjects");
  const { data, loading, error } = useAsyncData(
    () => studentService.getCalendarEvents(),
    [],
  );

  const year = current.getFullYear();
  const month = current.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = useMemo(() => {
    const entries: Array<{ day?: number; date?: string }> = [];
    for (let index = 0; index < startDay; index += 1) entries.push({});
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      entries.push({ day, date: date.toISOString().slice(0, 10) });
    }
    while (entries.length % 7 !== 0) entries.push({});
    return entries;
  }, [daysInMonth, month, startDay, year]);

  const filteredEvents = (data ?? []).filter(
    (event) => subjectFilter === "All Subjects" || event.subject === subjectFilter,
  );
  const eventMap = filteredEvents.reduce<Record<string, CalendarEventItem[]>>(
    (acc, event) => {
      if (event.date) (acc[event.date] ||= []).push(event);
      return acc;
    },
    {},
  );
  const upcoming = filteredEvents
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const activeSelected = selected ?? upcoming[0] ?? null;

  return (
    <PortalPage className="space-y-6">
      <PortalHero
        tone="blue"
        eyebrow="Planning View"
        title="Calendar"
        description="Track deadlines, reopened activity windows, and the next submission milestone without leaving your student workspace."
        icon={CalendarDays}
        meta={[
          { label: "View", value: view },
          { label: "Month", value: formatMonth(current) },
          { label: "Filter", value: subjectFilter },
        ]}
        stats={[
          {
            label: "Events",
            value: String(filteredEvents.length),
            hint: "Calendar items visible under the current filters.",
          },
          {
            label: "Upcoming",
            value: String(upcoming.length),
            hint: "Sorted by nearest deadlines and milestones.",
          },
          {
            label: "Selected",
            value: activeSelected ? "1 active" : "None",
            hint: "Focused event details appear on the right.",
          },
          {
            label: "Mode",
            value: view,
            hint: "Switch between month overview and agenda detail.",
          },
        ]}
      />

      {error ? (
        <div className="rounded-[24px] border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <PortalPanel
        title="Calendar Controls"
        description="Move through the month, switch the presentation mode, and limit the view to one subject if you need focus."
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-[24px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-3 py-2 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.42)] dark:border-slate-700/60 dark:bg-slate-900/80">
            <button
              onClick={() => setCurrent(new Date(year, month - 1, 1))}
              className="flex h-10 w-10 items-center justify-center rounded-2xl text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ChevronLeft size={15} />
            </button>
            <p className="min-w-[170px] text-center font-display text-lg font-semibold tracking-[-0.03em] text-slate-900 dark:text-slate-100">
              {formatMonth(current)}
            </p>
            <button
              onClick={() => setCurrent(new Date(year, month + 1, 1))}
              className="flex h-10 w-10 items-center justify-center rounded-2xl text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {["Month", "Agenda"].map((item) => (
              <button
                key={item}
                onClick={() => setView(item)}
                className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  view === item
                    ? "bg-blue-700 text-white shadow-[0_18px_40px_-28px_rgba(29,78,216,0.55)]"
                    : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <select
            value={subjectFilter}
            onChange={(event) => setSubjectFilter(event.target.value)}
            className="rounded-[22px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.42)] outline-none dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-200"
          >
            {[
              "All Subjects",
              ...Array.from(new Set((data ?? []).map((item) => item.subject))),
            ].map((subject) => (
              <option key={subject}>{subject}</option>
            ))}
          </select>
        </div>
      </PortalPanel>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.55fr,0.85fr]">
        <PortalPanel
          title={view === "Month" ? "Month Grid" : "Agenda View"}
          description={
            view === "Month"
              ? "Spot clusters of activity and drill into a day by selecting a card."
              : "A cleaner timeline of the events coming up next."
          }
          contentClassName="px-0 py-0"
        >
          {view === "Month" ? (
            <>
              <div className="grid grid-cols-7 border-b border-slate-200/70 bg-slate-50/80 dark:border-slate-700/60 dark:bg-slate-900/80">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div
                    key={day}
                    className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-300 dark:text-slate-500"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((cell, index) => (
                  <div
                    key={index}
                    className="min-h-[132px] border-b border-r border-slate-200/70 p-3 dark:border-slate-800/70"
                  >
                    {cell.day ? (
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{cell.day}</p>
                    ) : null}
                    <div className="mt-2 space-y-2">
                      {cell.date &&
                        eventMap[cell.date]?.map((event) => (
                          <button
                            key={event.id}
                            onClick={() => setSelected(event)}
                            className={`w-full rounded-2xl border px-2.5 py-2 text-left transition ${
                              activeSelected?.id === event.id
                                ? "border-blue-200 dark:border-blue-500/30 bg-blue-50/80 dark:border-blue-400/30 dark:bg-blue-500/15"
                                : "border-slate-200 dark:border-slate-700 bg-slate-50/85 hover:bg-slate-100 dark:border-slate-700/60 dark:bg-slate-800/75 dark:hover:bg-slate-800"
                            }`}
                          >
                            <div className="mb-1 flex items-center gap-1.5">
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  subjectColors[event.subject] || "bg-slate-400"
                                }`}
                              />
                              <span className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-100">
                                {event.title}
                              </span>
                            </div>
                            <p className="truncate text-[10px] text-slate-400 dark:text-slate-300 dark:text-slate-500">
                              {event.subject}
                            </p>
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : loading && !data ? (
            <div className="px-6 py-6 text-sm text-slate-500 dark:text-slate-400">Loading agenda...</div>
          ) : upcoming.length ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60 dark:divide-slate-800">
              {upcoming.map((event) => (
                <button
                  key={event.id}
                  onClick={() => setSelected(event)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/70"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{event.title}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {event.subject} · {event.type} · {event.displayDate || event.date}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip status={event.window} size="xs" />
                    <StatusChip status={event.status} size="xs" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-6 py-6">
              <PortalEmptyState
                title="No calendar events in this view"
                description="Adjust the subject filter or change the month to bring more items into the calendar."
                icon={CalendarDays}
                className="border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/70"
              />
            </div>
          )}
        </PortalPanel>

        <div className="space-y-6">
          <PortalPanel
            title="Selected Event"
            description="Focused details for the currently highlighted calendar item."
          >
            {activeSelected ? (
              <div className="space-y-4">
                <div>
                  <h2 className="font-display text-2xl font-semibold tracking-[-0.04em] text-slate-900 dark:text-slate-100">
                    {activeSelected.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {activeSelected.subject} · {activeSelected.type} submission
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-slate-200 dark:border-slate-700 bg-slate-50/85 px-4 py-4 dark:border-slate-700/60 dark:bg-slate-800/80">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-300 dark:text-slate-500">
                      Due Date
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {activeSelected.displayDate || activeSelected.date}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 dark:border-slate-700 bg-slate-50/85 px-4 py-4 dark:border-slate-700/60 dark:bg-slate-800/80">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-300 dark:text-slate-500">
                      Submission Type
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {activeSelected.type}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusChip status={activeSelected.window} size="xs" />
                  <StatusChip status={activeSelected.status} size="xs" />
                </div>
                <button
                  onClick={() => navigate(buildEventTarget(activeSelected))}
                  className="w-full rounded-2xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-28px_rgba(29,78,216,0.55)] transition hover:bg-blue-800"
                >
                  {isViewOnlySubmissionStatus(activeSelected.status)
                    ? "View Submission"
                    : isEditableSubmissionStatus(activeSelected.status)
                      ? "Continue Submission"
                      : "Open Submission"}
                </button>
              </div>
            ) : (
              <PortalEmptyState
                title="Nothing selected yet"
                description="Choose any calendar entry to preview its deadline, type, and next action."
                icon={CalendarDays}
                className="border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/70"
              />
            )}
          </PortalPanel>

          <PortalPanel
            title="Upcoming Deadlines"
            description="Nearest items in your current filtered calendar."
          >
            {upcoming.slice(0, 5).length ? (
              <div className="space-y-3">
                {upcoming.slice(0, 5).map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start justify-between gap-3 rounded-[22px] border border-slate-200 dark:border-slate-700 bg-slate-50/85 px-4 py-4 dark:border-slate-700/60 dark:bg-slate-800/80"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {event.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{event.subject}</p>
                    </div>
                    <p className="whitespace-nowrap text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {event.displayDate || event.date}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <PortalEmptyState
                title="No upcoming items"
                description="This calendar view does not have any upcoming deadlines right now."
                icon={Clock3}
                className="border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/70"
              />
            )}
          </PortalPanel>
        </div>
      </div>
    </PortalPage>
  );
}
