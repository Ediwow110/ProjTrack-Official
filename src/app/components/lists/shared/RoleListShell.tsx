import type { ComponentType, ReactNode } from "react";

import { PortalHero, PortalPage, PortalPanel } from "../../portal/PortalPage";
import { cn } from "../../ui/utils";

type ListShellIcon = ComponentType<{
  size?: string | number;
  className?: string;
  strokeWidth?: string | number;
}>;

export type RoleListShellTone = "blue" | "teal" | "slate";

export type RoleListShellProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  tone?: RoleListShellTone;
  icon?: ListShellIcon;
  meta?: Array<{ label: string; value?: string }>;
  stats?: Array<{ label: string; value: string; hint?: string }>;
  actions?: ReactNode;
  summary?: ReactNode;
  toolbar?: ReactNode;
  activeFilters?: ReactNode;
  notices?: ReactNode;
  bulkActions?: ReactNode;
  children: ReactNode;
  drawer?: ReactNode;
  className?: string;
};

export function RoleListShell({
  title,
  subtitle,
  eyebrow,
  tone = "slate",
  icon,
  meta,
  stats,
  actions,
  summary,
  toolbar,
  activeFilters,
  notices,
  bulkActions,
  children,
  drawer,
  className,
}: RoleListShellProps) {
  return (
    <>
      <PortalPage className={cn("space-y-6", className)}>
        <PortalHero
          tone={tone}
          eyebrow={eyebrow}
          title={title}
          description={subtitle}
          icon={icon}
          meta={meta}
          stats={stats}
          actions={actions}
        />
        {summary}
        {toolbar || activeFilters ? (
          <PortalPanel contentClassName="space-y-4">
            {toolbar}
            {activeFilters}
          </PortalPanel>
        ) : null}
        {notices}
        {bulkActions}
        {children}
      </PortalPage>
      {drawer}
    </>
  );
}
