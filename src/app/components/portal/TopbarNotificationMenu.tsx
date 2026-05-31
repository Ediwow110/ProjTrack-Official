import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bell,
  CheckCheck,
  ChevronRight,
  Clock3,
  FileText,
  Info,
  RefreshCcw,
  Star,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type {
  AdminNotificationRecord,
  StudentPortalNotification,
  TeacherPortalNotification,
} from "../../lib/api/contracts";
import {
  adminService,
  studentCatalogService,
  teacherNotificationService,
} from "../../lib/api/services";
import {
  invalidateNotificationBadge,
  subscribeNotificationBadgeInvalidation,
} from "../../lib/notificationBadges";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

type PortalNotificationRole = "student" | "teacher" | "admin";

type PreviewNotification =
  | AdminNotificationRecord
  | StudentPortalNotification
  | TeacherPortalNotification;

type NotificationTone = {
  icon: LucideIcon;
  badgeClass: string;
};

const notificationToneMap: Record<string, NotificationTone> = {
  account: {
    icon: UserPlus,
    badgeClass: "bg-blue-50 text-blue-600 dark:text-blue-300 dark:bg-blue-500/15 dark:text-blue-200",
  },
  deadline: {
    icon: Clock3,
    badgeClass: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-200",
  },
  feedback: {
    icon: FileText,
    badgeClass: "bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-200",
  },
  grade: {
    icon: Star,
    badgeClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-200",
  },
  info: {
    icon: Info,
    badgeClass: "bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 dark:bg-slate-700/60 dark:text-slate-200",
  },
  overdue: {
    icon: AlertCircle,
    badgeClass: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-200",
  },
  request: {
    icon: FileText,
    badgeClass: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-200",
  },
  submit: {
    icon: FileText,
    badgeClass: "bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-200",
  },
  system: {
    icon: Bell,
    badgeClass: "bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 dark:bg-slate-700/60 dark:text-slate-200",
  },
};

const accentClassMap: Record<
  PortalNotificationRole,
  {
    activeTrigger: string;
    subtleText: string;
    unreadDot: string;
    actionButton: string;
    markReadButton: string;
  }
> = {
  student: {
    activeTrigger:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-100",
    subtleText: "text-blue-700 dark:text-blue-300 dark:text-blue-200",
    unreadDot: "bg-blue-600 dark:bg-blue-300",
    actionButton:
      "bg-blue-700 text-white hover:bg-blue-800 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400",
    markReadButton:
      "text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:text-blue-200 dark:hover:text-blue-100",
  },
  teacher: {
    activeTrigger:
      "border-teal-200 bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 dark:border-teal-400/30 dark:bg-teal-500/15 dark:text-teal-100",
    subtleText: "text-teal-700 dark:text-teal-300 dark:text-teal-200",
    unreadDot: "bg-teal-600 dark:bg-teal-300",
    actionButton:
      "bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400",
    markReadButton:
      "text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:text-teal-200 dark:hover:text-teal-100",
  },
  admin: {
    activeTrigger:
      "border-slate-300 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 dark:border-slate-500/40 dark:bg-slate-700/40 dark:text-slate-100",
    subtleText: "text-slate-700 dark:text-slate-200",
    unreadDot: "bg-slate-700 dark:bg-slate-300",
    actionButton:
      "bg-slate-900 text-white hover:bg-slate-950 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200",
    markReadButton:
      "text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white",
  },
};

function parseNotificationDate(date: string, time: string, fallbackIndex: number) {
  const parsed = new Date(`${date} ${time}`);
  if (!Number.isNaN(parsed.getTime())) return parsed.getTime();

  const dateOnly = new Date(date);
  if (!Number.isNaN(dateOnly.getTime())) return dateOnly.getTime() - fallbackIndex;

  return Date.now() - fallbackIndex;
}

async function getNotificationsForRole(role: PortalNotificationRole): Promise<PreviewNotification[]> {
  if (role === "student") {
    return studentCatalogService.getNotifications();
  }

  if (role === "teacher") {
    return teacherNotificationService.getNotifications();
  }

  return adminService.getNotifications();
}

async function markNotificationReadForRole(role: PortalNotificationRole, id: string) {
  if (role === "student") {
    return studentCatalogService.markNotificationRead(id);
  }

  if (role === "teacher") {
    return teacherNotificationService.markNotificationRead(id);
  }

  return adminService.markNotificationRead(id);
}

async function markAllNotificationsReadForRole(role: PortalNotificationRole) {
  if (role === "student") {
    return studentCatalogService.markAllNotificationsRead();
  }

  if (role === "teacher") {
    return teacherNotificationService.markAllNotificationsRead();
  }

  return adminService.markAllNotificationsRead();
}

