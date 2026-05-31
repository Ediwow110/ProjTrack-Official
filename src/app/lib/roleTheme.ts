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
    logoLabel: "Project Submission Management System",
    accent: "#00D2FF",
    accentStrong: "#0f172a",
    accentSoft: "rgba(0, 210, 255, 0.12)",
    accentSoftStrong: "rgba(0, 210, 255, 0.18)",
    accentBorder: "rgba(221, 221, 221, 0.28)",
    accentText: "#0f172a",
    accentTextDark: "#00D2FF",
    dotColor: "#00D2FF",
    gradient: "linear-gradient(135deg, rgba(0, 210, 255, 0.12) 0%, rgba(221, 221, 221, 0.62) 55%, rgba(15, 23, 42, 0.2) 100%)",
    buttonGradient: "linear-gradient(90deg, #346069 0%, #0f172a 100%)",
    glow: "rgba(0, 210, 255, 0.22)",
  },
  teacher: {
    label: "Teacher Portal",
    logoLabel: "Project Submission Management System",
    accent: "#00D2FF",
    accentStrong: "#0f172a",
    accentSoft: "rgba(0, 210, 255, 0.12)",
    accentSoftStrong: "rgba(0, 210, 255, 0.18)",
    accentBorder: "rgba(221, 221, 221, 0.28)",
    accentText: "#0f172a",
    accentTextDark: "#00D2FF",
    dotColor: "#00D2FF",
    gradient: "linear-gradient(135deg, rgba(0, 210, 255, 0.12) 0%, rgba(221, 221, 221, 0.62) 55%, rgba(15, 23, 42, 0.2) 100%)",
    buttonGradient: "linear-gradient(90deg, #346069 0%, #0f172a 100%)",
    glow: "rgba(0, 210, 255, 0.22)",
  },
  admin: {
    label: "Admin Portal",
    logoLabel: "Project Submission Management System",
    accent: "#00D2FF",
    accentStrong: "#0f172a",
    accentSoft: "rgba(0, 210, 255, 0.12)",
    accentSoftStrong: "rgba(0, 210, 255, 0.18)",
    accentBorder: "rgba(221, 221, 221, 0.28)",
    accentText: "#0f172a",
    accentTextDark: "#00D2FF",
    dotColor: "#00D2FF",
    gradient: "linear-gradient(135deg, rgba(0, 210, 255, 0.12) 0%, rgba(221, 221, 221, 0.62) 55%, rgba(15, 23, 42, 0.2) 100%)",
    buttonGradient: "linear-gradient(90deg, #346069 0%, #0f172a 100%)",
    glow: "rgba(0, 210, 255, 0.22)",
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
