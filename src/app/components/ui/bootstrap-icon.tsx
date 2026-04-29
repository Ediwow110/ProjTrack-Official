import { type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { cn } from "./utils";

const paths = {
  "archive-fill": "M12.643 15C13.979 15 15 13.845 15 12.5V5H1v7.5C1 13.845 2.021 15 3.357 15zM5.5 7h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1M.8 1a.8.8 0 0 0-.8.8V3a.8.8 0 0 0 .8.8h14.4A.8.8 0 0 0 16 3V1.8a.8.8 0 0 0-.8-.8z",
  "arrow-clockwise": "M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2zM8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466",
  "arrow-counterclockwise": "M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2zM8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466",
  "check-circle-fill": "M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.061L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z",
  "clipboard-check-fill": "M10 .5a.5.5 0 0 0-.5-.5h-3A.5.5 0 0 0 6 .5v1a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5zM4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1A1.5 1.5 0 0 1 10.5 4h-5A1.5 1.5 0 0 1 4 2.5zm6.854 6.354-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 9.793l2.646-2.647a.5.5 0 0 1 .708.708",
  "clipboard-fill": "M10 1.5v1A1.5 1.5 0 0 1 8.5 4h-5A1.5 1.5 0 0 1 2 2.5v-1A1.5 1.5 0 0 1 3.5 0h5A1.5 1.5 0 0 1 10 1.5M3.5 1a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zM1 3.5A1.5 1.5 0 0 1 2.5 2H3v1h-.5a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .5.5h10a.5.5 0 0 0 .5-.5v-10a.5.5 0 0 0-.5-.5H12V2h.5A1.5 1.5 0 0 1 14 3.5v10A1.5 1.5 0 0 1 12.5 15h-10A1.5 1.5 0 0 1 1 13.5z",
  "envelope-fill": "M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414zM0 4.697v7.104l5.803-3.558zM6.761 8.83 0 12.974A2 2 0 0 0 2 14h12a2 2 0 0 0 2-1.026L9.239 8.83 8 9.586zm3.436-.586L16 11.801V4.697z",
  "envelope-check-fill": "M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414zM0 4.697v7.104l5.803-3.558zM6.761 8.83 0 12.974A2 2 0 0 0 2 14h6.256A4.5 4.5 0 0 1 8 12.5a4.49 4.49 0 0 1 1.606-3.446L8 10.086zm3.399-.636L16 4.697v4.974A4.5 4.5 0 0 0 10.16 8.194m5.146 3.116a.5.5 0 0 0-.708-.708L12.5 12.793l-.896-.897a.5.5 0 0 0-.708.708l1.25 1.25a.5.5 0 0 0 .708 0z",
  "envelope-exclamation-fill": "M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414zM0 4.697v7.104l5.803-3.558zM6.761 8.83 0 12.974A2 2 0 0 0 2 14h6.256A4.5 4.5 0 0 1 8 12.5a4.49 4.49 0 0 1 1.606-3.446L8 10.086zm3.399-.636L16 4.697v4.974A4.5 4.5 0 0 0 10.16 8.194M12.5 10a.5.5 0 0 1 .5.5v1.8a.5.5 0 0 1-1 0v-1.8a.5.5 0 0 1 .5-.5m0 4a.6.6 0 1 1 0-1.2.6.6 0 0 1 0 1.2",
  "exclamation-triangle-fill": "M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2",
  "eye-fill": "M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8m8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7",
  "eye-slash-fill": "M10.79 12.912 9.176 11.3a3.5 3.5 0 0 1-4.474-4.474L2.388 4.513C.98 5.45 0 6.85 0 8c0 0 3 5.5 8 5.5a7 7 0 0 0 2.79-.588M5.21 3.088A7 7 0 0 1 8 2.5C13 2.5 16 8 16 8a13 13 0 0 1-2.388 3.487l-2.314-2.313A3.5 3.5 0 0 0 6.826 4.7zM5.525 7.646a2.5 2.5 0 0 0 2.829 2.829zm4.95.708-2.829-2.83a2.5 2.5 0 0 1 2.829 2.829zm3.646 6.061L1.586 1.88l.707-.707 12.536 12.535z",
  "hourglass-split": "M2.5 15a.5.5 0 1 1 0-1h1v-1a4.5 4.5 0 0 1 2.557-4.06c.29-.139.29-.741 0-.88A4.5 4.5 0 0 1 3.5 4V3h-1a.5.5 0 0 1 0-1h11a.5.5 0 0 1 0 1h-1v1a4.5 4.5 0 0 1-2.557 4.06c-.29.139-.29.741 0 .88A4.5 4.5 0 0 1 12.5 13v1h1a.5.5 0 0 1 0 1zm2-12v1c0 .537.12 1.045.337 1.5h6.326A3.5 3.5 0 0 0 11.5 4V3zm3 6.799c-.64.31-1.254.71-1.744 1.195-.27.268-.509.575-.703.924h5.894a3.4 3.4 0 0 0-.703-.924C9.754 10.51 9.14 10.11 8.5 9.8a1.5 1.5 0 0 0-1 0z",
  "info-circle-fill": "M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2",
  "pause-circle-fill": "M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M6.25 5C5.56 5 5 5.56 5 6.25v3.5a1.25 1.25 0 1 0 2.5 0v-3.5C7.5 5.56 6.94 5 6.25 5m3.5 0c-.69 0-1.25.56-1.25 1.25v3.5a1.25 1.25 0 1 0 2.5 0v-3.5C11 5.56 10.44 5 9.75 5",
  "send-fill": "M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855a.5.5 0 0 0-.055.917l4.312 2.156 2.156 4.312a.5.5 0 0 0 .917-.055zM6.076 8.65 2.05 6.637 13.54 2.04zM7.35 9.924l6.61-6.61-4.597 11.49z",
  "shield-check": "M5.338 1.59 8 0l2.662 1.59c.902.539 1.839.89 2.838 1.05.316.05.5.327.5.643v3.745c0 3.772-2.505 6.679-5.31 7.787a1.5 1.5 0 0 1-1.38 0C4.505 13.707 2 10.8 2 7.028V3.283c0-.316.184-.593.5-.643.999-.16 1.936-.511 2.838-1.05M10.854 6.146a.5.5 0 0 0-.708 0L7.5 8.793 6.354 7.646a.5.5 0 1 0-.708.708l1.5 1.5a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0 0-.708",
  "shield-exclamation": "M5.338 1.59 8 0l2.662 1.59c.902.539 1.839.89 2.838 1.05.316.05.5.327.5.643v3.745c0 3.772-2.505 6.679-5.31 7.787a1.5 1.5 0 0 1-1.38 0C4.505 13.707 2 10.8 2 7.028V3.283c0-.316.184-.593.5-.643.999-.16 1.936-.511 2.838-1.05M7.001 4.5a1 1 0 1 1 2 0l-.35 4.2a.65.65 0 0 1-1.3 0zm1 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2",
  "x-circle-fill": "M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293z",
  "arrow-down-up": "M11.5 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L11 2.707V14.5a.5.5 0 0 0 .5.5m-7-14a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L4 13.293V1.5a.5.5 0 0 1 .5-.5",
  "box-arrow-up-right": "M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10A1.5 1.5 0 0 0 13 14.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0z",
  "chevron-down": "M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708",
  "chevron-up": "M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708z",
  "pencil-square": "M15.502 1.94a.5.5 0 0 1 0 .706l-1 1-2.147-2.146 1-1a.5.5 0 0 1 .707 0l1.44 1.44zM13.795 4.354 11.646 2.207 4.939 8.914a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12zM1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5z",
  "trash-fill": "M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1zm3 4.5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 1 0",
} as const;

const toneClass = {
  success: "text-emerald-600 dark:text-emerald-300",
  danger: "text-rose-600 dark:text-rose-300",
  warning: "text-amber-600 dark:text-amber-300",
  info: "text-sky-600 dark:text-sky-300",
  primary: "text-blue-600 dark:text-blue-300",
  secondary: "text-slate-500 dark:text-slate-300",
  muted: "text-slate-400 dark:text-slate-400",
} as const;

export type BootstrapIconName = keyof typeof paths;
export type BootstrapIconTone = keyof typeof toneClass;

export function BootstrapIcon({
  name,
  tone = "secondary",
  size = 16,
  className = "",
  title,
  style,
}: {
  name: BootstrapIconName;
  tone?: BootstrapIconTone;
  size?: number;
  className?: string;
  title?: string;
  style?: CSSProperties;
}) {
  const labelled = Boolean(title);
  return (
    <svg
      aria-hidden={labelled ? undefined : true}
      aria-label={title}
      role={labelled ? "img" : undefined}
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="currentColor"
      className={cn(toneClass[tone], "shrink-0", className)}
      style={style}
    >
      {title ? <title>{title}</title> : null}
      <path d={paths[name]} />
    </svg>
  );
}

export function BootstrapIconTooltip({
  label,
  children,
  side = "top",
}: {
  label: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help align-middle">{children}</span>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={8}
        className="max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium leading-relaxed text-slate-700 shadow-xl dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function BootstrapIconButton({
  icon,
  label,
  tone = "secondary",
  size = "sm",
  children,
  className,
  tooltip,
  ...buttonProps
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: BootstrapIconName;
  label: string;
  tone?: BootstrapIconTone;
  size?: "xs" | "sm" | "md";
  tooltip?: ReactNode;
}) {
  const sizing =
    size === "xs"
      ? "rounded-lg px-2.5 py-1.5 text-xs"
      : size === "md"
        ? "rounded-xl px-4 py-2.5 text-sm"
        : "rounded-lg px-3 py-1.5 text-xs";
  const disabled = Boolean(buttonProps.disabled);
  const button = (
    <span className="inline-flex" tabIndex={disabled ? 0 : undefined}>
      <button
        {...buttonProps}
        aria-label={buttonProps["aria-label"] ?? label}
        title={label}
        className={cn(
          "portal-input inline-flex items-center gap-1.5 border font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-55 dark:text-slate-100 dark:hover:bg-slate-800/85",
          sizing,
          className,
        )}
      >
        <BootstrapIcon name={icon} tone={tone} size={size === "md" ? 14 : 12} />
        {children ? <span>{children}</span> : null}
      </button>
    </span>
  );

  return <BootstrapIconTooltip label={tooltip ?? label}>{button}</BootstrapIconTooltip>;
}
