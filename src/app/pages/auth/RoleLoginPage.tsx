import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BookOpen, Eye, EyeOff, GraduationCap, Hash, Lock, Mail, ShieldCheck } from "lucide-react";

import { AuthField, AuthLayout } from "../../components/auth/AuthLayout";
import { Button } from "../../components/ui/button";
import { BodyText } from "../../components/ui/typography";
import { getAuthSession, type AppRole } from "../../lib/mockAuth";
import { authService } from "../../lib/api/services";
import { fadeUpVariants } from "../../lib/motion";

const cfgMap: Record<AppRole, {
  title: string;
  subtitle: string;
  icon: typeof GraduationCap;
  badge: string;
  fieldLabel: string;
  fieldPlaceholder: string;
  hint: string;
  stats: Array<{ value: string; label: string }>;
}> = {
  student: {
    title: "Student Portal Login",
    subtitle: "Access your subjects, calendar, submissions, and group work.",
    icon: GraduationCap,
    badge: "Student Access",
    fieldLabel: "Student ID or Email",
    fieldPlaceholder: "STU-2024-00142 or student@school.edu.ph",
    hint: "Use your student number or school email to sign in.",
    stats: [
      { value: "Real-time", label: "Submission Tracking" },
      { value: "Easy", label: "Class Management" },
      { value: "Instant", label: "Alerts & Reminders" },
      { value: "Secure", label: "Reliable Platform" },
    ],
  },
  teacher: {
    title: "Teacher Portal Login",
    subtitle: "Review records, manage subject rules, and monitor submissions.",
    icon: BookOpen,
    badge: "Teacher Access",
    fieldLabel: "Employee ID or School Email",
    fieldPlaceholder: "EMP-001 or teacher@school.edu.ph",
    hint: "Use your employee ID or school email to sign in.",
    stats: [
      { value: "Review", label: "Submissions" },
      { value: "Manage", label: "Classes" },
      { value: "Guide", label: "Student Progress" },
      { value: "Notify", label: "Academic Alerts" },
    ],
  },
  admin: {
    title: "Admin Portal Login",
    subtitle: "Manage users, reports, announcements, and system operations.",
    icon: ShieldCheck,
    badge: "Admin Access",
    fieldLabel: "Admin Email",
    fieldPlaceholder: "admin@school.edu.ph",
    hint: "Admin access is limited to authorized staff.",
    stats: [
      { value: "Manage", label: "User Access" },
      { value: "Reports", label: "Analytics" },
      { value: "System", label: "Control" },
      { value: "Secure", label: "Operations" },
    ],
  },
};

export default function RoleLoginPage({ role }: { role: AppRole }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cfg = cfgMap[role];
  const Icon = cfg.icon;
  const identifierInputId = `${role}-identifier`;
  const passwordInputId = `${role}-password`;
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const reducedMotion = useReducedMotion() ?? false;

  const FieldIcon = role === "student" ? Hash : Mail;
  const requestedTarget = typeof location.state === "object" && location.state && "from" in location.state
    ? String((location.state as { from?: string }).from || "")
    : "";

  useEffect(() => {
    const session = getAuthSession();
    if (session?.role) {
      navigate(`/${session.role}/dashboard`, { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await authService.signIn({ role, identifier, password });
      navigate(requestedTarget || response.redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      role={role}
      title={cfg.title}
      subtitle={cfg.subtitle}
      hint={cfg.hint}
      icon={Icon}
      badge={cfg.badge}
      metrics={cfg.stats}
      footer={(
        <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
          <span>
            {requestedTarget
              ? "You will return to the page you originally requested after sign-in."
              : "Authorized access only."}
          </span>
          <span className="auth-role-link font-semibold">Protected role-based access</span>
        </div>
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField label={cfg.fieldLabel} htmlFor={identifierInputId} icon={FieldIcon}>
          <input
            id={identifierInputId}
            name="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={cfg.fieldPlaceholder}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            spellCheck={false}
            required
            className="auth-input w-full border-0 bg-transparent p-0 text-sm text-white outline-none placeholder:text-slate-500"
          />
        </AuthField>

        <AuthField
          label="Password"
          htmlFor={passwordInputId}
          icon={Lock}
          trailing={(
            <button
              type="button"
              onClick={() => setShowPass((value) => !value)}
              className="rounded-full p-1 text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--role-dot)]"
              aria-label={showPass ? "Hide password" : "Show password"}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        >
          <input
            id={passwordInputId}
            name="password"
            type={showPass ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
            required
            className="auth-input w-full border-0 bg-transparent p-0 text-sm text-white outline-none placeholder:text-slate-500"
          />
        </AuthField>

        <div className="flex items-center justify-between gap-4 text-sm">
          <BodyText tone="muted" className="auth-support-text">
            Secure sign-in for your account.
          </BodyText>
          <Link
            to={`/auth/forgot-password?role=${encodeURIComponent(role)}`}
            className="auth-role-link text-sm font-semibold underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <AnimatePresence>
          {error ? (
            <motion.div
              role="alert"
              aria-live="polite"
              variants={fadeUpVariants(reducedMotion, { distance: 8 })}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="rounded-[var(--radius-control)] border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300 shadow-[var(--shadow-soft)]"
            >
              {error}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="auth-role-button h-[4.25rem] w-full rounded-[var(--radius-control)] px-5 text-base font-bold"
        >
          {loading ? "Signing in..." : `Sign In as ${role[0].toUpperCase()}${role.slice(1)}`}
        </Button>
      </form>
    </AuthLayout>
  );
}
