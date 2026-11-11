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
    accent: "#2563EB",
    accentStrong: "#1D4ED8",
    accentSoft: "rgba(37, 99, 235, 0.1)",
    accentSoftStrong: "rgba(37, 99, 235, 0.16)",
    accentBorder: "rgba(59, 130, 246, 0.35)",
    accentText: "#1D4ED8",
    accentTextDark: "#93C5FD",
    dotColor: "#3B82F6",
    gradient: "linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(221, 221, 221, 0.62) 55%, rgba(30, 58, 138, 0.18) 100%)",
    buttonGradient: "linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)",
    glow: "rgba(37, 99, 235, 0.28)",
  },
  teacher: {
    label: "Teacher Portal",
    logoLabel: "Project Submission Management System",
    accent: "#7C3AED",
    accentStrong: "#6D28D9",
    accentSoft: "rgba(124, 58, 237, 0.1)",
    accentSoftStrong: "rgba(124, 58, 237, 0.16)",
    accentBorder: "rgba(139, 92, 246, 0.35)",
    accentText: "#6D28D9",
    accentTextDark: "#C4B5FD",
    dotColor: "#8B5CF6",
    gradient: "linear-gradient(135deg, rgba(124, 58, 237, 0.12) 0%, rgba(221, 221, 221, 0.62) 55%, rgba(76, 29, 149, 0.16) 100%)",
    buttonGradient: "linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)",
    glow: "rgba(124, 58, 237, 0.28)",
  },
  admin: {
    label: "Admin Portal",
    logoLabel: "Project Submission Management System",
    accent: "#0D9488",
    accentStrong: "#0F766E",
    accentSoft: "rgba(13, 148, 136, 0.1)",
    accentSoftStrong: "rgba(13, 148, 136, 0.16)",
    accentBorder: "rgba(20, 184, 166, 0.35)",
    accentText: "#0F766E",
    accentTextDark: "#5EEAD4",
    dotColor: "#14B8A6",
    gradient: "linear-gradient(135deg, rgba(13, 148, 136, 0.12) 0%, rgba(221, 221, 221, 0.62) 55%, rgba(19, 78, 74, 0.16) 100%)",
    buttonGradient: "linear-gradient(135deg, #0D9488 0%, #115E59 100%)",
    glow: "rgba(13, 148, 136, 0.28)",
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
