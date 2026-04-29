import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { cn } from "./utils";

const sizeMap = {
  md: "sm:max-w-xl",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
  wide: "sm:max-w-5xl",
} as const;

export function AppModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "lg",
  className,
  bodyClassName,
  footerClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof sizeMap;
  className?: string;
  bodyClassName?: string;
  footerClassName?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "portal-modal flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-[30px] border p-0 shadow-[var(--shadow-shell)]",
          "sm:max-h-[calc(100dvh-2rem)]",
          sizeMap[size],
          className,
        )}
      >
        <DialogHeader className="portal-border shrink-0 gap-1 border-b px-6 py-5 pr-16 text-left">
          <DialogTitle className="font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="text-sm leading-6 text-[var(--text-muted)]">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <div
          data-modal-body="true"
          tabIndex={0}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-6 py-6 outline-none focus-visible:ring-2 focus-visible:ring-[var(--role-accent)]/35",
            bodyClassName,
          )}
        >
          {children}
        </div>

        {footer ? (
          <DialogFooter
            className={cn(
              "portal-border portal-table-header sticky bottom-0 z-10 shrink-0 border-t px-6 py-5",
              "max-h-[35dvh] overflow-y-auto sm:max-h-none sm:overflow-visible",
              footerClassName,
            )}
          >
            {footer}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
