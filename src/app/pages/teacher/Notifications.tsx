import { useMemo, useState } from "react";
import {
  AlertCircle,
  Bell,
  CheckCheck,
  Clock,
  FileText,
  RefreshCcw,
  type LucideIcon,
} from "lucide-react";
import {
  PortalEmptyState,
  PortalHero,
  PortalPage,
  PortalPanel,
} from "../../components/portal/PortalPage";
import { teacherNotificationService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import type { TeacherPortalNotification } from "../../lib/api/contracts";
import { invalidateNotificationBadge } from "../../lib/notificationBadges";

const typeIcon: Record<string, LucideIcon> = {
  submit: FileText,
  deadline: Clock,
  info: Bell,
  grade: AlertCircle,
};

const typeColor: Record<string, string> = {
  submit: "bg-teal-50 dark:bg-teal-500/15 text-teal-600",
  deadline: "bg-rose-50 dark:bg-rose-500/15 text-rose-600",
  info: "bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300",
  grade: "bg-amber-50 dark:bg-amber-500/15 text-amber-600",
};

const readableType = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const parseNotificationDate = (value: string, fallbackIndex: number) => {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  return Date.now() - fallbackIndex;
};

export default function TeacherNotifications() {
  const [filter, setFilter] = useState("All");
  const [actionState, setActionState] = useState<{
    busy: boolean;
    error: string | null;
  }>({ busy: false, error: null });
  const fetchNotifications = useMemo(
    () => () => teacherNotificationService.getNotifications({ type: filter }),
    [filter],
  );
  const { data, loading, error, setData, reload } = useAsyncData(
    fetchNotifications,
    [fetchNotifications],
  );
  const notifications = useMemo(
    () =>
      (data ?? [])
        .slice()
        .sort(
          (a, b) =>
            parseNotificationDate(`${b.date} ${b.time}`, 0) -
            parseNotificationDate(`${a.date} ${a.time}`, 0),
        ),
    [data],
  );
  const unread = notifications.filter((item) => !item.read).length;
  const types = ["All", "Submit", "Deadline", "Grade", "Info"];

  const grouped = useMemo(
    () =>
      notifications.reduce<Record<string, TeacherPortalNotification[]>>((acc, item) => {
        if (!acc[item.date]) acc[item.date] = [];
        acc[item.date].push(item);
        return acc;
      }, {}),
    [notifications],
  );
  const sectionEntries = useMemo(
    () =>
      Object.entries(grouped).sort((a, b) =>
        parseNotificationDate(a[0], 0) < parseNotificationDate(b[0], 0) ? 1 : -1,
      ),
    [grouped],
  );
  const countsByType = useMemo(() => {
    const counts: Record<string, number> = { All: notifications.length };
    notifications.forEach((item) => {
      const key = readableType(item.type);
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return counts;
  }, [notifications]);

  const markOneRead = async (id: string) => {
    const existing = notifications.find((item) => item.id === id);
    if (!existing || existing.read || actionState.busy) return;
    setActionState({ busy: true, error: null });
    try {
      await teacherNotificationService.markNotificationRead(id);
      setData((current) =>
        current ? current.map((item) => (item.id === id ? { ...item, read: true } : item)) : current,
      );
      await reload();
      invalidateNotificationBadge("teacher");
      setActionState({ busy: false, error: null });
    } catch {
      setActionState({
        busy: false,
        error: "Unable to update the selected notification.",
      });
    }
  };

  const markAllRead = async () => {
    if (unread === 0 || actionState.busy) return;
    setActionState({ busy: true, error: null });
    try {
      await teacherNotificationService.markAllNotificationsRead();
      setData((current) => (current ? current.map((item) => ({ ...item, read: true })) : current));
      await reload();
      invalidateNotificationBadge("teacher");
      setActionState({ busy: false, error: null });
    } catch {
      setActionState({
        busy: false,
        error: "Unable to mark all notifications as read.",
      });
    }
  };

  return (
    <PortalPage className="space-y-6">
      <PortalHero
        tone="teal"
        eyebrow="Teacher Inbox"
        title="Notifications"
        description="Track new submissions, deadline pressure, grading cues, and operational updates from one cleaner inbox view."
        icon={Bell}
        meta={[
          { label: "Filter", value: filter },
          { label: "Unread", value: String(unread) },
          { label: "Loaded", value: loading ? "Refreshing" : "Live" },
        ]}
        stats={[
          {
            label: "Visible",
            value: String(notifications.length),
            hint: "Notifications in the current filtered view.",
          },
          {
            label: "Unread",
            value: String(unread),
            hint: "Items that still need acknowledgement.",
          },
          {
            label: "Submit",
            value: String(countsByType.Submit ?? 0),
            hint: "Submission-related updates in the inbox.",
          },
          {
            label: "Deadline",
            value: String(countsByType.Deadline ?? 0),
            hint: "Time-sensitive reminders and alerts.",
          },
        ]}
        actions={
          <div className="flex flex-wrap gap-3">
            {unread > 0 ? (
              <button
                disabled={loading || actionState.busy}
                onClick={markAllRead}
                className="inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-900/85 px-4 py-3 text-sm font-semibold text-teal-800 dark:text-teal-200 shadow-lg shadow-slate-950/10 transition hover:bg-teal-50 disabled:opacity-60"
              >
                <CheckCheck size={16} />
                Mark all as read
              </button>
            ) : null}
            <button
              disabled={loading || actionState.busy}
              onClick={reload}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/16 disabled:opacity-60"
            >
              <RefreshCcw size={16} />
              Refresh
            </button>
          </div>
        }
      />

      <PortalPanel
        title="Filter Notifications"
        description="Cut the inbox down to the kind of update you want to process first."
      >
        <div className="flex flex-wrap gap-2">
          {types.map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                filter === type
                  ? "bg-teal-700 text-white shadow-[0_16px_35px_-24px_rgba(13,148,136,0.55)]"
                  : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/70"
              }`}
            >
              {type}
              <span className={`ml-1.5 ${filter === type ? "text-white/80" : "text-slate-400 dark:text-slate-300"}`}>
                {countsByType[type] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </PortalPanel>

      {error ? (
        <div className="rounded-[24px] border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : null}
      {actionState.error ? (
        <div className="rounded-[24px] border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {actionState.error}
        </div>
      ) : null}

      {loading && notifications.length === 0 ? (
        <PortalPanel title="Loading notifications" description="Refreshing your teacher inbox.">
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-[24px] bg-slate-100 dark:bg-slate-800/80" />
            ))}
          </div>
        </PortalPanel>
      ) : notifications.length === 0 ? (
        <PortalEmptyState
          title="No notifications in this view"
          description="Switch filters or refresh the teacher inbox to inspect different activity."
          icon={Bell}
        />
      ) : (
        <div className="space-y-5">
          {sectionEntries.map(([date, items]) => (
            <PortalPanel
              key={date}
              title={date}
              description={`${items.length} item${items.length === 1 ? "" : "s"} for this day.`}
            >
              <div className="space-y-3">
                {items.map((notification) => {
                  const Icon = typeIcon[notification.type] ?? Bell;
                  return (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => markOneRead(notification.id)}
                      className={`w-full rounded-[24px] border p-4 text-left transition ${
                        notification.read
                          ? "border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/70"
                          : "border-teal-200 bg-teal-50/55 shadow-[0_18px_45px_-34px_rgba(13,148,136,0.28)]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${typeColor[notification.type]}`}
                        >
                          <Icon size={17} strokeWidth={1.8} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {notification.title}
                              </p>
                              <p className="mt-1 text-sm leading-7 text-slate-500 dark:text-slate-400">
                                {notification.body}
                              </p>
                            </div>
                            {!notification.read ? (
                              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-teal-600" />
                            ) : null}
                          </div>
                          <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-300">
                            {notification.time}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </PortalPanel>
          ))}
        </div>
      )}
    </PortalPage>
  );
}
