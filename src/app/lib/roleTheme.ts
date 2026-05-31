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
    accent: "#4DD4AC",
    accentStrong: "#346069",
    accentSoft: "rgba(77, 212, 172, 0.14)",
    accentSoftStrong: "rgba(77, 212, 172, 0.18)",
    accentBorder: "rgba(77, 212, 172, 0.32)",
    accentText: "#346069",
    accentTextDark: "#BFF3E3",
    dotColor: "#4DD4AC",
    gradient: "linear-gradient(135deg, rgba(77, 212, 172, 0.12) 0%, rgba(221, 221, 221, 0.62) 55%, rgba(52, 96, 105, 0.2) 100%)",
    buttonGradient: "linear-gradient(135deg, #4DD4AC 0%, #346069 100%)",
    glow: "rgba(77, 212, 172, 0.34)",
  },
  teacher: {
    label: "Teacher Portal",
    logoLabel: "Teacher workspace",
    accent: "#4DD4AC",
    accentStrong: "#346069",
    accentSoft: "rgba(77, 212, 172, 0.14)",
    accentSoftStrong: "rgba(77, 212, 172, 0.18)",
    accentBorder: "rgba(77, 212, 172, 0.32)",
    accentText: "#346069",
    accentTextDark: "#BFF3E3",
    dotColor: "#4DD4AC",
    gradient: "linear-gradient(135deg, rgba(77, 212, 172, 0.12) 0%, rgba(221, 221, 221, 0.62) 55%, rgba(52, 96, 105, 0.2) 100%)",
    buttonGradient: "linear-gradient(135deg, #4DD4AC 0%, #346069 100%)",
    glow: "rgba(77, 212, 172, 0.34)",
  },
  admin: {
    label: "Admin Portal",
    logoLabel: "Admin workspace",
    accent: "#4DD4AC",
    accentStrong: "#346069",
    accentSoft: "rgba(77, 212, 172, 0.14)",
    accentSoftStrong: "rgba(77, 212, 172, 0.18)",
    accentBorder: "rgba(77, 212, 172, 0.32)",
    accentText: "#346069",
    accentTextDark: "#BFF3E3",
    dotColor: "#4DD4AC",
    gradient: "linear-gradient(135deg, rgba(77, 212, 172, 0.12) 0%, rgba(221, 221, 221, 0.62) 55%, rgba(52, 96, 105, 0.2) 100%)",
    buttonGradient: "linear-gradient(135deg, #4DD4AC 0%, #346069 100%)",
    glow: "rgba(77, 212, 172, 0.34)",
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
