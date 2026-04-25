import {
  createElement,
  type ComponentPropsWithoutRef,
  type ComponentType,
  type ReactNode,
} from "react";

import { cn } from "./utils";

type IntrinsicTag = Extract<keyof JSX.IntrinsicElements, string>;
type PrimitiveAs = IntrinsicTag | ComponentType<any>;

type PrimitiveTextProps<T extends PrimitiveAs> = {
  as?: T;
  className?: string;
  children?: ReactNode;
};

export function Eyebrow<T extends PrimitiveAs = "p">({
  as,
  className,
  children,
  ...props
}: PrimitiveTextProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof PrimitiveTextProps<T>>) {
  const Comp = (as || "p") as PrimitiveAs;

  return createElement(
    Comp,
    {
      className: cn(
        "text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500",
        className,
      ),
      ...props,
    },
    children,
  );
}

export function DisplayTitle<T extends PrimitiveAs = "h1">({
  as,
  className,
  children,
  style,
  ...props
}: PrimitiveTextProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof PrimitiveTextProps<T>>) {
  const Comp = (as || "h1") as PrimitiveAs;

  return createElement(
    Comp,
    {
      className: cn(
        "font-display text-3xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-[2.6rem] dark:text-slate-50",
        className,
      ),
      style: { lineHeight: 1.02, ...(style || {}) },
      ...props,
    },
    children,
  );
}

export function SectionTitle<T extends PrimitiveAs = "h2">({
  as,
  className,
  children,
  ...props
}: PrimitiveTextProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof PrimitiveTextProps<T>>) {
  const Comp = (as || "h2") as PrimitiveAs;

  return createElement(
    Comp,
    {
      className: cn(
        "font-display text-lg font-semibold tracking-[-0.03em] text-slate-900 dark:text-slate-100",
        className,
      ),
      ...props,
    },
    children,
  );
}

export function BodyText<T extends PrimitiveAs = "p">({
  as,
  tone = "default",
  className,
  children,
  ...props
}: PrimitiveTextProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof PrimitiveTextProps<T>> & {
    tone?: "default" | "muted" | "soft" | "inverse";
  }) {
  const Comp = (as || "p") as PrimitiveAs;

  return createElement(
    Comp,
    {
      className: cn(
        "text-sm leading-7",
        tone === "default" && "text-slate-600 dark:text-slate-300",
        tone === "muted" && "text-slate-500 dark:text-slate-400",
        tone === "soft" && "text-slate-400 dark:text-slate-500",
        tone === "inverse" && "text-white/78",
        className,
      ),
      ...props,
    },
    children,
  );
}
