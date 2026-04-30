import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, UserPlus, FileText, RefreshCcw, Trash2, type LucideIcon } from "lucide-react";
import { CopyableIdChip } from "../../components/lists/shared/CopyableIdChip";
import { Checkbox } from "../../components/ui/checkbox";
import { adminService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import type { AdminNotificationRecord } from "../../lib/api/contracts";
import { invalidateNotificationBadge } from "../../lib/notificationBadges";

const typeIcon: Record<string, LucideIcon> = {
  account: UserPlus,
  request: FileText,
  system: Bell,
};

const typeColor: Record<string, string> = {
  account: "bg-blue-50 text-blue-600",
  request: "bg-amber-50 text-amber-600",
  system: "bg-slate-100 text-slate-500",
};

export default function AdminNotifications() {
  const [filter, setFilter] = useState("All");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionState, setActionState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const fetchNotifications = useMemo(() => () => adminService.getNotifications({ type: filter }), [filter]);
  const { data, loading, error, setData, reload } = useAsyncData(fetchNotifications, [fetchNotifications]);
  const notifications = data ?? [];
  const unread = notifications.filter((n) => !n.read).length;
  const selectedCount = selectedIds.length;
  const types = ["All", "Account", "Request", "System"];

  const grouped = useMemo(() => notifications.reduce<Record<string, AdminNotificationRecord[]>>((acc, n) => {
    if (!acc[n.date]) acc[n.date] = [];
    acc[n.date].push(n);
    return acc;
  }, {}), [notifications]);

  useEffect(() => {
    setSelectedIds([]);
  }, [filter]);

  const markOneRead = async (id: string) => {
    const existing = notifications.find((item) => item.id === id);
    if (!existing || existing.read || actionState.busy) return;
    setActionState({ busy: true, error: null });
    try {
      await adminService.markNotificationRead(id);
      setData((current) => current ? current.map((item) => item.id === id ? { ...item, read: true } : item) : current);
      await reload();
      invalidateNotificationBadge("admin");
      setActionState({ busy: false, error: null });
    } catch {
      setActionState({ busy: false, error: "Unable to update the selected notification." });
    }
  };

  const markAllRead = async () => {
    if (actionState.busy || unread === 0) return;
    setActionState({ busy: true, error: null });
    try {
      await adminService.markAllNotificationsRead();
      setData((current) => current ? current.map((item) => ({ ...item, read: true })) : current);
      await reload();
      invalidateNotificationBadge("admin");
      setActionState({ busy: false, error: null });
    } catch {
      setActionState({ busy: false, error: "Unable to mark all notifications as read." });
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds((current) =>
      current.length === notifications.length ? [] : notifications.map((item) => item.id),
    );
  };

  const deleteNotifications = async (ids: string[]) => {
    const normalizedIds = Array.from(
      new Set(ids.map((id) => String(id ?? "").trim()).filter(Boolean)),
    );
    if (!normalizedIds.length || actionState.busy) return;

    setActionState({ busy: true, error: null });
    try {
      await adminService.deleteNotifications(normalizedIds);
      setData((current) =>
        current ? current.filter((item) => !normalizedIds.includes(item.id)) : current,
      );
      setSelectedIds((current) => current.filter((id) => !normalizedIds.includes(id)));
      await reload();
      invalidateNotificationBadge("admin");
      setActionState({ busy: false, error: null });
    } catch (deleteError) {
      setActionState({
        busy: false,
        error:
          deleteError instanceof Error
            ? deleteError.message
            : "Unable to delete the selected notifications.",
      });
    }
  };

  return (
    <div className="portal-surface p-6 max-w-[88rem] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-slate-900 dark:text-slate-100 font-bold" style={{ fontSize: "1.3rem", letterSpacing: "-0.02em" }}>Notifications</h1>
          <p className="text-slate-400 text-sm mt-0.5">{loading ? "Loading notifications…" : unread > 0 ? `${unread} unread system alerts` : "All caught up."}</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedCount > 0 && (
            <button disabled={loading || actionState.busy} onClick={() => void deleteNotifications(selectedIds)} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50">
              <Trash2 size={14} /> Delete Selected ({selectedCount})
            </button>
          )}
          {unread > 0 && (
            <button disabled={loading || actionState.busy} onClick={markAllRead} className="flex items-center gap-1.5 text-blue-700 text-sm font-semibold hover:underline disabled:opacity-50">
              <CheckCheck size={15} /> Mark all read
            </button>
          )}
          <button disabled={loading || actionState.busy} onClick={reload} className="portal-input inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-800/85">
            <RefreshCcw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {notifications.length > 0 && (
          <button disabled={loading || actionState.busy} onClick={toggleSelectAll} className="portal-input px-3 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-50 text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/85">
            {selectedCount === notifications.length ? "Clear selection" : "Select all"}
          </button>
        )}
        {types.map((t) => (
          <button key={t} disabled={loading || actionState.busy} onClick={() => setFilter(t)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-50 ${filter === t ? "bg-blue-800 text-white" : "portal-input text-slate-500 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/85"}`}>
            {t}
          </button>
        ))}
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm">{error}</div>}
      {actionState.error && <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm">{actionState.error}</div>}

      {loading && notifications.length === 0 ? (
        <div className="portal-card rounded-xl border shadow-sm p-5 text-sm text-slate-500">Loading notifications…</div>
      ) : notifications.length === 0 ? (
        <div className="portal-card rounded-xl border shadow-sm p-10 text-center text-sm text-slate-500">No notifications in this view.</div>
      ) : (
        Object.entries(grouped).map(([date, items]) => (
          <div key={date}>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{date}</p>
            <div className="space-y-2">
              {items.map((n) => {
                const Icon = typeIcon[n.type] ?? Bell;
                return (
                  <div
                    key={n.id}
                    className={`w-full flex items-start gap-3.5 p-4 rounded-xl border transition-all ${actionState.busy ? "opacity-70" : ""} ${n.read ? "portal-card" : "border-blue-100 bg-blue-50/40 dark:border-blue-400/30 dark:bg-blue-500/12"}`}
                  >
                    <Checkbox
                      checked={selectedIds.includes(n.id)}
                      onCheckedChange={() => toggleSelected(n.id)}
                      aria-label={`Select notification ${n.title}`}
                      disabled={loading || actionState.busy}
                    />
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeColor[n.type]}`}>
                      <Icon size={15} strokeWidth={1.8} />
                    </div>
                    <button
                      type="button"
                      onClick={() => void markOneRead(n.id)}
                      disabled={actionState.busy}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-semibold ${n.read ? "text-slate-700 dark:text-slate-100" : "text-slate-900 dark:text-slate-50"}`}>{n.title}</p>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />}
                      </div>
                      <p className="text-slate-500 dark:text-slate-300 text-xs mt-0.5 leading-relaxed">{n.body}</p>
                      <p className="text-slate-400 text-[10px] mt-1">{n.time}</p>
                    </button>
                    <div className="mt-8 flex flex-wrap items-center gap-2 self-end">
                      <CopyableIdChip value={n.id} label="Copy Notification ID" className="bg-transparent px-0" />
                      {n.userId ? (
                        <CopyableIdChip value={n.userId} label="Copy User ID" className="bg-transparent px-0" />
                      ) : null}
                      {n.dedupeKey ? (
                        <CopyableIdChip value={n.dedupeKey} label="Copy Dedupe Key" className="bg-transparent px-0" />
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={loading || actionState.busy}
                      onClick={() => void deleteNotifications([n.id])}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
