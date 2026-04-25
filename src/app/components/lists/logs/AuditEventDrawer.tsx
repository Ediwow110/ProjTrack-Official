import { Copy, ExternalLink } from "lucide-react";

import { DetailDrawer } from "../shared/DetailDrawer";
import { Button } from "../../ui/button";
import { BodyText, Eyebrow, SectionTitle } from "../../ui/typography";
import type { AuditLogRecord } from "../../../lib/api/contracts";

const actionColor: Record<string, string> = {
  CREATE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  UPDATE: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
  DELETE: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
  APPROVE: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200",
  RESET: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  LOGIN: "bg-slate-100 text-slate-600 dark:bg-slate-700/70 dark:text-slate-200",
  IMPORT: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200",
  ACTIVATE: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  EMAIL: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200",
};

type AuditEventDrawerProps = {
  open: boolean;
  event?: AuditLogRecord | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
};

export function AuditEventDrawer({
  open,
  event,
  loading = false,
  error,
  onClose,
}: AuditEventDrawerProps) {
  return (
    <DetailDrawer
      open={open}
      title={event?.action ? `${event.action} event` : "Audit event"}
      subtitle={event ? `${event.module} · ${event.time}` : "Audit event details"}
      onClose={onClose}
      widthPreset="lg"
      footer={
        event ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(event.id)}>
              <Copy size={14} />
              Copy event ID
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : null
      }
    >
      {event ? (
        <div className="space-y-6">
          <div className="rounded-[var(--radius-panel)] border border-slate-200/75 bg-white/92 p-5 shadow-[var(--shadow-soft)] dark:border-slate-700/60 dark:bg-slate-900/75">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Eyebrow>Audit event</Eyebrow>
                <SectionTitle className="mt-2">{event.target}</SectionTitle>
                <BodyText className="mt-2" tone="muted">
                  Review actor, target, result, and before/after metadata without leaving the log table.
                </BodyText>
              </div>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${actionColor[event.action] ?? "bg-slate-100 text-slate-600 dark:bg-slate-700/70 dark:text-slate-200"}`}>
                {event.action}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <MetadataCard label="Module" value={event.module} />
            <MetadataCard label="Actor" value={event.user} />
            <MetadataCard label="Role" value={event.role} />
            <MetadataCard label="Timestamp" value={event.time} />
            <MetadataCard label="IP address" value={event.ip} />
            <MetadataCard label="Result" value={event.result} />
            <MetadataCard label="Session" value={event.session} />
            <MetadataCard label="Entity ID" value={event.entityId} />
          </div>

          <ContentCard title="Details" value={event.details} />
          {event.before ? <ContentCard title="Before" value={event.before} /> : null}
          {event.after ? <ContentCard title="After" value={event.after} /> : null}
          {loading ? (
            <BodyText tone="muted">Loading full audit log details...</BodyText>
          ) : null}
          {error ? (
            <BodyText className="text-rose-700 dark:text-rose-300" tone="default">
              {error}
            </BodyText>
          ) : null}
        </div>
      ) : null}
    </DetailDrawer>
  );
}

function MetadataCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-slate-200/75 bg-white/90 p-4 shadow-[var(--shadow-soft)] dark:border-slate-700/60 dark:bg-slate-900/70">
      <Eyebrow className="text-[0.65rem]">{label}</Eyebrow>
      <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}

function ContentCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-slate-200/75 bg-white/92 p-5 shadow-[var(--shadow-soft)] dark:border-slate-700/60 dark:bg-slate-900/75">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Eyebrow>{title}</Eyebrow>
        <ExternalLink size={14} className="text-slate-300 dark:text-slate-600" />
      </div>
      <BodyText className="text-sm leading-6" tone="default">
        {value}
      </BodyText>
    </div>
  );
}
