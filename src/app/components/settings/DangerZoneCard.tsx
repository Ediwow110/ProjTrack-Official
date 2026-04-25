import type { ReactNode } from "react";

import { PortalPanel } from "../portal/PortalPage";
import { Button } from "../ui/button";
import { BodyText, SectionTitle } from "../ui/typography";

export type DangerZoneAction = {
  key: string;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  actionIcon?: ReactNode;
};

export function DangerZoneCard({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions: DangerZoneAction[];
}) {
  return (
    <PortalPanel
      title={title}
      description={description}
      className="border-rose-200/80 dark:border-rose-500/25"
      contentClassName="space-y-4"
    >
      {actions.map((action) => (
        <div
          key={action.key}
          className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-rose-200/80 bg-rose-50/60 px-4 py-4 dark:border-rose-500/20 dark:bg-rose-500/10 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <SectionTitle className="text-base text-rose-900 dark:text-rose-100">
              {action.title}
            </SectionTitle>
            <BodyText className="mt-1 text-xs leading-6 text-rose-800/80 dark:text-rose-200/80">
              {action.description}
            </BodyText>
          </div>
          <Button
            type="button"
            variant="destructive"
            onClick={action.onAction}
            disabled={action.disabled}
          >
            {action.actionIcon}
            {action.actionLabel}
          </Button>
        </div>
      ))}
    </PortalPanel>
  );
}
