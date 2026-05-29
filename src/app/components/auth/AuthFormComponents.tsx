import type { ComponentType, ReactNode } from "react";
import { Button } from "../ui/button";

type AuthIcon = ComponentType<{
  size?: string | number;
  className?: string;
  strokeWidth?: string | number;
}>;

// AuthTextInput wraps a standard input field with label and icon.
export function AuthTextInput({
  label,
  htmlFor,
  icon: Icon,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  icon: AuthIcon;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="block">
      <label htmlFor={htmlFor} className="auth-field-label mb-2 block text-sm font-semibold text-white">
        {label}
      </label>
      <div className="auth-field-control auth-role-focus flex items-center gap-3 rounded-[var(--radius-control)] border border-white/10 bg-white/[0.06] px-4 py-4 shadow-[0_18px_46px_-38px_rgba(2,6,23,0.95)]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-slate-300">
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {error ? (
        <p className="text-sm font-medium text-amber-300 mt-2">{error}</p>
      ) : null}
    </div>
  );
}

// PasswordInput wraps a password input with eye toggle
export function PasswordInput({
  label,
  htmlFor,
  icon: Icon,
  error,
  trailing,
  children,
}: {
  label: string;
  htmlFor: string;
  icon: AuthIcon;
  error?: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="block">
      <label htmlFor={htmlFor} className="auth-field-label mb-2 block text-sm font-semibold text-white">
        {label}
      </label>
      <div className="auth-field-control auth-role-focus flex items-center gap-3 rounded-[var(--radius-control)] border border-white/10 bg-white/[0.06] px-4 py-4 shadow-[0_18px_46px_-38px_rgba(2,6,23,0.95)]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] text-slate-300">
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">{children}</div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
      {error ? (
        <p className="text-sm font-medium text-amber-300 mt-2">{error}</p>
      ) : null}
    </div>
  );
}

// RememberMeRow wraps the remember me checkbox and forgot password link
export function RememberMeRow({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      {children}
    </div>
  );
}

// AuthSubmitButton is a styled button for submitting forms
export function AuthSubmitButton({
  loading,
  label,
  disabled,
}: {
  loading: boolean;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Button
      type="submit"
      size="lg"
      disabled={disabled || loading}
      className="auth-role-button auth-submit-button h-14 w-full rounded-[var(--radius-control)] px-5 text-base font-bold animate-none"
    >
      {loading ? (
        "Signing in..."
      ) : (
        <span className="inline-flex items-center justify-center gap-2">
          {label}
          <span aria-hidden="true">→</span>
        </span>
      )}
    </Button>
  );
}

// AuthErrorAlert shows error notifications
export function AuthErrorAlert({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      aria-live="polite"
      className="rounded-[var(--radius-control)] border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300 shadow-[var(--shadow-soft)]"
    >
      {error}
    </div>
  );
}
