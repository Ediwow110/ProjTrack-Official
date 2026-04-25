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
  if (status === "Sent") return "bg-emerald-50 text-emerald-700";
  if (status === "Scheduled") return "bg-violet-50 text-violet-700";
  return "bg-amber-50 text-amber-700";
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
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-700/10 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-400/20";

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
            className={`text-slate-900 font-bold ${busy ? "opacity-80" : ""}`}
            style={{ fontSize: "1.3rem", letterSpacing: "-0.02em" }}
          >
            Announcements
          </h1>
          <p className={`mt-0.5 text-sm text-slate-400 ${busy ? "opacity-80" : ""}`}>
            Publish and schedule institution-wide announcements from the admin portal.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {loading ? "Loading announcements…" : `${items.length} announcement${items.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 ? (
            <button
              disabled={busy}
              onClick={() => void deleteAnnouncements(selectedIds)}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            >
              <Trash2 size={14} />
              Delete Selected ({selectedCount})
            </button>
          ) : null}
          <button
            disabled={busy}
            onClick={reload}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {submitState.error}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {loading && items.length === 0 && (
        <div className="text-xs text-slate-400">
          Announcement metrics will update once the latest broadcast data finishes loading.
        </div>
      )}

      <div className={`grid grid-cols-2 gap-4 lg:grid-cols-4 ${busy ? "opacity-80" : ""}`}>
        {[
          { label: "Total Broadcasts", value: counts.total, icon: Megaphone, tone: "bg-blue-50 text-blue-700" },
          { label: "Scheduled", value: counts.scheduled, icon: CalendarClock, tone: "bg-violet-50 text-violet-700" },
          { label: "Sent", value: counts.sent, icon: Send, tone: "bg-emerald-50 text-emerald-700" },
          { label: "Drafts", value: counts.draft, icon: Mail, tone: "bg-amber-50 text-amber-700" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.tone}`}>
                <Icon size={15} />
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-900">{item.value}</p>
              <p className="mt-0.5 text-xs text-slate-500">{item.label}</p>
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
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
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
                : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {loading && (
        <div className="rounded-xl border border-slate-100 bg-white p-5 text-sm text-slate-500 shadow-sm">
          Loading announcements…
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm lg:flex-row lg:items-start"
          >
            <div className="flex items-start gap-4">
              <Checkbox
                checked={selectedIds.includes(item.id)}
                onCheckedChange={() => toggleSelected(item.id)}
                aria-label={`Select announcement ${item.title}`}
                disabled={busy}
              />
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Megaphone size={17} />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-slate-900">{item.title}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone(item.status)}`}>
                  {item.status}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.body}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-[11px] font-medium text-slate-400">
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
                className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
              >
                <Trash2 size={13} />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {!loading && !error && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
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
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
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
            <label htmlFor="announcement-title" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
            <label htmlFor="announcement-audience" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
            <label htmlFor="announcement-channel" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
            <label htmlFor="announcement-delivery-mode" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
              <label htmlFor="announcement-scheduled-at" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
            <label htmlFor="announcement-body" className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
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

          <div className="md:col-span-2 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Preview</p>
            <div className="mt-3 rounded-xl border border-blue-100 bg-white p-4 dark:border-blue-500/30 dark:bg-slate-950/70">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-300">
                <BellRing size={14} />
                PROJTRACK Broadcast Preview
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {form.title || "Your announcement title"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {form.body || "Announcement content preview will appear here in the same clean PROJTRACK style."}
              </p>
              <p className="mt-3 text-[11px] font-medium text-slate-400 dark:text-slate-500">
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
