import type { ReactNode } from "react";

import { Stack } from "../layout/primitives";
import { PortalPanel } from "../portal/PortalPage";
import { cn } from "../ui/utils";

export function SettingsSection({
  title,
  description,
  children,
  className,
  contentClassName,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <PortalPanel
      title={title}
      description={description}
      className={className}
      contentClassName={cn("space-y-4", contentClassName)}
    >
      <Stack gap="md">{children}</Stack>
    </PortalPanel>
  );
}
