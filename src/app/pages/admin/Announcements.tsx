import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  CalendarClock,
  Mail,
  Megaphone,
  Plus,
  RefreshCcw,
  Send,
  Trash2,
} from "lucide-react";

import { AppModal } from "../../components/ui/app-modal";
import { Checkbox } from "../../components/ui/checkbox";
import { adminService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";

type DeliveryMode = "now" | "schedule";

function nextScheduleValue() {
  const next = new Date(Date.now() + 60 * 60 * 1000);
  next.setMinutes(0, 0, 0);
  return next.toISOString().slice(0, 16);
}

function formatAudience(value: string) {
  switch (String(value || "").toUpperCase()) {
    case "ALL":
      return "All Users";
    case "STUDENTS":
      return "Students";
    case "TEACHERS":
      return "Teachers";
    case "ADMINS":
      return "Admins";
    default:
      return value || "All Users";
  }
}

function statusTone(status: string) {
  if (status === "Sent") {
    return "border border-emerald-200/70 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 dark:border-emerald-500/25 dark:bg-emerald-500/12 dark:text-emerald-200";
  }
  if (status === "Scheduled") {
    return "border border-violet-200/70 bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 dark:border-violet-500/25 dark:bg-violet-500/12 dark:text-violet-200";
  }
  return "border border-amber-200/70 bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 dark:border-amber-500/25 dark:bg-amber-500/12 dark:text-amber-200";
}

function newAnnouncementForm() {
  return {
    title: "",
    audience: "ALL",
    channel: "System + Email",
    deliveryMode: "now" as DeliveryMode,
    scheduledAt: nextScheduleValue(),
    body: "",
  };
}

const announcementFieldClassName =
  "portal-input w-full rounded-lg px-3 py-2.5 text-sm outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-700/10 dark:focus:border-blue-400 dark:focus:ring-blue-400/20";

const adminHeadingClassName = "font-bold text-[var(--text-strong)]";
const adminMutedClassName = "text-[var(--text-muted)]";
const adminSubtleClassName = "text-[var(--text-subtle)]";
const adminCardClassName = "portal-card rounded-xl border p-4 shadow-[var(--shadow-soft)]";
const adminButtonSecondaryClassName =
  "portal-action-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50";
const adminPillClassName =
  "portal-action-secondary rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50";

export default function AdminAnnouncements() {
  const [filter, setFilter] = useState("All");
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [form, setForm] = useState(newAnnouncementForm);
  const [submitState, setSubmitState] = useState<{ saving: boolean; error: string | null }>({
    saving: false,
    error: null,
  });
  const fetchAnnouncements = useMemo(
    () => () => adminService.getAnnouncements({ status: filter }),
    [filter],
  );
  const { data, loading, error, setData, reload } = useAsyncData(fetchAnnouncements, [fetchAnnouncements]);
  const items = data ?? [];
  const busy = loading || submitState.saving;
  const counts = {
    total: items.length,
    scheduled: items.filter((item) => item.status === "Scheduled").length,
    sent: items.filter((item) => item.status === "Sent").length,
    draft: items.filter((item) => item.status === "Draft").length,
  };
  const selectedCount = selectedIds.length;

  useEffect(() => {
    setSelectedIds([]);
  }, [filter]);

  const closeModal = (force = false) => {
    if (!force && submitState.saving) return;
    setOpen(false);
    setSubmitState({ saving: false, error: null });
    setForm(newAnnouncementForm());
  };

  const submit = async () => {
    const title = form.title.trim();
    const body = form.body.trim();
    if (!title || !body) {
      setSubmitState({
        saving: false,
        error: "Title and message are required before publishing an announcement.",
      });
      return;
    }

    if (form.deliveryMode === "schedule" && !form.scheduledAt) {
      setSubmitState({
        saving: false,
        error: "Choose a schedule time before saving a scheduled announcement.",
      });
      return;
    }

    setSubmitState({ saving: true, error: null });

    try {
      const publishAt =
        form.deliveryMode === "schedule"
          ? new Date(form.scheduledAt).toISOString()
          : new Date().toISOString();

      const created = await adminService.createAnnouncement({
        title,
        audience: form.audience,
        channel: form.channel,
        status: form.deliveryMode === "schedule" ? "Scheduled" : "Sent",
        when: publishAt,
        body,
      });

      setData((current) => ([created, ...(current ?? [])]) as typeof data);
      await reload();
      closeModal(true);
    } catch (submitError) {
      setSubmitState({
        saving: false,
        error:
          submitError instanceof Error
            ? submitError.message
            : "Unable to create the announcement right now.",
      });
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
      current.length === items.length ? [] : items.map((item) => item.id),
    );
  };

  const deleteAnnouncements = async (ids: string[]) => {
    const normalizedIds = Array.from(
      new Set(ids.map((id) => String(id ?? "").trim()).filter(Boolean)),
    );
    if (!normalizedIds.length || busy) return;

    setSubmitState({ saving: true, error: null });
    try {
      await adminService.deleteAnnouncements(normalizedIds);
      setData((current) =>
        (current ?? []).filter((item) => !normalizedIds.includes(item.id)),
      );
      setSelectedIds((current) =>
        current.filter((id) => !normalizedIds.includes(id)),
      );
      await reload();
      setSubmitState({ saving: false, error: null });
    } catch (deleteError) {
      setSubmitState({
        saving: false,
        error:
          deleteError instanceof Error
            ? deleteError.message
            : "Unable to delete the selected announcements right now.",
      });
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className={`${adminHeadingClassName} ${busy ? "opacity-80" : ""}`}
            style={{ fontSize: "1.3rem", letterSpacing: "-0.02em" }}
          >
            Announcements
          </h1>
          <p className={`mt-0.5 text-sm ${adminMutedClassName} ${busy ? "opacity-80" : ""}`}>
            Publish and schedule institution-wide announcements from the admin portal.
          </p>
          <p className={`mt-1 text-xs ${adminSubtleClassName}`}>
            {loading ? "Loading announcements…" : `${items.length} announcement${items.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 ? (
            <button
              disabled={busy}
              onClick={() => void deleteAnnouncements(selectedIds)}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-2.5 text-sm font-semibold text-rose-700 dark:text-rose-300 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/12 dark:text-rose-200 dark:hover:bg-rose-500/20"
            >
              <Trash2 size={14} />
              Delete Selected ({selectedCount})
            </button>
          ) : null}
          <button
            disabled={busy}
            onClick={reload}
            className={adminButtonSecondaryClassName}
          >
            <RefreshCcw size={14} />
            Refresh
          </button>
          <button
            disabled={busy}
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-50"
          >
            <Plus size={14} />
            New Announcement
          </button>
        </div>
      </div>

      {submitState.error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300 dark:border-rose-500/30 dark:bg-rose-500/12 dark:text-rose-200">
          {submitState.error}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300 dark:border-rose-500/30 dark:bg-rose-500/12 dark:text-rose-200">
          {error}
        </div>
      )}

      {loading && items.length === 0 && (
        <div className={`text-xs ${adminSubtleClassName}`}>
          Announcement metrics will update once the latest broadcast data finishes loading.
        </div>
      )}

      <div className={`grid grid-cols-2 gap-4 lg:grid-cols-4 ${busy ? "opacity-80" : ""}`}>
        {[
          { label: "Total Broadcasts", value: counts.total, icon: Megaphone, tone: "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 dark:bg-blue-500/12 dark:text-blue-200" },
          { label: "Scheduled", value: counts.scheduled, icon: CalendarClock, tone: "bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 dark:bg-violet-500/12 dark:text-violet-200" },
          { label: "Sent", value: counts.sent, icon: Send, tone: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-500/12 dark:text-emerald-200" },
          { label: "Drafts", value: counts.draft, icon: Mail, tone: "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 dark:bg-amber-500/12 dark:text-amber-200" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className={adminCardClassName}>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.tone}`}>
                <Icon size={15} />
              </div>
              <p className="mt-3 text-2xl font-bold text-[var(--text-strong)]">{item.value}</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{item.label}</p>
            </div>
          );
        })}
      </div>

      <div className={`flex flex-wrap gap-2 ${busy ? "opacity-80" : ""}`}>
        {items.length > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={toggleSelectAll}
            className={adminPillClassName}
          >
            {selectedCount === items.length ? "Clear selection" : "Select all"}
          </button>
        ) : null}
        {["All", "Scheduled", "Sent", "Draft"].map((status) => (
          <button
            key={status}
            disabled={busy}
            onClick={() => setFilter(status)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 ${
              filter === status
                ? "bg-blue-800 text-white"
                : "portal-action-secondary"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {loading && (
        <div className="portal-card rounded-xl border p-5 text-sm text-[var(--text-muted)] shadow-[var(--shadow-soft)]">
          Loading announcements…
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="portal-card flex flex-col gap-4 rounded-xl border p-5 shadow-[var(--shadow-soft)] lg:flex-row lg:items-start"
          >
            <div className="flex items-start gap-4">
              <Checkbox
                checked={selectedIds.includes(item.id)}
                onCheckedChange={() => toggleSelected(item.id)}
                aria-label={`Select announcement ${item.title}`}
                disabled={busy}
              />
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 dark:bg-blue-500/12 dark:text-blue-200">
                <Megaphone size={17} />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-[var(--text-strong)]">{item.title}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone(item.status)}`}>
                  {item.status}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{item.body}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-[11px] font-medium text-[var(--text-subtle)]">
                <span>Audience: {formatAudience(item.audience)}</span>
                <span>Channel: {item.channel}</span>
                <span>Delivery: {item.when}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-start justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => void deleteAnnouncements([item.id])}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 transition hover:bg-rose-100 disabled:opacity-50"
              >
                <Trash2 size={13} />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {!loading && !error && items.length === 0 && (
        <div className="portal-card rounded-xl border border-dashed p-8 text-center text-sm text-[var(--text-subtle)]">
          No announcements matched the current filter.
        </div>
      )}

      <AppModal
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setOpen(true);
            return;
          }
          closeModal();
        }}
        title="New Announcement"
        description="Publish now or schedule a future announcement for the selected audience."
        size="xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => closeModal()}
              className="portal-action-secondary rounded-lg px-4 py-2 text-sm font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitState.saving}
              onClick={submit}
              className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:opacity-50"
            >
              {submitState.saving
                ? "Saving…"
                : form.deliveryMode === "schedule"
                  ? "Schedule Announcement"
                  : "Publish Announcement"}
            </button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="announcement-title" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300">
              Title
            </label>
            <input
              id="announcement-title"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className={announcementFieldClassName}
              placeholder="Enter announcement title"
            />
          </div>

          <div>
            <label htmlFor="announcement-audience" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300">
              Audience
            </label>
            <select
              id="announcement-audience"
              value={form.audience}
              onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))}
              className={announcementFieldClassName}
            >
              <option value="ALL">All Users</option>
              <option value="STUDENTS">Students</option>
              <option value="TEACHERS">Teachers</option>
              <option value="ADMINS">Admins</option>
            </select>
          </div>

          <div>
            <label htmlFor="announcement-channel" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300">
              Delivery Intent
            </label>
            <select
              id="announcement-channel"
              value={form.channel}
              onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value }))}
              className={announcementFieldClassName}
            >
              <option>System + Email</option>
              <option>System</option>
              <option>Email</option>
            </select>
          </div>

          <div>
            <label htmlFor="announcement-delivery-mode" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300">
              Delivery Mode
            </label>
            <select
              id="announcement-delivery-mode"
              value={form.deliveryMode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  deliveryMode: event.target.value as DeliveryMode,
                }))
              }
              className={announcementFieldClassName}
            >
              <option value="now">Publish now</option>
              <option value="schedule">Schedule for later</option>
            </select>
          </div>

          {form.deliveryMode === "schedule" && (
            <div className="md:col-span-2">
              <label htmlFor="announcement-scheduled-at" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300">
                Scheduled Time
              </label>
              <input
                id="announcement-scheduled-at"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(event) => setForm((current) => ({ ...current, scheduledAt: event.target.value }))}
                className={announcementFieldClassName}
              />
            </div>
          )}

          <div className="md:col-span-2">
            <label htmlFor="announcement-body" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300">
              Message
            </label>
            <textarea
              id="announcement-body"
              rows={5}
              value={form.body}
              onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
              className={`${announcementFieldClassName} resize-none`}
              placeholder="Write the announcement body here…"
            />
          </div>

          <div className="md:col-span-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-subtle)]">Preview</p>
            <div className="portal-card mt-3 rounded-xl border border-blue-100 p-4 dark:border-blue-500/30">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-300">
                <BellRing size={14} />
                PROJTRACK Broadcast Preview
              </div>
              <p className="mt-3 text-sm font-semibold text-[var(--text-strong)]">
                {form.title || "Your announcement title"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                {form.body || "Announcement content preview will appear here in the same clean PROJTRACK style."}
              </p>
              <p className="mt-3 text-[11px] font-medium text-[var(--text-subtle)]">
                {form.deliveryMode === "schedule"
                  ? `Scheduled for ${form.scheduledAt || "a selected time"}`
                  : "Publishes immediately"}
              </p>
            </div>
          </div>
        </div>
      </AppModal>
    </div>
  );
}
