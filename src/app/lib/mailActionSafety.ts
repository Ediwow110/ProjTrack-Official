export type MailJobConfirmation = {
  mailJobId?: string | null;
  jobId?: string | null;
  queued?: boolean;
  status?: string | null;
  provider?: string | null;
  fromEmail?: string | null;
};

export type ClassroomNotificationResult = {
  success?: boolean;
  notified?: number;
  inAppNotificationsCreated?: number;
  emailJobsQueued?: number;
  emailQueueWarnings?: string[];
};

export function getConfirmedMailJobId(result: MailJobConfirmation | null | undefined) {
  const id = String(result?.mailJobId ?? result?.jobId ?? "").trim();
  return id || null;
}

export function assertConfirmedMailJob(
  result: MailJobConfirmation | null | undefined,
  actionLabel = "email action",
) {
  const id = getConfirmedMailJobId(result);
  if (!id) {
    throw new Error(
      `The backend did not confirm a queued MailJob for this ${actionLabel}. No success message was shown.`,
    );
  }
  return id;
}

export function formatMailJobQueuedMessage(label: string, recipientName: string, result: MailJobConfirmation) {
  const id = assertConfirmedMailJob(result, label.toLowerCase());
  return `${label} MailJob queued for ${recipientName} (${id}). Open Mail Jobs to watch delivery.`;
}

export function summarizeClassroomNotification(result: ClassroomNotificationResult | null | undefined) {
  const inApp = Number(result?.inAppNotificationsCreated ?? result?.notified ?? 0);
  const emailJobs = Number(result?.emailJobsQueued ?? 0);
  const warnings = Array.isArray(result?.emailQueueWarnings)
    ? result.emailQueueWarnings.filter(Boolean)
    : [];

  const parts = [`In-app notifications created: ${inApp}`];
  parts.push(`Email jobs queued: ${emailJobs}`);
  if (warnings.length > 0) {
    parts.push(`Email warning: ${warnings.join("; ")}`);
  }
  return parts.join(". ");
}
