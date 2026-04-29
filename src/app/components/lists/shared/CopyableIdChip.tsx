import { useState } from "react";

import { BootstrapIcon, BootstrapIconTooltip } from "../../ui/bootstrap-icon";
import { cn } from "../../ui/utils";

type CopyableIdChipProps = {
  value?: string | null;
  label?: string;
  className?: string;
  truncateAt?: number;
};

function truncateValue(value: string, truncateAt: number) {
  if (value.length <= truncateAt) {
    return value;
  }

  const head = Math.max(4, truncateAt - 6);
  return `${value.slice(0, head)}...`;
}

export function CopyableIdChip({
  value,
  label = "Copy ID",
  className,
  truncateAt = 14,
}: CopyableIdChipProps) {
  const [copied, setCopied] = useState(false);
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return <span className="text-xs text-slate-400 dark:text-slate-300">—</span>;
  }

  const displayValue = truncateValue(normalized, truncateAt);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(normalized);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-200",
        className,
      )}
    >
      <BootstrapIconTooltip label={normalized} side="top">
        <span className="font-mono">{displayValue}</span>
      </BootstrapIconTooltip>
      <BootstrapIconTooltip label={copied ? "Copied" : label} side="top">
        <button
          type="button"
          onClick={handleCopy}
          aria-label={label}
          title={label}
          className="rounded-full p-0.5 text-slate-400 transition hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:text-slate-400 dark:hover:text-blue-300"
        >
          <BootstrapIcon name={copied ? "clipboard-check-fill" : "clipboard-fill"} tone={copied ? "success" : "muted"} size={12} />
        </button>
      </BootstrapIconTooltip>
    </span>
  );
}
