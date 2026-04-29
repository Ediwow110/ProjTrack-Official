import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { authService } from "../../lib/api/services";

export default function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") || "";
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const response = await authService.forgotPassword(email, role || undefined);
      setMessage(response.message || "If this email exists, we sent instructions.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request a password reset.");
    } finally {
      setSubmitting(false);
    }
  };

  const normalizedRole = role.toLowerCase();
  const backTarget =
    normalizedRole === "teacher" || normalizedRole === "admin"
      ? `/${normalizedRole}/login`
      : "/student/login";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-800/70 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white dark:bg-slate-900/85 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl p-8 space-y-6">
        <Link to={backTarget} className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800">
          <ArrowLeft size={15} /> Back to login
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Forgot password</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Request password instructions for your PROJTRACK account.</p>
        </div>
        {error && <div className="rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{error}</div>}
        {message && <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-2"><CheckCircle2 size={15} /> {message}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 mb-2">Email</span>
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70">
              <Mail size={16} className="text-slate-400 dark:text-slate-300" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent outline-none text-sm text-slate-800 dark:text-slate-100" placeholder="you@school.edu.ph" />
            </div>
          </label>
          <button disabled={!email || submitting} type="submit" className="w-full rounded-2xl px-4 py-3.5 bg-blue-800 text-white text-sm font-semibold hover:bg-blue-900 disabled:opacity-60">
            {submitting ? "Sending..." : "Send instructions"}
          </button>
        </form>
      </div>
    </div>
  );
}
