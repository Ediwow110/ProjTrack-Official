import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, CheckCircle2, Lock } from "lucide-react";
import { authService } from "../../lib/api/services";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const ref = searchParams.get("ref") || "";
  const role = (searchParams.get("role") || "student").toLowerCase();
  const mode = (searchParams.get("mode") || "").toLowerCase();
  const isSetupMode = mode === "setup";
  const backTarget = role === "teacher" || role === "admin" ? `/${role}/login` : "/student/login";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const disabled = useMemo(() => !ref || !token || !password || !confirmPassword, [ref, token, password, confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      const response = await authService.resetPassword(ref, token, password, confirmPassword);
      setMessage(response.message || (isSetupMode ? "Password created successfully." : "Password updated successfully."));
      window.setTimeout(() => navigate(backTarget), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset the password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl p-8 space-y-6">
        <Link to={backTarget} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={15} /> Back to login
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{isSetupMode ? "Create password" : "Reset password"}</h1>
          <p className="text-sm text-slate-500 mt-2">
            {isSetupMode
              ? "Set your first password to finish preparing your PROJTRACK account."
              : "Enter a new password for your PROJTRACK account."}
          </p>
        </div>
        {(!ref || !token) && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">Missing reset reference or token. Open the full link from your email.</div>}
        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 inline-flex items-center gap-2"><CheckCircle2 size={15} /> {message}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mb-2">New password</span>
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50">
              <Lock size={16} className="text-slate-400" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-transparent outline-none text-sm text-slate-800" placeholder="Enter a new password" />
            </div>
          </label>
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mb-2">Confirm password</span>
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50">
              <Lock size={16} className="text-slate-400" />
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full bg-transparent outline-none text-sm text-slate-800" placeholder="Confirm your new password" />
            </div>
          </label>
          <button disabled={disabled || submitting} type="submit" className="w-full rounded-2xl px-4 py-3.5 bg-blue-800 text-white text-sm font-semibold hover:bg-blue-900 disabled:opacity-60">
            {submitting ? "Saving..." : isSetupMode ? "Create password" : "Reset password"}
          </button>
        </form>
      </div>
    </div>
  );
}
