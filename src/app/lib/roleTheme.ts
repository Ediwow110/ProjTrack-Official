import type { CSSProperties } from "react";

export type PortalRole = "student" | "teacher" | "admin";

export const roleThemes: Record<PortalRole, {
  label: string;
  logoLabel: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  accentSoftStrong: string;
  accentBorder: string;
  accentText: string;
  accentTextDark: string;
  dotColor: string;
  gradient: string;
  buttonGradient: string;
  glow: string;
}> = {
  student: {
    label: "Student Portal",
    logoLabel: "Student workspace",
    accent: "#1d4ed8",
    accentStrong: "#1e3a8a",
    accentSoft: "rgba(37, 99, 235, 0.12)",
    accentSoftStrong: "rgba(37, 99, 235, 0.18)",
    accentBorder: "rgba(59, 130, 246, 0.28)",
    accentText: "#1e3a8a",
    accentTextDark: "#dbeafe",
    dotColor: "#08bdf4",
    gradient: "linear-gradient(135deg, rgba(59, 130, 246, 0.14) 0%, rgba(224, 242, 254, 0.66) 54%, rgba(8, 189, 244, 0.18) 100%)",
    buttonGradient: "linear-gradient(135deg, #2563eb 0%, #08bdf4 100%)",
    glow: "rgba(37, 99, 235, 0.34)",
  },
  teacher: {
    label: "Teacher Portal",
    logoLabel: "Teacher workspace",
    accent: "#6d28d9",
    accentStrong: "#4c1d95",
    accentSoft: "rgba(139, 92, 246, 0.12)",
    accentSoftStrong: "rgba(139, 92, 246, 0.2)",
    accentBorder: "rgba(139, 92, 246, 0.3)",
    accentText: "#6d28d9",
    accentTextDark: "#ede9fe",
    dotColor: "#a78bfa",
    gradient: "linear-gradient(135deg, rgba(139, 92, 246, 0.14) 0%, rgba(245, 243, 255, 0.68) 55%, rgba(192, 132, 252, 0.2) 100%)",
    buttonGradient: "linear-gradient(135deg, #6d28d9 0%, #4c1d95 100%)",
    glow: "rgba(139, 92, 246, 0.34)",
  },
  admin: {
    label: "Admin Portal",
    logoLabel: "Admin workspace",
    accent: "#c2410c",
    accentStrong: "#9a3412",
    accentSoft: "rgba(255, 121, 0, 0.12)",
    accentSoftStrong: "rgba(255, 121, 0, 0.2)",
    accentBorder: "rgba(255, 121, 0, 0.3)",
    accentText: "#c2410c",
    accentTextDark: "#ffedd5",
    dotColor: "#ff9d00",
    gradient: "linear-gradient(135deg, rgba(255, 121, 0, 0.14) 0%, rgba(255, 247, 237, 0.68) 55%, rgba(255, 157, 0, 0.2) 100%)",
    buttonGradient: "linear-gradient(135deg, #c2410c 0%, #9a3412 100%)",
    glow: "rgba(255, 121, 0, 0.34)",
  },
};

export function roleThemeStyle(role: PortalRole) {
  const theme = roleThemes[role];
  return {
    "--role-accent": theme.accent,
    "--role-accent-strong": theme.accentStrong,
    "--role-accent-soft": theme.accentSoft,
    "--role-accent-soft-strong": theme.accentSoftStrong,
    "--role-accent-border": theme.accentBorder,
    "--role-accent-text": theme.accentText,
    "--role-accent-text-dark": theme.accentTextDark,
    "--role-dot": theme.dotColor,
    "--role-shell-gradient": theme.gradient,
    "--role-button-gradient": theme.buttonGradient,
    "--role-logo-glow": theme.glow,
  } as CSSProperties;
}
