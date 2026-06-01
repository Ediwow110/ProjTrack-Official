import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  Bell,
  BarChart3,
  Clock,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Mail,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  AuthLayout,
  type AuthFeature,
} from "../../components/auth/AuthLayout";
import {
  AuthField,
  PasswordField,
  RememberMeRow,
  AuthSubmitButton,
  AuthErrorAlert,
} from "../../components/auth/AuthFormComponents";
import { getAuthSession, getRememberMePreference, setRememberMePreference, type AppRole } from "../../lib/mockAuth";
import { ApiError } from "../../lib/api/http";
import { authService } from "../../lib/api/services";

type RoleConfig = {
  portalEyebrow: string;
  cardKicker: string;
  headlines: string[];
  description: string;
  icon: typeof GraduationCap;
  fieldLabel: string;
  fieldPlaceholder: string;
  submitLabel: string;
  features: AuthFeature[];
  securityBadge?: string;
};

const studentFeatures: AuthFeature[] = [
  { icon: Clock, label: "Submission", sub: "Tracking" },
  { icon: Users, label: "Class & Project", sub: "Management" },
  { icon: Bell, label: "Deadline", sub: "Reminders" },
  { icon: ShieldCheck, label: "Secure Student", sub: "Portal Access" },
];

const teacherFeatures: AuthFeature[] = [
  { icon: Clock, label: "Review", sub: "Submissions" },
  { icon: Users, label: "Classroom", sub: "Management" },
  { icon: BarChart3, label: "Progress", sub: "Monitoring" },
  { icon: ShieldCheck, label: "Feedback &", sub: "Oversight" },
];

const adminFeatures: AuthFeature[] = [
  { icon: User, label: "User", sub: "Administration" },
  { icon: BarChart3, label: "Reporting", sub: "& Insights" },
  { icon: ShieldCheck, label: "System", sub: "Governance" },
  { icon: Lock, label: "Privileged", sub: "Secure Access" },
];

const cfgMap: Record<AppRole, RoleConfig> = {
  student: {
    portalEyebrow: "STUDENT PORTAL",
    cardKicker: "STUDENT PORTAL LOGIN",
    headlines: ["Manage. Submit.", "Stay Ready.", "Stay On", "Track."],
    description:
      "Access your academic workspace to manage submissions, monitor class projects, and stay ahead of upcoming deadlines with confidence.",
    icon: GraduationCap,
    fieldLabel: "Email or Student ID",
    fieldPlaceholder: "Enter your email or student ID",
    submitLabel: "Sign In",
    features: studentFeatures,
    securityBadge: "Protected student access for assignments, records, and secure project activity.",
  },
  teacher: {
    portalEyebrow: "TEACHER PORTAL",
    cardKicker: "TEACHER PORTAL LOGIN",
    headlines: ["Manage. Review.", "Guide Learning with Clarity."],
    description:
      "Sign in to review coursework, manage classes, monitor learner progress, and deliver timely feedback from one organized portal.",
    icon: GraduationCap,
    fieldLabel: "Email or Teacher ID",
    fieldPlaceholder: "Enter your email or teacher ID",
    submitLabel: "Sign In as Teacher",
    features: teacherFeatures,
    securityBadge: "Faculty tools are secured for assessment workflows, class oversight, and student feedback.",
  },
  admin: {
    portalEyebrow: "ADMIN PORTAL",
    cardKicker: "ADMIN PORTAL LOGIN",
    headlines: ["Manage. Monitor.", "Control Operations.", "Securely."],
    description:
      "Enter the institutional control center for user administration, reporting, platform oversight, and protected operational access.",
    icon: ShieldCheck,
    fieldLabel: "Email or Admin ID",
    fieldPlaceholder: "Enter your email or admin ID",
    submitLabel: "Sign In as Admin",
    features: adminFeatures,
    securityBadge: "Administrative access is protected with elevated security controls and audit-aware sign-in.",
  },
};

