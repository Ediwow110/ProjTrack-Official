"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "../../ui/drawer";
import { Button } from "../../ui/button";
import { cn } from "../../ui/utils";

export type DetailDrawerProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  widthPreset?: "md" | "lg";
};

const widthMap: Record<NonNullable<DetailDrawerProps["widthPreset"]>, string> = {
  md: "data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:max-w-xl",
  lg: "data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:max-w-2xl",
};

export function DetailDrawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  widthPreset = "md",
}: DetailDrawerProps) {
  return (
    <Drawer
      direction="right"
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DrawerContent
        className={cn(
          "data-[vaul-drawer-direction=right]:rounded-none data-[vaul-drawer-direction=right]:border-slate-200 data-[vaul-drawer-direction=right]:bg-[var(--surface-panel)] data-[vaul-drawer-direction=right]:p-0 data-[vaul-drawer-direction=right]:shadow-2xl dark:data-[vaul-drawer-direction=right]:border-slate-700/70 dark:data-[vaul-drawer-direction=right]:bg-slate-950/98",
          widthMap[widthPreset],
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 dark:border-slate-800">
            <div className="min-w-0">
              <DrawerTitle className="font-display text-xl tracking-[-0.03em] text-slate-950 dark:text-slate-50">
                {title}
              </DrawerTitle>
              {subtitle ? (
                <DrawerDescription className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {subtitle}
                </DrawerDescription>
              ) : null}
            </div>
            <DrawerClose asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Close details">
                <X size={16} />
              </Button>
            </DrawerClose>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer ? (
            <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
              {footer}
            </div>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
