import { useEffect, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  Trash2,
  UserCircle2,
} from "lucide-react";
import {
  PortalEmptyState,
  PortalHero,
  PortalPage,
  PortalPanel,
} from "../../components/portal/PortalPage";
import { profileService, dataDeletionService } from "../../lib/api/services";
import type { StudentProfileResponse } from "../../lib/api/contracts";
import { toast } from "sonner";

export default function StudentProfile() {
  const [saved, setSaved] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [profile, setProfile] = useState<StudentProfileResponse | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    avatarRelativePath: "",
  });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [avatarSrc, setAvatarSrc] = useState("");
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(() => Date.now());

  useEffect(() => {
    let mounted = true;
    profileService
      .getStudentProfile()
      .then((data) => {
        if (!mounted) return;
        setProfile(data);
        setForm({ ...data.form, avatarRelativePath: data.form.avatarRelativePath ?? "" });
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Unable to load profile.");
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    if (!profile?.avatarRelativePath) {
      setAvatarSrc("");
      return () => undefined;
    }

    profileService.getAvatarObjectUrl(profile.avatarRelativePath, avatarRefreshKey)
      .then((url) => {
        if (!active) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setAvatarSrc(url);
      })
      .catch((avatarError) => {
        if (!active) return;
        setAvatarSrc("");
        setError(avatarError instanceof Error ? `Unable to load avatar preview: ${avatarError.message}` : "Unable to load avatar preview.");
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [profile?.avatarRelativePath, avatarRefreshKey]);

  const applyProfile = (next: StudentProfileResponse) => {
    setProfile(next);
    setForm({ ...next.form, avatarRelativePath: next.form.avatarRelativePath ?? "" });
    setAvatarRefreshKey(Date.now());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3000);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      applyProfile(await profileService.updateStudentProfile(form));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordSaving(true);
    setPasswordMessage(null);
    setError(null);
    try {
      await profileService.changeStudentPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordMessage("Password updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleAvatarChange = async (file?: File | null) => {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      applyProfile(await profileService.uploadStudentAvatar(file));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to upload avatar.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setSaving(true);
    setError(null);
    try {
      applyProfile(await profileService.removeStudentAvatar());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to remove avatar.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PortalPage>
        <div className="h-[420px] animate-pulse rounded-[32px] border border-white/70 bg-white/85 dark:bg-slate-900/85" />
      </PortalPage>
    );
  }

  if (!profile) {
    return (
      <PortalPage>
        <PortalEmptyState
          title="Profile unavailable"
          description={error || "The profile could not be loaded right now."}
          icon={UserCircle2}
        />
      </PortalPage>
    );
  }

  return (
    <PortalPage className="space-y-6">
      <PortalHero
        tone="blue"
        eyebrow="Account Workspace"
        title="My Profile"
        description="Keep your student identity, contact details, and password up to date without leaving the portal."
        icon={UserCircle2}
        meta={[
          { label: "Role", value: profile.roleLabel },
          { label: "Profile", value: saved ? "Recently saved" : "Editable" },
          { label: "Security", value: passwordSaving ? "Updating" : "Ready" },
        ]}
        stats={profile.summary.slice(0, 4).map((item) => ({
          label: item.label,
          value: item.value,
          hint: "Live account information from your profile.",
        }))}
      />

      {error ? (
        <div className="rounded-[24px] border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : null}
      {saved ? (
        <div className="flex items-center gap-2.5 rounded-[24px] border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 px-4 py-3">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Profile updated successfully.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.92fr,1.08fr]">
        <PortalPanel
          title="Account Snapshot"
          description="Your visible identity inside the student workspace."
        >
          <div className="space-y-5 text-center">
            <div className="relative inline-block">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt="Student avatar"
                  className="mx-auto h-24 w-24 rounded-[28px] object-cover shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)]"
                />
              ) : (
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] bg-blue-700 text-3xl font-semibold text-white shadow-[0_18px_45px_-30px_rgba(29,78,216,0.55)]">
                  {profile.initials}
                </div>
              )}
              <label className="absolute -bottom-1 -right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 text-slate-500 dark:text-slate-400 shadow transition hover:bg-slate-50 dark:hover:bg-slate-800/70">
                <Camera size={14} />
                <input
                  hidden
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => handleAvatarChange(event.target.files?.[0])}
                />
              </label>
            </div>

            {profile.avatarRelativePath ? (
              <button
                type="button"
                disabled={saving}
                onClick={handleRemoveAvatar}
                className="mx-auto inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 transition hover:text-rose-600 disabled:opacity-50"
              >
                <Trash2 size={12} />
                Remove avatar
              </button>
            ) : null}

            <div>
              <p className="font-display text-2xl font-semibold tracking-[-0.04em] text-slate-900 dark:text-slate-100">
                {profile.fullName}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{profile.roleLabel}</p>
            </div>

            <div className="space-y-3">
              {profile.summary.map((field) => (
                <div
                  key={field.label}
                  className="flex items-center justify-between rounded-[20px] border border-slate-200 dark:border-slate-700 bg-slate-50/85 dark:bg-slate-800/70 px-4 py-3 text-left"
                >
                  <span className="text-xs text-slate-400 dark:text-slate-300">{field.label}</span>
                  <span className={`text-sm font-semibold ${field.tone ?? "text-slate-700 dark:text-slate-200"}`}>
                    {field.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </PortalPanel>

        <div className="space-y-6">
          <PortalPanel
            title="Personal Information"
            description="Edit the contact details you can manage directly from your student account."
          >
            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { key: "firstName", label: "First Name", type: "text" },
                  { key: "lastName", label: "Last Name", type: "text" },
                  { key: "email", label: "Email Address", type: "email" },
                  { key: "phone", label: "Phone Number", type: "tel" },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      {field.label}
                    </label>
                    <input
                      type={field.type}
                      value={form[field.key as keyof typeof form] || ""}
                      onChange={(event) =>
                        setForm({ ...form, [field.key]: event.target.value })
                      }
                      className="w-full rounded-[22px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 outline-none transition focus:border-blue-300"
                    />
                  </div>
                ))}
              </div>

              <div className="rounded-[22px] border border-amber-100 bg-amber-50 dark:bg-amber-500/15 px-4 py-4 text-sm leading-6 text-amber-800">
                Some fields like Student ID, Section, and Program can only be changed by your school administrator.
              </div>

              <div className="flex justify-end">
                <button
                  disabled={saving}
                  type="submit"
                  className="rounded-2xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-28px_rgba(29,78,216,0.55)] transition hover:bg-blue-800 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </PortalPanel>

          <PortalPanel
            title="Password and Access"
            description="Strengthen your account security by rotating your password when needed."
          >
            {passwordMessage ? (
              <div className="mb-4 rounded-[20px] border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                {passwordMessage}
              </div>
            ) : null}

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    type={showOld ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full rounded-[22px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-4 py-3 pr-11 text-sm text-slate-700 dark:text-slate-200 outline-none transition focus:border-blue-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOld(!showOld)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300"
                  >
                    {showOld ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  New Password
                </label>
                <div className="relative">
                  <input
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    type={showNew ? "text" : "password"}
                    placeholder="At least 8 characters"
                    className="w-full rounded-[22px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-4 py-3 pr-11 text-sm text-slate-700 dark:text-slate-200 outline-none transition focus:border-blue-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300"
                  >
                    {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
                  Min 8 characters, include uppercase, number, and symbol.
                </p>
              </div>

              <div className="rounded-[22px] border border-slate-200 dark:border-slate-700 bg-slate-50/85 dark:bg-slate-800/70 px-4 py-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck size={18} className="mt-0.5 text-blue-700 dark:text-blue-300" />
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Changing your password updates the credentials you use to enter the student portal on future sign-ins.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  disabled={passwordSaving || !currentPassword || !newPassword}
                  type="button"
                  onClick={handlePasswordChange}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50"
                >
                  <Lock size={15} />
                  {passwordSaving ? "Updating..." : "Update Password"}
                </button>
              </div>
            </div>
          </PortalPanel>

          <PortalPanel
            title="Data & Privacy — Deletion Request"
            description="Request deletion of your account data. This is a governed process: submitting does not delete data. An admin must review and approve. Deletion execution is not implemented in this release."
            className="border-amber-200/70"
          >
            <DataDeletionSelfService />
          </PortalPanel>
        </div>
      </div>
    </PortalPage>
  );
}

function DataDeletionSelfService() {
  const [mine, setMine] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const hasPending = mine.some((r: any) => (r.status || "").toUpperCase() === "PENDING");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const rows = await dataDeletionService.listMine();
      setMine(rows || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submitRequest() {
    if (phrase.trim() !== "DELETE MY DATA") {
      setErr('Confirmation phrase must be exactly "DELETE MY DATA"');
      return;
    }
    if (hasPending) {
      setErr("You already have a pending request. Cancel it first or wait for review.");
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await dataDeletionService.createRequest({ reason: reason.trim() || undefined, confirmationPhrase: "DELETE MY DATA" });
      setMsg("Request submitted. Awaiting admin review. No data deleted yet.");
      setPhrase("");
      setReason("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to submit request");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    setBusy(true);
    setErr(null);
    try {
      await dataDeletionService.cancelRequest(id);
      setMsg("Request cancelled.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to cancel");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      {msg && <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{msg}</div>}
      {err && <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}

      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 mb-1">Your requests</div>
        {loading ? <div className="text-slate-400">Loading…</div> : mine.length === 0 ? (
          <div className="text-slate-500">No requests yet.</div>
        ) : (
          <ul className="space-y-1">
            {mine.slice(0, 3).map((r: any) => (
              <li key={r.id} className="flex items-center justify-between rounded border px-2 py-1 text-xs">
                <span>{r.status} — {new Date(r.createdAt).toLocaleDateString()}</span>
                {r.status === "PENDING" && <button disabled={busy} onClick={() => cancel(r.id)} className="text-rose-600 underline">Cancel</button>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-[18px] border border-amber-200 bg-amber-50 p-3 text-amber-800">
        Submitting a request does not delete your data. An administrator must review and approve. Deletion execution is not implemented in this release. This only records your intent for a future governed workflow.
      </div>

      {!hasPending && (
        <div className="space-y-2">
          <label className="block text-xs font-semibold">Optional reason</label>
          <input value={reason} onChange={e => setReason(e.target.value)} className="w-full rounded border px-3 py-2 text-sm" placeholder="Reason (optional)" />
          <label className="block text-xs font-semibold">Confirmation phrase (type exactly)</label>
          <input value={phrase} onChange={e => setPhrase(e.target.value)} className="w-full rounded border px-3 py-2 font-mono text-sm" placeholder="DELETE MY DATA" />
          <button disabled={busy || phrase.trim() !== "DELETE MY DATA"} onClick={submitRequest} className="rounded bg-amber-600 px-4 py-2 text-sm text-white disabled:opacity-50">
            {busy ? "Submitting..." : "Submit Deletion Request"}
          </button>
          <div className="text-[10px] text-amber-700">Exact match required. "DELETE MY DATA"</div>
        </div>
      )}
      {hasPending && <div className="text-xs text-amber-700">You have a pending request. You may cancel it above.</div>}
    </div>
  );
}
