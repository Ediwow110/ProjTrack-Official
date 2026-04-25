import {
  createElement,
  type ComponentPropsWithoutRef,
  type ComponentType,
  type ReactNode,
} from "react";

import { cn } from "../ui/utils";

type WidthVariant = "narrow" | "default" | "wide" | "full";
type GapVariant = "sm" | "md" | "lg" | "xl";
type IntrinsicTag = Extract<keyof JSX.IntrinsicElements, string>;
type PrimitiveAs = IntrinsicTag | ComponentType<any>;

const widthClasses: Record<WidthVariant, string> = {
  narrow: "max-w-[var(--content-width-narrow)]",
  default: "max-w-[var(--content-width)]",
  wide: "max-w-[var(--content-width-wide)]",
  full: "max-w-none",
};

const gapClasses: Record<GapVariant, string> = {
  sm: "gap-[var(--section-gap-sm)]",
  md: "gap-[var(--section-gap-md)]",
  lg: "gap-[var(--section-gap-lg)]",
  xl: "gap-[var(--section-gap-xl)]",
};

type PrimitiveProps<T extends PrimitiveAs> = {
  as?: T;
  className?: string;
  children?: ReactNode;
};

export function PageContainer<T extends PrimitiveAs = "div">({
  as,
  width = "default",
  padded = true,
  className,
  children,
  ...props
}: PrimitiveProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof PrimitiveProps<T>> & {
    width?: WidthVariant;
    padded?: boolean;
  }) {
  const Comp = (as || "div") as PrimitiveAs;

  return createElement(
    Comp,
    {
      className: cn(
        "mx-auto w-full",
        widthClasses[width],
        padded && "px-[var(--page-pad-inline)] py-[var(--page-pad-block)]",
        className,
      ),
      ...props,
    },
    children,
  );
}

export function Stack<T extends PrimitiveAs = "div">({
  as,
  gap = "lg",
  className,
  children,
  ...props
}: PrimitiveProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof PrimitiveProps<T>> & {
    gap?: GapVariant;
  }) {
  const Comp = (as || "div") as PrimitiveAs;

  return createElement(
    Comp,
    { className: cn("flex flex-col", gapClasses[gap], className), ...props },
    children,
  );
}

export function Inline<T extends PrimitiveAs = "div">({
  as,
  gap = "sm",
  wrap = true,
  align = "center",
  justify = "start",
  className,
  children,
  ...props
}: PrimitiveProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof PrimitiveProps<T>> & {
    gap?: GapVariant;
    wrap?: boolean;
    align?: "start" | "center" | "end" | "stretch";
    justify?: "start" | "center" | "between" | "end";
  }) {
  const Comp = (as || "div") as PrimitiveAs;

  return createElement(
    Comp,
    {
      className: cn(
        "flex",
        gapClasses[gap],
        wrap && "flex-wrap",
        align === "start" && "items-start",
        align === "center" && "items-center",
        align === "end" && "items-end",
        align === "stretch" && "items-stretch",
        justify === "start" && "justify-start",
        justify === "center" && "justify-center",
        justify === "between" && "justify-between",
        justify === "end" && "justify-end",
        className,
      ),
      ...props,
    },
    children,
  );
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-[var(--space-sm)] sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {title}
        {description ? <div className="mt-[var(--space-2xs)]">{description}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
