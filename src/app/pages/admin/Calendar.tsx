import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Filter, RefreshCcw } from "lucide-react";

import { PortalPage, PortalPanel } from "../../components/portal/PortalPage";
import { adminService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";

const days = Array.from({ length: 30 }, (_, index) => index + 1);
const weekdayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthLabels = ["April 2026", "May 2026", "June 2026", "July 2026"];

const eventToneClasses: Record<string, string> = {
  blue: "border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 dark:border-blue-400/25 dark:bg-blue-500/10 dark:text-blue-100",
  amber: "border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-100",
  violet: "border-violet-200 bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 dark:border-violet-400/25 dark:bg-violet-500/10 dark:text-violet-100",
};

const dayOfEvent = (event: { date?: number; startsAt?: string }) => {
  if (typeof event.date === "number" && !Number.isNaN(event.date)) return event.date;
  if (event.startsAt) {
    const parsed = new Date(event.startsAt).getDate();
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 1;
};

const labelForEventDate = (event: { startsAt?: string }, fallbackDay: number) => {
  if (event.startsAt) {
    const parsed = new Date(event.startsAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
  }
  return `Apr ${fallbackDay}`;
};

export default function AdminCalendar() {
  const [filter, setFilter] = useState("All Events");
  const [monthLabelIndex, setMonthLabelIndex] = useState(0);
  const [selectedDay, setSelectedDay] = useState(24);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const fetchEvents = useMemo(
    () => () => adminService.getCalendarEvents({ audience: filter }),
    [filter],
  );
  const { data, loading, error, reload } = useAsyncData(fetchEvents, [fetchEvents]);
  const events = data ?? [];
  const filterOptions = useMemo(
    () => ["All Events", ...Array.from(new Set(events.map((event) => event.section).filter(Boolean)))],
    [events],
  );
  const normalizedEvents = useMemo(
    () => events.map((event) => ({ ...event, day: dayOfEvent(event) })),
    [events],
  );
  const dayEvents = normalizedEvents.filter((event) => event.day === selectedDay);
  const selectedEvent =
    dayEvents.find((event) => event.id === selectedEventId) ?? dayEvents[0] ?? null;

  useEffect(() => {
    setSelectedEventId(null);
    setDetail(null);
    setDetailError(null);
  }, [filter]);

  useEffect(() => {
    setSelectedEventId((current) =>
      current && dayEvents.some((event) => event.id === current)
        ? current
        : (dayEvents[0]?.id ?? null),
    );
  }, [selectedDay, dayEvents]);

  useEffect(() => {
    if (!selectedEvent?.id) {
      setDetail(null);
      setDetailError(null);
      return;
    }

    let active = true;
    setDetailLoading(true);
    setDetailError(null);

    adminService
      .getCalendarEventDetail(selectedEvent.id)
      .then((payload) => {
        if (!active) return;
        setDetail(payload);
      })
      .catch(() => {
        if (!active) return;
        setDetailError("Unable to load full event details.");
        setDetail(null);
      })
      .finally(() => {
        if (!active) return;
        setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedEvent?.id]);

  return (
    <PortalPage className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="font-bold text-slate-900 dark:text-slate-100"
            style={{ fontSize: "1.3rem", letterSpacing: "-0.02em" }}
          >
            Calendar
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Institution-wide view of deadlines, broadcasts, requests, and academic milestones.
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-300 dark:text-slate-500">
            {loading ? "Loading calendar…" : `${events.length} event${events.length === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled={loading || detailLoading}
            onClick={() =>
              setMonthLabelIndex((current) =>
                current === 0 ? monthLabels.length - 1 : current - 1,
              )
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white/88 text-slate-500 dark:text-slate-400 shadow-[var(--shadow-soft)] transition hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50 dark:border-slate-700/60 dark:bg-slate-900/75 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/88 px-4 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 shadow-[var(--shadow-soft)] dark:border-slate-700/60 dark:bg-slate-900/75 dark:text-slate-100">
            {monthLabels[monthLabelIndex]}
          </div>
          <button
            disabled={loading || detailLoading}
            onClick={() =>
              setMonthLabelIndex((current) => (current + 1) % monthLabels.length)
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white/88 text-slate-500 dark:text-slate-400 shadow-[var(--shadow-soft)] transition hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50 dark:border-slate-700/60 dark:bg-slate-900/75 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ChevronRight size={16} />
          </button>
          <button
            disabled={loading || detailLoading}
            onClick={() => {
              setSelectedEventId(null);
              reload();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white/88 text-slate-500 dark:text-slate-400 shadow-[var(--shadow-soft)] transition hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50 dark:border-slate-700/60 dark:bg-slate-900/75 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCcw size={15} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/88 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 shadow-[var(--shadow-soft)] dark:border-slate-700/60 dark:bg-slate-900/75 dark:text-slate-400">
          <Filter size={14} />
          <select
            disabled={loading || detailLoading}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="bg-transparent text-sm text-slate-700 dark:text-slate-200 outline-none disabled:opacity-50 dark:text-slate-100"
          >
            {filterOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[24px] border border-slate-200 dark:border-slate-700 bg-white/82 p-5 text-sm text-slate-500 dark:text-slate-400 shadow-[var(--shadow-soft)] dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-400">
          Loading calendar events…
        </div>
      ) : null}
      {error ? (
        <div className="rounded-[24px] border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 p-4 text-sm text-rose-700 dark:text-rose-300 dark:border-rose-500/30 dark:bg-rose-500/12 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <div className={`grid gap-6 lg:grid-cols-[1.5fr,0.9fr] ${loading || detailLoading ? "opacity-95" : ""}`}>
        <PortalPanel className="overflow-hidden" contentClassName="px-0 py-0">
          <div className="grid grid-cols-7 border-b border-slate-200/70 bg-slate-50/90 dark:border-slate-700/60 dark:bg-slate-900/90">
            {weekdayHeaders.map((day) => (
              <div
                key={day}
                className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-slate-200/70 dark:bg-slate-800/70">
            {days.map((day) => {
              const eventsOnDay = normalizedEvents.filter((event) => event.day === day);
              const active = selectedDay === day;

              return (
                <button
                  disabled={loading || detailLoading}
                  key={day}
                  onClick={() => {
                    setSelectedDay(day);
                    setSelectedEventId(null);
                  }}
                  className={`min-h-[122px] bg-white/92 p-3 text-left align-top transition-colors disabled:opacity-60 dark:bg-slate-950/65 ${
                    active
                      ? "bg-blue-50 dark:bg-blue-500/15 ring-2 ring-blue-300/80 dark:bg-blue-500/10 dark:ring-blue-400/35"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:hover:bg-slate-900/90"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${active ? "text-blue-700 dark:text-blue-300 dark:text-blue-100" : "text-slate-700 dark:text-slate-200"}`}>
                      {day}
                    </span>
                    {eventsOnDay.length > 0 ? <span className="h-2 w-2 rounded-full bg-blue-400" /> : null}
                  </div>

                  <div className="mt-3 space-y-1.5">
                    {eventsOnDay.slice(0, 2).map((event) => (
                      <div
                        key={event.id || event.title}
                        className={`line-clamp-2 rounded-md border px-2 py-1 text-[10px] font-semibold ${
                          eventToneClasses[event.tone] ?? eventToneClasses.blue
                        }`}
                      >
                        {event.title}
                      </div>
                    ))}
                    {eventsOnDay.length > 2 ? (
                      <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500">
                        +{eventsOnDay.length - 2} more
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </PortalPanel>

        <div className="space-y-5">
          <PortalPanel className={loading || detailLoading ? "opacity-80" : undefined}>
            <div className="mb-4 flex items-center gap-2">
              <CalendarDays size={15} className="text-slate-400 dark:text-slate-300" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Selected Day</h2>
            </div>

            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">April {selectedDay}, 2026</p>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-300 dark:text-slate-500">
              {dayEvents.length} scheduled item{dayEvents.length === 1 ? "" : "s"}
            </p>

            <div className="mt-4 space-y-3">
              {dayEvents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-500 dark:text-slate-400 dark:border-slate-700/60 dark:text-slate-500">
                  No events for this date.
                </div>
              ) : null}

              {dayEvents.map((event) => (
                <button
                  key={event.id || event.title}
                  type="button"
                  onClick={() => setSelectedEventId(event.id)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    selectedEvent?.id === event.id
                      ? "border-blue-300 bg-blue-50 dark:bg-blue-500/15 dark:border-blue-400/35 dark:bg-blue-500/10"
                      : "border-slate-200 dark:border-slate-700 bg-white/88 hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:border-slate-700/60 dark:bg-slate-950/60 dark:hover:bg-slate-900/80"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{event.title}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Audience / Section: {event.section}</p>
                  <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-300 dark:text-slate-500">
                    {labelForEventDate(event, event.day)}
                  </p>
                </button>
              ))}
            </div>
          </PortalPanel>

          <PortalPanel>
            <h2 className="mb-3 text-sm font-bold text-slate-900 dark:text-slate-100">Event Details</h2>

            {!selectedEvent ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-500 dark:text-slate-400 dark:border-slate-700/60 dark:text-slate-500">
                Select an event to inspect the full backend detail.
              </div>
            ) : detailError ? (
              <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 p-4 text-sm text-rose-700 dark:text-rose-300 dark:border-rose-500/30 dark:bg-rose-500/12 dark:text-rose-200">
                {detailError}
              </div>
            ) : detailLoading ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-4 text-sm text-slate-500 dark:text-slate-400 dark:border-slate-700/60 dark:bg-slate-950/60 dark:text-slate-400">
                Loading event details…
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {detail?.title ?? selectedEvent.title}
                  </p>
                  <p className="mt-1 text-slate-500 dark:text-slate-400">
                    {detail?.section ?? selectedEvent.section}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/85 p-3 dark:border-slate-700/60 dark:bg-slate-950/55">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-300 dark:text-slate-500">
                      Type
                    </p>
                    <p className="mt-1 text-slate-900 dark:text-slate-100">
                      {detail?.type ?? selectedEvent.type ?? "Event"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/85 p-3 dark:border-slate-700/60 dark:bg-slate-950/55">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-300 dark:text-slate-500">
                      When
                    </p>
                    <p className="mt-1 text-slate-900 dark:text-slate-100">
                      {labelForEventDate(detail ?? selectedEvent, selectedEvent.day)}
                    </p>
                  </div>
                </div>

                {detail?.audience ? (
                  <p>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">Audience:</span>{" "}
                    {detail.audience}
                  </p>
                ) : null}
                {detail?.windowStatus ? (
                  <p>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">Window:</span>{" "}
                    {detail.windowStatus}
                  </p>
                ) : null}
              </div>
            )}
          </PortalPanel>
        </div>
      </div>
    </PortalPage>
  );
}
