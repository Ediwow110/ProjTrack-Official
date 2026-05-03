import { useEffect, useState } from "react";
  import { Link, useLocation, useNavigate } from "react-router";
  import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
    AuthField,
    AuthLayout,
    type AuthFeature,
  } from "../../components/auth/AuthLayout";
  import { Button } from "../../components/ui/button";
  import { getAuthSession, getRememberMePreference, setRememberMePreference, type AppRole } from "../../lib/mockAuth";
  import { ApiError } from "../../lib/api/http";
  import { authService } from "../../lib/api/services";
  import { fadeUpVariants } from "../../lib/motion";

  type RoleConfig = {
    portalEyebrow: string;
    cardKicker: string;
    headlineL1: string;
    headlineL2Pre: string;
    headlineAccent: string;
    description: string;
    icon: typeof GraduationCap;
    fieldLabel: string;
    fieldPlaceholder: string;
    submitLabel: string;
    features: AuthFeature[];
    securityBadge?: string;
  };

  const studentTeacherFeatures: AuthFeature[] = [
    { icon: Clock, label: "Real-time", sub: "Submission Tracking" },
    { icon: Users, label: "Easy Class", sub: "Management" },
    { icon: Bell, label: "Instant Alerts", sub: "& Reminders" },
    { icon: ShieldCheck, label: "Secure & Reliable", sub: "Platform" },
  ];

  const adminFeatures: AuthFeature[] = [
    { icon: User, label: "User", sub: "Management" },
    { icon: BarChart3, label: "Reports &", sub: "Analytics" },
    { icon: ShieldCheck, label: "System", sub: "Control" },
    { icon: Lock, label: "Secure", sub: "Access" },
  ];

  const cfgMap: Record<AppRole, RoleConfig> = {
    student: {
      portalEyebrow: "STUDENT PORTAL",
      cardKicker: "Student Portal Login",
      headlineL1: "Manage. Submit.",
      headlineL2Pre: "Achieve. ",
      headlineAccent: "Together.",
      description:
        "ProjTrack helps students stay organized, submit projects on time, and collaborate seamlessly with their teachers.",
      icon: GraduationCap,
      fieldLabel: "Email or Student ID",
      fieldPlaceholder: "Enter your email or student ID",
      submitLabel: "Sign In",
      features: studentTeacherFeatures,
    },
    teacher: {
      portalEyebrow: "TEACHER PORTAL",
      cardKicker: "Teacher Portal Login",
      headlineL1: "Manage. Review.",
      headlineL2Pre: "Guide. ",
      headlineAccent: "Together.",
      description:
        "ProjTrack helps teachers review submissions, manage classes, and provide feedback faster and easier.",
      icon: GraduationCap,
      fieldLabel: "Email or Teacher ID",
      fieldPlaceholder: "Enter your email or teacher ID",
      submitLabel: "Sign In as Teacher",
      features: studentTeacherFeatures,
    },
    admin: {
      portalEyebrow: "ADMIN PORTAL",
      cardKicker: "Admin Portal Login",
      headlineL1: "Manage. Monitor.",
      headlineL2Pre: "Secure. ",
      headlineAccent: "Together.",
      description:
        "ProjTrack helps administrators manage users, departments, reports, and system access in one secure platform.",
      icon: ShieldCheck,
      fieldLabel: "Email or Admin ID",
      fieldPlaceholder: "Enter your email or admin ID",
      submitLabel: "Sign In as Admin",
      features: adminFeatures,
      securityBadge: "Your data is protected with enterprise-grade security.",
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
    const reducedMotion = useReducedMotion() ?? false;
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
        headlineL1={cfg.headlineL1}
        headlineL2Pre={cfg.headlineL2Pre}
        headlineAccent={cfg.headlineAccent}
        description={cfg.description}
        icon={Icon}
        features={cfg.features}
        securityBadge={cfg.securityBadge}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <AuthField label={cfg.fieldLabel} htmlFor={identifierInputId} icon={Mail}>
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
              className="auth-input w-full border-0 bg-transparent p-0 text-sm text-white outline-none placeholder:text-slate-500"
            />
          </AuthField>
          {errors.identifier ? (
            <p className="text-sm font-medium text-amber-300">{errors.identifier.message}</p>
          ) : null}

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
              className="auth-input w-full border-0 bg-transparent p-0 text-sm text-white outline-none placeholder:text-slate-500"
            />
          </AuthField>
          {errors.password ? (
            <p className="text-sm font-medium text-amber-300">{errors.password.message}</p>
          ) : null}

          <div className="flex items-center justify-between gap-4">
            <label className="auth-remember inline-flex items-center gap-2 text-sm text-slate-200">
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
          </div>

          {retryAfter > 0 ? (
            <p className="text-sm font-medium text-amber-300">
              Retry available in {Math.ceil(retryAfter / 60)} minute{Math.ceil(retryAfter / 60) === 1 ? "" : "s"}.
            </p>
          ) : null}

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
            className="auth-role-button auth-submit-button h-14 w-full rounded-[var(--radius-control)] px-5 text-base font-bold"
          >
            {loading ? "Signing in..." : (
              <span className="inline-flex items-center justify-center gap-2">
                {cfg.submitLabel}
                <span aria-hidden="true">→</span>
              </span>
            )}
          </Button>
        </form>
      </AuthLayout>
    );
  }
  