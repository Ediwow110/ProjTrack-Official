import type { ComponentType, ReactNode } from "react";
import { Button } from "../ui/button";

type AuthIcon = ComponentType<{
  size?: string | number;
  className?: string;
  strokeWidth?: string | number;
}>;

export function AuthField({
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
      <label htmlFor={htmlFor} className="auth-field-label mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <div className="auth-field-control auth-role-focus flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all">
        <div className="auth-field-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
          <Icon size={16} strokeWidth={1.6} />
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {error ? (
        <p className="mt-1.5 text-sm font-medium text-red-500">{error}</p>
      ) : null}
    </div>
  );
}

export function PasswordField({
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
      <label htmlFor={htmlFor} className="auth-field-label mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <div className="auth-field-control auth-role-focus flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all">
        <div className="auth-field-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
          <Icon size={16} strokeWidth={1.6} />
        </div>
        <div className="min-w-0 flex-1">{children}</div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
      {error ? (
        <p className="mt-1.5 text-sm font-medium text-red-500">{error}</p>
      ) : null}
    </div>
  );
}

export function RememberMeRow({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="auth-remember-row flex items-center justify-between gap-4">
      {children}
    </div>
  );
}

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
      className="auth-role-button h-12 w-full rounded-xl px-5 text-base font-bold shadow-lg shadow-black/10"
    >
      {loading ? (
        "Signing in..."
      ) : (
        <span className="inline-flex items-center justify-center gap-2">
          {label}
          <span aria-hidden="true" className="text-lg leading-none">&rarr;</span>
        </span>
      )}
    </Button>
  );
}

export function AuthErrorAlert({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      aria-live="polite"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
    >
      {error}
    </div>
  );
}
