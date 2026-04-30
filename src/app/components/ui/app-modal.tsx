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
          "portal-modal max-h-[calc(100vh-2rem)] overflow-hidden rounded-[30px] border p-0 shadow-[var(--shadow-shell)] sm:grid-rows-[auto,minmax(0,1fr),auto]",
          sizeMap[size],
          className,
        )}
      >
        <DialogHeader className="portal-border gap-1 border-b px-6 py-5 text-left">
          <DialogTitle className="font-display text-2xl font-semibold tracking-[-0.04em] text-slate-900 dark:text-slate-100">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="text-sm leading-6 text-slate-500 dark:text-slate-400">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <div className={cn("overflow-y-auto px-6 py-6", bodyClassName)}>{children}</div>

        {footer ? (
          <DialogFooter
            className={cn(
              "portal-border portal-table-header border-t px-6 py-5",
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
