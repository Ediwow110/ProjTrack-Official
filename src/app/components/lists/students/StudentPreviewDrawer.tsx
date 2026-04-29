import type { ReactNode } from "react";
import { Mail, ShieldCheck, UserRound } from "lucide-react";

import { DetailDrawer } from "../shared/DetailDrawer";
import { Button } from "../../ui/button";
import { StatusChip } from "../../ui/StatusChip";
import { BodyText, Eyebrow, SectionTitle } from "../../ui/typography";
import type { AdminStudentRecord } from "../../../lib/api/contracts";

type StudentPreviewDrawerProps = {
  open: boolean;
  student?: AdminStudentRecord | null;
  actionBusy?: boolean;
  onClose: () => void;
  onView: (id: string) => void;
  onSendSetupLink: (id: string) => void;
  onDeactivate: (student: AdminStudentRecord) => void;
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

export function StudentPreviewDrawer({
  open,
  student,
  actionBusy = false,
  onClose,
  onView,
  onSendSetupLink,
  onDeactivate,
}: StudentPreviewDrawerProps) {
  const studentIdentifier = student?.studentId || student?.id || "—";

  return (
    <DetailDrawer
      open={open}
      title={student?.name ?? "Student preview"}
      subtitle={student ? `${studentIdentifier} · ${student.email}` : "Quick student overview"}
      onClose={onClose}
      widthPreset="md"
      footer={
        student ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button type="button" variant="outline" onClick={() => onView(student.id)}>
              View full page
            </Button>
          </div>
        ) : null
      }
    >
      {student ? (
        <div className="space-y-6">
          <div className="rounded-[var(--radius-panel)] border border-slate-200/75 bg-white/92 p-5 shadow-[var(--shadow-soft)] dark:border-slate-700/60 dark:bg-slate-900/75">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Eyebrow>Student account</Eyebrow>
                <SectionTitle className="mt-2">{student.name}</SectionTitle>
                <BodyText className="mt-2" tone="muted">
                  Review the current portal status, queue setup email, or open the full record for edits.
                </BodyText>
              </div>
              <StatusChip status={student.status} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <MetadataCard label="Student ID" value={studentIdentifier} icon={<UserRound size={14} />} />
            <MetadataCard label="Email" value={student.email} icon={<Mail size={14} />} />
            <MetadataCard label="Section" value={student.section} icon={<UserRound size={14} />} />
            <MetadataCard label="Year Level" value={student.yearLevel || "—"} icon={<UserRound size={14} />} />
            <MetadataCard label="Course" value={student.course || "—"} icon={<UserRound size={14} />} />
            <MetadataCard label="M.I." value={student.middleInitial || ""} icon={<UserRound size={14} />} />
            <MetadataCard label="Created by" value={student.createdBy} icon={<ShieldCheck size={14} />} />
            <MetadataCard label="Last active" value={student.lastActive} icon={<UserRound size={14} />} />
          </div>

          <div className="rounded-[var(--radius-panel)] border border-slate-200/75 bg-white/92 p-5 shadow-[var(--shadow-soft)] dark:border-slate-700/60 dark:bg-slate-900/75">
            <Eyebrow>Quick actions</Eyebrow>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={
                  actionBusy ||
                  student.status === "Inactive" ||
                  student.status === "Restricted" ||
                  student.status === "Disabled" ||
                  student.status === "Archived" ||
                  student.status === "Graduated"
                }
                onClick={() => onSendSetupLink(student.id)}
                className="bg-[var(--role-accent)] text-white hover:bg-[var(--role-accent-strong)]"
              >
                {student.status === "Pending Setup" ? "Send setup email" : "Send password reset email"}
              </Button>
              {student.status !== "Inactive" ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={actionBusy}
                  onClick={() => onDeactivate(student)}
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
