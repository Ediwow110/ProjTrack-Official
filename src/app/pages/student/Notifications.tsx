import { useMemo, useState } from "react";
import {
  AlertCircle,
  Bell,
  CheckCheck,
  Clock,
  FileText,
  Info,
  RefreshCcw,
  Star,
  type LucideIcon,
} from "lucide-react";
import {
  PortalEmptyState,
  PortalHero,
  PortalPage,
  PortalPanel,
} from "../../components/portal/PortalPage";
import { studentCatalogService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import type { StudentPortalNotification } from "../../lib/api/contracts";
import { invalidateNotificationBadge } from "../../lib/notificationBadges";

const typeIcon: Record<string, LucideIcon> = {
  feedback: FileText,
  grade: Star,
  overdue: AlertCircle,
  deadline: Clock,
  account: Info,
  info: Bell,
};

const typeColor: Record<string, string> = {
  feedback: "bg-teal-50 text-teal-600",
  grade: "bg-emerald-50 text-emerald-600",
  overdue: "bg-rose-50 text-rose-600",
  deadline: "bg-amber-50 text-amber-600",
  account: "bg-blue-50 text-blue-600",
  info: "bg-slate-100 text-slate-500",
};

export default function StudentNotifications() {
  const [filter, setFilter] = useState("All");
  const [actionState, setActionState] = useState<{
    busy: boolean;
    error: string | null;
  }>({ busy: false, error: null });
  const fetchNotifications = useMemo(
    () => () => studentCatalogService.getNotifications({ type: filter }),
    [filter],
  );
  const { data, loading, error, setData, reload } = useAsyncData(
    fetchNotifications,
    [fetchNotifications],
  );
  const notifications = data ?? [];
  const unread = notifications.filter((item) => !item.read).length;
  const types = ["All", "Feedback", "Grade", "Deadline", "Overdue", "Account"];

  const grouped = useMemo(
    () =>
      notifications.reduce<Record<string, StudentPortalNotification[]>>((acc, item) => {
        if (!acc[item.date]) acc[item.date] = [];
        acc[item.date].push(item);
        return acc;
      }, {}),
    [notifications],
  );

  const countsByType = useMemo(() => {
    const counts: Record<string, number> = { All: notifications.length };
    notifications.forEach((item) => {
      const key = item.type.charAt(0).toUpperCase() + item.type.slice(1);
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return counts;
  }, [notifications]);

  const markOneRead = async (id: string) => {
    const existing = notifications.find((item) => item.id === id);
    if (!existing || existing.read || actionState.busy) return;
    setActionState({ busy: true, error: null });
    try {
      await studentCatalogService.markNotificationRead(id);
      setData((current) =>
        current ? current.map((item) => (item.id === id ? { ...item, read: true } : item)) : current,
      );
      await reload();
      invalidateNotificationBadge("student");
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
      await studentCatalogService.markAllNotificationsRead();
      setData((current) => (current ? current.map((item) => ({ ...item, read: true })) : current));
      await reload();
      invalidateNotificationBadge("student");
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
        tone="blue"
        eyebrow="Inbox"
        title="Notifications"
        description="Stay on top of grades, deadlines, feedback, and account updates without losing the context of what still needs action."
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
            hint: "Items that still have not been acknowledged.",
          },
          {
            label: "Feedback",
            value: String(countsByType.Feedback ?? 0),
            hint: "Feedback-related messages in this view.",
          },
          {
            label: "Deadlines",
            value: String((countsByType.Deadline ?? 0) + (countsByType.Overdue ?? 0)),
            hint: "Time-sensitive reminders and overdue alerts.",
          },
        ]}
        actions={
          <div className="flex flex-wrap gap-3">
            {unread > 0 ? (
              <button
                disabled={loading || actionState.busy}
                onClick={markAllRead}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-blue-800 shadow-lg shadow-slate-950/10 transition hover:bg-blue-50 disabled:opacity-60"
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
        description="Focus the inbox around the type of update you want to process right now."
      >
        <div className="flex flex-wrap gap-2">
          {types.map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`rounded-full px-3.5 py-2 text-xs font-semibold transition ${
                filter === type
                  ? "bg-blue-700 text-white shadow-[0_16px_35px_-24px_rgba(29,78,216,0.55)]"
                  : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              {type}
              <span className={`ml-1.5 ${filter === type ? "text-white/80" : "text-slate-400"}`}>
                {countsByType[type] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </PortalPanel>

      {error ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {actionState.error ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {actionState.error}
        </div>
      ) : null}

      {loading && notifications.length === 0 ? (
        <PortalPanel title="Loading notifications" description="Refreshing your student inbox.">
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-[24px] bg-slate-100" />
            ))}
          </div>
        </PortalPanel>
      ) : notifications.length === 0 ? (
        <PortalEmptyState
          title="No notifications in this view"
          description="You are caught up for the current filter. Switch categories to inspect other inbox activity."
          icon={Bell}
        />
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([date, items]) => (
            <PortalPanel
              key={date}
              title={date}
              description={`${items.length} item${items.length === 1 ? "" : "s"} on this date.`}
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
                          ? "border-slate-200 bg-slate-50/80"
                          : "border-blue-200 bg-blue-50/65 shadow-[0_18px_45px_-34px_rgba(29,78,216,0.28)]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${typeColor[notification.type]}`}
                        >
                          <Icon size={17} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {notification.title}
                              </p>
                              <p className="mt-1 text-sm leading-7 text-slate-500">
                                {notification.body}
                              </p>
                            </div>
                            {!notification.read ? (
                              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" />
                            ) : null}
                          </div>
                          <p className="mt-3 text-[11px] text-slate-400">
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
