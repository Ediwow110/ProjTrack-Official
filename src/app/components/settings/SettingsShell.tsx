import type { ReactNode } from "react";

import { PortalPage } from "../portal/PortalPage";
import { Stack } from "../layout/primitives";
import { BodyText, DisplayTitle, Eyebrow } from "../ui/typography";
import { cn } from "../ui/utils";

export function SettingsShell({
  eyebrow = "Admin settings",
  title,
  description,
  meta,
  actions,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  meta?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <PortalPage className={cn("pb-28", className)}>
      <Stack gap="lg">
        <section className="overflow-hidden rounded-[var(--radius-panel)] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(241,245,249,0.92)_100%)] px-6 py-6 shadow-[var(--shadow-panel)] dark:border-slate-700/60 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(30,41,59,0.9)_100%)] sm:px-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <Eyebrow>{eyebrow}</Eyebrow>
              <DisplayTitle className="mt-3 text-slate-950 dark:text-slate-50 sm:text-[2.3rem]">
                {title}
              </DisplayTitle>
              <BodyText className="mt-3 max-w-2xl" tone="muted">
                {description}
              </BodyText>
              {meta ? (
                <BodyText className="mt-2 text-xs" tone="soft">
                  {meta}
                </BodyText>
              ) : null}
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
          </div>
        </section>

        {children}
      </Stack>
    </PortalPage>
  );
}
