import type { ReactNode } from "react";
import { BookOpen, Mail, School, Users } from "lucide-react";

import { DetailDrawer } from "../shared/DetailDrawer";
import { Button } from "../../ui/button";
import { StatusChip } from "../../ui/StatusChip";
import { BodyText, Eyebrow, SectionTitle } from "../../ui/typography";
import type { AdminTeacherRecord } from "../../../lib/api/contracts";

type TeacherPreviewDrawerProps = {
  open: boolean;
  teacher?: AdminTeacherRecord | null;
  actionBusy?: boolean;
  onClose: () => void;
  onView: (id: string) => void;
  onActivate: (id: string) => void;
  onReset: (id: string) => void;
  onDeactivate: (teacher: AdminTeacherRecord) => void;
};

function MetadataCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-slate-200/75 bg-white/90 p-4 shadow-[var(--shadow-soft)] dark:border-slate-700/60 dark:bg-slate-900/70">
      <div className="mb-2 flex items-center gap-2 text-slate-400 dark:text-slate-300 dark:text-slate-500">
        {icon}
        <Eyebrow className="text-[0.65rem]">{label}</Eyebrow>
      </div>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}

export function TeacherPreviewDrawer({
  open,
  teacher,
  actionBusy = false,
  onClose,
  onView,
  onActivate,
  onReset,
  onDeactivate,
}: TeacherPreviewDrawerProps) {
  return (
    <DetailDrawer
      open={open}
      title={teacher?.name ?? "Teacher preview"}
      subtitle={teacher ? `${teacher.id} · ${teacher.email}` : "Quick teacher overview"}
      onClose={onClose}
      widthPreset="md"
      footer={
        teacher ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button type="button" variant="outline" onClick={() => onView(teacher.id)}>
              View full page
            </Button>
          </div>
        ) : null
      }
    >
      {teacher ? (
        <div className="space-y-6">
          <div className="rounded-[var(--radius-panel)] border border-slate-200/75 bg-white/92 p-5 shadow-[var(--shadow-soft)] dark:border-slate-700/60 dark:bg-slate-900/75">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Eyebrow>Faculty account</Eyebrow>
                <SectionTitle className="mt-2">{teacher.name}</SectionTitle>
                <BodyText className="mt-2" tone="muted">
                  Review teaching coverage, setup access links, or move into the full teacher profile.
                </BodyText>
              </div>
              <StatusChip status={teacher.status} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <MetadataCard label="Email" value={teacher.email} icon={<Mail size={14} />} />
            <MetadataCard label="Department" value={teacher.dept} icon={<School size={14} />} />
            <MetadataCard label="Subjects" value={String(teacher.subjects)} icon={<BookOpen size={14} />} />
            <MetadataCard label="Students" value={String(teacher.students)} icon={<Users size={14} />} />
          </div>

          <div className="rounded-[var(--radius-panel)] border border-slate-200/75 bg-white/92 p-5 shadow-[var(--shadow-soft)] dark:border-slate-700/60 dark:bg-slate-900/75">
            <Eyebrow>Quick actions</Eyebrow>
            <div className="mt-4 flex flex-wrap gap-2">
              {teacher.status === "Pending Activation" ? (
                <Button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => onActivate(teacher.id)}
                  className="bg-[var(--role-accent)] text-white hover:bg-[var(--role-accent-strong)]"
                >
                  Send setup link
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => onReset(teacher.id)}
                  className="bg-[var(--role-accent)] text-white hover:bg-[var(--role-accent-strong)]"
                >
                  Send reset link
                </Button>
              )}
              {teacher.status !== "Inactive" ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={actionBusy}
                  onClick={() => onDeactivate(teacher)}
                >
                  Deactivate
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </DetailDrawer>
  );
}