export default function RoleLoginPage({ role }: { role: AppRole }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cfg = cfgMap[role];
  const Icon = cfg.icon;
  const identifierInputId = `${role}-identifier`;
  const passwordInputId = `${role}-password`;
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryAfter, setRetryAfter] = useState(0);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{
    identifier: string;
    password: string;
    remember: boolean;
  }>({
    defaultValues: {
      identifier: "",
      password: "",
      remember: getRememberMePreference(),
    },
  });

  const requestedTarget = typeof location.state === "object" && location.state && "from" in location.state
    ? String((location.state as { from?: string }).from || "")
    : "";

  useEffect(() => {
    const session = getAuthSession();
    if (session?.role) {
      navigate(`/${session.role}/dashboard`, { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = window.setInterval(() => {
      setRetryAfter((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAfter]);

  const formatRateLimitMessage = (seconds: number) => {
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    return `Too many login attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
  };

  const onSubmit = async (values: { identifier: string; password: string; remember: boolean }) => {
    setError("");
    setLoading(true);
    setRetryAfter(0);
    try {
      setRememberMePreference(values.remember);
      const response = await authService.login({
        role,
        emailOrId: values.identifier.trim(),
        identifier: values.identifier.trim(),
        password: values.password,
        remember: values.remember,
      });
      toast.success("Signed in successfully.");
      navigate(requestedTarget || response.redirectTo, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in.";
      const isRateLimited =
        (err instanceof ApiError && err.status === 429) ||
        /too many|rate limit|attempts/i.test(message);
      const nextRetryAfter = err instanceof ApiError && err.retryAfter ? err.retryAfter : 0;
      const userMessage = isRateLimited
        ? formatRateLimitMessage(nextRetryAfter || 60)
        : /service is temporarily unavailable|unable to reach the backend/i.test(message)
          ? "ProjTrack could not reach the sign-in service. Check your connection and try again."
          : message;

      if (nextRetryAfter > 0) setRetryAfter(nextRetryAfter);
      setError(userMessage);
      reset({ identifier: values.identifier, password: "", remember: values.remember });
      toast.error(userMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      role={role}
      portalEyebrow={cfg.portalEyebrow}
      cardKicker={cfg.cardKicker}
      headlines={cfg.headlines}
      description={cfg.description}
      icon={Icon}
      features={cfg.features}
      securityBadge={cfg.securityBadge}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <AuthField
          label={cfg.fieldLabel}
          htmlFor={identifierInputId}
          icon={Mail}
          error={errors.identifier?.message}
        >
          <input
            id={identifierInputId}
            placeholder={cfg.fieldPlaceholder}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            spellCheck={false}
            aria-invalid={errors.identifier ? "true" : "false"}
            {...register("identifier", {
              required: `${cfg.fieldLabel} is required.`,
              minLength: {
                value: 3,
                message: "Enter a valid identifier before continuing.",
              },
            })}
            className="auth-input w-full border-0 bg-transparent p-0 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
        </AuthField>

        <PasswordField
          label="Password"
          htmlFor={passwordInputId}
          icon={Lock}
          error={errors.password?.message}
          trailing={(
            <button
              type="button"
              onClick={() => setShowPass((value) => !value)}
              className="rounded-full p-1 text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--role-accent)]"
              aria-label={showPass ? "Hide password" : "Show password"}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        >
          <input
            id={passwordInputId}
            type={showPass ? "text" : "password"}
            placeholder="Enter your password"
            autoComplete="current-password"
            aria-invalid={errors.password ? "true" : "false"}
            {...register("password", {
              required: "Password is required.",
              minLength: {
                value: 8,
                message: "Password must be at least 8 characters.",
              },
            })}
            className="auth-input w-full border-0 bg-transparent p-0 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
        </PasswordField>

        <RememberMeRow>
          <label className="auth-remember inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              className="auth-remember-checkbox h-4 w-4 rounded-[4px]"
              {...register("remember")}
            />
            <span>Remember me</span>
          </label>
          <Link
            to={`/auth/forgot-password?role=${encodeURIComponent(role)}`}
            className="auth-role-link text-sm font-semibold underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </RememberMeRow>

        {retryAfter > 0 ? (
          <p className="text-sm font-medium text-amber-600">
            Retry available in {Math.ceil(retryAfter / 60)} minute{Math.ceil(retryAfter / 60) === 1 ? "" : "s"}.
          </p>
        ) : null}

        <AuthErrorAlert error={error} />

        <AuthSubmitButton
          loading={loading}
          label={cfg.submitLabel}
          disabled={retryAfter > 0}
        />
      </form>
    </AuthLayout>
  );
}