export function TopbarNotificationMenu({
  role,
  badgeCount,
  notificationsTarget,
  isActive,
  onNavigate,
}: {
  role: PortalNotificationRole;
  badgeCount: number | null;
  notificationsTarget: string;
  isActive: boolean;
  onNavigate: (target: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<PreviewNotification[]>([]);

  const accent = accentClassMap[role];

  const sortedNotifications = useMemo(
    () =>
      notifications
        .slice()
        .sort(
          (left, right) =>
            parseNotificationDate(right.date, right.time, 0) -
            parseNotificationDate(left.date, left.time, 1),
        ),
    [notifications],
  );
  const previewNotifications = sortedNotifications.slice(0, 5);
  const unreadCount = sortedNotifications.filter((item) => !item.read).length;
  const visibleBadgeCount = notifications.length > 0 ? unreadCount : badgeCount ?? 0;

  const loadNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextNotifications = await getNotificationsForRole(role);
      setNotifications(nextNotifications);
    } catch {
      setError("Unable to load notifications right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadNotifications();
  }, [open, role]);

  useEffect(() => {
    const unsubscribe = subscribeNotificationBadgeInvalidation((detail) => {
      if (detail.role !== role) return;
      if (!open) return;
      void loadNotifications();
    });

    return unsubscribe;
  }, [open, role]);

  const handleMarkOneRead = async (id: string) => {
    const existing = notifications.find((item) => item.id === id);
    if (!existing || existing.read || actionBusy) return;

    setActionBusy(true);
    setError(null);
    try {
      await markNotificationReadForRole(role, id);
      setNotifications((current) =>
        current.map((item) => (item.id === id ? { ...item, read: true } : item)),
      );
      invalidateNotificationBadge(role);
    } catch {
      setError("Unable to mark that notification as read.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (actionBusy || unreadCount === 0) return;

    setActionBusy(true);
    setError(null);
    try {
      await markAllNotificationsReadForRole(role);
      setNotifications((current) => current.map((item) => ({ ...item, read: true })));
      invalidateNotificationBadge(role);
    } catch {
      setError("Unable to mark all notifications as read.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleViewAll = () => {
    setOpen(false);
    onNavigate(notificationsTarget);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`Open ${role} notifications`}
        aria-current={isActive ? "page" : undefined}
        className={`relative flex h-10 w-10 items-center justify-center rounded-2xl border transition-colors ${
          isActive
            ? accent.activeTrigger
            : "border-slate-200/70 bg-white/70 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-800"
        }`}
      >
        <Bell size={17} />
        {visibleBadgeCount > 0 ? (
          <span className="absolute top-1 right-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white">
            {visibleBadgeCount > 9 ? "9+" : visibleBadgeCount}
          </span>
        ) : null}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[min(calc(100vw-2rem),23rem)] rounded-[26px] border border-slate-200/85 bg-white/96 p-0 shadow-[0_24px_80px_-42px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/96"
      >
        <div className="border-b border-slate-200/75 px-5 py-4 dark:border-slate-700/60">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Notifications
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {visibleBadgeCount > 0
                  ? `${visibleBadgeCount} unread update${visibleBadgeCount === 1 ? "" : "s"}`
                  : "You are all caught up."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadNotifications()}
                disabled={loading || actionBusy}
                aria-label="Refresh notifications"
                className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200/75 bg-white dark:bg-slate-900/85 text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-60 dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <RefreshCcw size={15} className={loading ? "animate-spin" : undefined} />
              </button>
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                disabled={actionBusy || unreadCount === 0}
                className={`inline-flex h-9 items-center gap-2 rounded-2xl px-3 text-xs font-semibold transition-colors disabled:opacity-60 ${accent.actionButton}`}
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            </div>
          </div>
        </div>

        <div className="max-h-[26rem] overflow-y-auto px-3 py-3">
          {error ? (
            <div className="mx-2 rounded-[20px] border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              {error}
            </div>
          ) : null}

          {loading && previewNotifications.length === 0 ? (
            <div className="space-y-3 p-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-20 animate-pulse rounded-[22px] bg-slate-100 dark:bg-slate-800/80"
                />
              ))}
            </div>
          ) : previewNotifications.length === 0 ? (
            <div className="mx-2 rounded-[22px] border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/80 px-5 py-8 text-center dark:border-slate-700/60 dark:bg-slate-800/45">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-slate-900/85 text-slate-500 dark:text-slate-400 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                <Bell size={18} />
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
                No recent notifications
              </p>
              <p className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400">
                New updates will appear here before you open the full notifications page.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {previewNotifications.map((notification) => {
                const tone = notificationToneMap[notification.type] ?? notificationToneMap.info;
                const Icon = tone.icon;

                return (
                  <div
                    key={notification.id}
                    className={`rounded-[22px] border px-4 py-3 transition-colors ${
                      notification.read
                        ? "border-slate-200/80 bg-white/70 dark:border-slate-700/60 dark:bg-slate-900/65"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50/90 shadow-[0_16px_32px_-32px_rgba(15,23,42,0.45)] dark:border-slate-600/70 dark:bg-slate-800/85"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone.badgeClass}`}
                      >
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={handleViewAll}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {notification.title}
                              </p>
                              {!notification.read ? (
                                <span
                                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${accent.unreadDot}`}
                                />
                              ) : null}
                            </div>
                            <p className="mt-1 truncate text-xs leading-6 text-slate-500 dark:text-slate-400">
                              {notification.body}
                            </p>
                          </button>
                          {!notification.read ? (
                            <button
                              type="button"
                              onClick={() => void handleMarkOneRead(notification.id)}
                              disabled={actionBusy}
                              className={`shrink-0 text-[11px] font-semibold transition-colors disabled:opacity-60 ${accent.markReadButton}`}
                            >
                              Mark read
                            </button>
                          ) : null}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p className="text-[11px] text-slate-400 dark:text-slate-300 dark:text-slate-500">
                            {notification.date} · {notification.time}
                          </p>
                          <button
                            type="button"
                            onClick={handleViewAll}
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold transition-colors ${accent.subtleText}`}
                          >
                            Open
                            <ChevronRight size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200/75 px-4 py-3 dark:border-slate-700/60">
          <button
            type="button"
            onClick={handleViewAll}
            className="flex w-full items-center justify-center gap-2 rounded-[20px] border border-slate-200/80 bg-white dark:bg-slate-900/85 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            View all notifications
            <ChevronRight size={15} />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
