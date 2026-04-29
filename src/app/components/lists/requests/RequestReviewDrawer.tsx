import type { ReactNode } from "react";
import { Clock3, UserRound } from "lucide-react";

import { DetailDrawer } from "../shared/DetailDrawer";
import { Button } from "../../ui/button";
import { StatusChip } from "../../ui/StatusChip";
import { BodyText, Eyebrow, SectionTitle } from "../../ui/typography";
import type { AdminRequestRecord } from "../../../lib/api/contracts";

type RequestReviewDrawerProps = {
  open: boolean;
  request?: AdminRequestRecord | null;
  actionBusy?: boolean;
  onClose: () => void;
  onApprove: (request: AdminRequestRecord) => void;
  onReject: (request: AdminRequestRecord) => void;
};

export function RequestReviewDrawer({
  open,
  request,
  actionBusy = false,
  onClose,
  onApprove,
  onReject,
}: RequestReviewDrawerProps) {
  return (
    <DetailDrawer
      open={open}
      title={request?.type ?? "Request review"}
      subtitle={request ? `${request.requester} · ${request.subject}` : "Review queue context"}
      onClose={onClose}
      widthPreset="md"
      footer={
        request ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            {request.status === "Pending" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={actionBusy}
                  onClick={() => onReject(request)}
                >
                  Reject
                </Button>
                <Button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => onApprove(request)}
                  className="bg-[var(--role-accent)] text-white hover:bg-[var(--role-accent-strong)]"
                >
                  Approve
                </Button>
              </>
            ) : null}
          </div>
        ) : null
      }
    >
      {request ? (
        <div className="space-y-6">
          <div className="rounded-[var(--radius-panel)] border border-slate-200/75 bg-white/92 p-5 shadow-[var(--shadow-soft)] dark:border-slate-700/60 dark:bg-slate-900/75">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Eyebrow>Request queue item</Eyebrow>
                <SectionTitle className="mt-2">{request.type}</SectionTitle>
                <BodyText className="mt-2" tone="muted">
                  Review the request summary and take a safe queue decision without leaving the list context.
                </BodyText>
              </div>
              <StatusChip status={request.status} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <MetadataCard label="Requester" value={request.requester} icon={<UserRound size={14} />} />
            <MetadataCard label="Role" value={request.role} icon={<UserRound size={14} />} />
            <MetadataCard label="Subject" value={request.subject} icon={<Clock3 size={14} />} />
            <MetadataCard label="Date" value={request.date} icon={<Clock3 size={14} />} />
          </div>

          <div className="rounded-[var(--radius-panel)] border border-slate-200/75 bg-white/92 p-5 shadow-[var(--shadow-soft)] dark:border-slate-700/60 dark:bg-slate-900/75">
            <Eyebrow>Details</Eyebrow>
            <BodyText className="mt-3 text-sm leading-6" tone="default">
              {request.details}
            </BodyText>
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
      <div className="mb-2 flex items-center gap-2 text-slate-400 dark:text-slate-300 dark:text-slate-500">
        {icon}
        <Eyebrow className="text-[0.65rem]">{label}</Eyebrow>
      </div>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}
