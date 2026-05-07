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
          "portal-modal flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-[24px] border p-0 shadow-[var(--shadow-shell)] sm:rounded-[30px]",
          "sm:max-h-[calc(100dvh-2rem)]",
          sizeMap[size],
          className,
        )}
      >
        <DialogHeader className="portal-border shrink-0 gap-1 border-b px-4 py-4 pr-14 text-left sm:px-6 sm:py-5 sm:pr-16">
          <DialogTitle className="font-display text-xl font-semibold tracking-[-0.04em] text-[var(--text-strong)] sm:text-2xl">
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
            "min-h-0 flex-1 overflow-y-auto px-4 py-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--role-accent)]/35 sm:px-6 sm:py-6",
            bodyClassName,
          )}
        >
          {children}
        </div>

        {footer ? (
          <DialogFooter
            className={cn(
              "portal-border portal-table-header sticky bottom-0 z-10 shrink-0 flex-wrap border-t px-4 py-4 sm:px-6 sm:py-5",
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
