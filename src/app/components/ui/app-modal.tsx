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
          "max-h-[calc(100vh-2rem)] overflow-hidden rounded-[30px] border border-white/70 bg-[var(--surface-panel-strong)] p-0 shadow-[var(--shadow-shell)] backdrop-blur-xl sm:grid-rows-[auto,minmax(0,1fr),auto] dark:border-slate-700/60",
          sizeMap[size],
          className,
        )}
      >
        <DialogHeader className="gap-1 border-b border-slate-200/70 px-6 py-5 text-left dark:border-slate-700/60">
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
              "border-t border-slate-200/70 bg-slate-50/90 px-6 py-5 dark:border-slate-700/60 dark:bg-slate-900/70",
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
