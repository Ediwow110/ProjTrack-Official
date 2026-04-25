import type { ReactNode } from "react";
import { CalendarClock, FileText, GraduationCap, UserRound } from "lucide-react";

import { DetailDrawer } from "../shared/DetailDrawer";
import { Button } from "../../ui/button";
import { StatusChip } from "../../ui/StatusChip";
import { BodyText, Eyebrow, SectionTitle } from "../../ui/typography";
import type { AdminSubmissionRecord } from "../../../lib/api/contracts";

type SubmissionPreviewDrawerProps = {
  open: boolean;
  submission?: AdminSubmissionRecord | null;
  onClose: () => void;
  onView: (id: string) => void;
};

export function SubmissionPreviewDrawer({
  open,
  submission,
  onClose,
  onView,
}: SubmissionPreviewDrawerProps) {
  return (
    <DetailDrawer
      open={open}
      title={submission?.title ?? "Submission preview"}
      subtitle={submission ? `${submission.subject} · ${submission.section}` : "Quick submission overview"}
      onClose={onClose}
      widthPreset="md"
      footer={
        submission ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button type="button" onClick={() => onView(submission.id)} className="bg-[var(--role-accent)] text-white hover:bg-[var(--role-accent-strong)]">
              View submission
            </Button>
          </div>
        ) : null
      }
    >
      {submission ? (
        <div className="space-y-6">
          <div className="rounded-[var(--radius-panel)] border border-slate-200/75 bg-white/92 p-5 shadow-[var(--shadow-soft)] dark:border-slate-700/60 dark:bg-slate-900/75">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Eyebrow>Submission record</Eyebrow>
                <SectionTitle className="mt-2">{submission.title}</SectionTitle>
                <BodyText className="mt-2" tone="muted">
                  Review the current submission state and open the full page for deeper grading or audit work.
                </BodyText>
              </div>
              <StatusChip status={submission.status} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <MetadataCard label="Student" value={submission.student} icon={<UserRound size={14} />} />
            <MetadataCard label="Teacher" value={submission.teacher} icon={<GraduationCap size={14} />} />
            <MetadataCard label="Subject" value={submission.subject} icon={<FileText size={14} />} />
            <MetadataCard label="Section" value={submission.section} icon={<FileText size={14} />} />
            <MetadataCard label="Due" value={submission.due} icon={<CalendarClock size={14} />} />
            <MetadataCard label="Submitted" value={submission.submitted} icon={<CalendarClock size={14} />} />
            <MetadataCard label="Grade" value={submission.grade !== "—" ? `${submission.grade}/100` : "—"} icon={<GraduationCap size={14} />} />
          </div>
        </div>
      ) : null}
    </DetailDrawer>
  );
}

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
      <div className="mb-2 flex items-center gap-2 text-slate-400 dark:text-slate-500">
        {icon}
        <Eyebrow className="text-[0.65rem]">{label}</Eyebrow>
      </div>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}
