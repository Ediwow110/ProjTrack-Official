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
import { profileService } from "../../lib/api/services";
import type { TeacherProfileResponse } from "../../lib/api/contracts";
import { toast } from "sonner";

export default function TeacherProfile() {
  const [profile, setProfile] = useState<TeacherProfileResponse | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    office: "",
    avatarRelativePath: "",
  });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState("");
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(() => Date.now());

  useEffect(() => {
    let mounted = true;
    profileService
      .getTeacherProfile()
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
      .catch(() => {
        if (active) setAvatarSrc("");
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [profile?.avatarRelativePath, avatarRefreshKey]);

  const applyProfile = (next: TeacherProfileResponse) => {
    setProfile(next);
    setForm({ ...next.form, avatarRelativePath: next.form.avatarRelativePath ?? "" });
    setAvatarRefreshKey(Date.now());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      applyProfile(await profileService.updateTeacherProfile(form));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save profile.");
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword) {
      setError("Enter your current password and a new password.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from the current password.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await profileService.changeTeacherPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update password.");
    } finally {
      setBusy(false);
    }
  };

  const handleAvatarChange = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Only image files can be used for the profile photo.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Profile photo must be 5 MB or smaller.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      applyProfile(await profileService.uploadTeacherAvatar(file));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to upload avatar.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setBusy(true);
    setError(null);
    try {
      applyProfile(await profileService.removeTeacherAvatar());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to remove avatar.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <PortalPage>
        <div className="h-[420px] animate-pulse rounded-[32px] border border-white/70 bg-white/85" />
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
        tone="teal"
        eyebrow="Teacher Account"
        title="My Profile"
        description="Manage your teaching identity, contact details, office information, and sign-in credentials from one calmer workspace."
        icon={UserCircle2}
        meta={[
          { label: "Role", value: profile.roleLabel },
          { label: "Profile", value: saved ? "Recently saved" : "Editable" },
          { label: "Security", value: busy ? "Working" : "Ready" },
        ]}
        stats={profile.summary.slice(0, 4).map((item) => ({
          label: item.label,
          value: item.value,
          hint: "Live account information from your teacher profile.",
        }))}
      />

      {error ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {saved ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Profile changes were saved.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.92fr,1.08fr]">
        <PortalPanel
          title="Account Snapshot"
          description="Your visible identity and teaching-role summary."
        >
          <div className="space-y-5 text-center">
            <div className="relative inline-block">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt="Teacher avatar"
                  className="mx-auto h-24 w-24 rounded-[28px] object-cover shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)]"
                />
              ) : (
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] bg-teal-700 text-3xl font-semibold text-white shadow-[0_18px_45px_-30px_rgba(13,148,136,0.55)]">
                  {profile.initials}
                </div>
              )}
              <label className="absolute -bottom-1 -right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow transition hover:bg-slate-50">
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
                disabled={busy}
                onClick={handleRemoveAvatar}
                className="mx-auto inline-flex items-center gap-1 text-xs text-slate-500 transition hover:text-rose-600 disabled:opacity-50"
              >
                <Trash2 size={12} />
                Remove avatar
              </button>
            ) : null}

            <div>
              <p className="font-display text-2xl font-semibold tracking-[-0.04em] text-slate-900">
                {profile.fullName}
              </p>
              <p className="mt-1 text-sm text-slate-500">{profile.roleLabel}</p>
            </div>

            <div className="space-y-3">
              {profile.summary.map((field) => (
                <div
                  key={field.label}
                  className="flex items-center justify-between rounded-[20px] border border-slate-200 bg-slate-50/85 px-4 py-3 text-left"
                >
                  <span className="text-xs text-slate-400">{field.label}</span>
                  <span className={`text-sm font-semibold ${field.tone ?? "text-slate-700"}`}>
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
            description="Edit the contact and office details you manage directly from your teacher account."
          >
            <form onSubmit={saveProfile} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { key: "firstName", label: "First Name", type: "text" },
                  { key: "lastName", label: "Last Name", type: "text" },
                  { key: "email", label: "Email Address", type: "email" },
                  { key: "phone", label: "Phone Number", type: "tel" },
                  { key: "office", label: "Office", type: "text" },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {field.label}
                    </label>
                    <input
                      type={field.type}
                      value={form[field.key as keyof typeof form] || ""}
                      onChange={(event) =>
                        setForm({ ...form, [field.key]: event.target.value })
                      }
                      className="w-full rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-teal-300"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-2xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-28px_rgba(13,148,136,0.55)] transition hover:bg-teal-800 disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </PortalPanel>

          <PortalPanel
            title="Password and Access"
            description="Rotate your credentials when needed and keep your teaching account secure."
          >
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    type={showOld ? "text" : "password"}
                    className="w-full rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 pr-11 text-sm text-slate-700 outline-none transition focus:border-teal-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOld(!showOld)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showOld ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  New Password
                </label>
                <div className="relative">
                  <input
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    type={showNew ? "text" : "password"}
                    className="w-full rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 pr-11 text-sm text-slate-700 outline-none transition focus:border-teal-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50/85 px-4 py-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck size={18} className="mt-0.5 text-teal-700" />
                  <p className="text-sm leading-6 text-slate-600">
                    Use at least 8 characters and choose a password that is different from your current password.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={changePassword}
                  disabled={busy || !currentPassword || !newPassword}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <Lock size={15} />
                  Update Password
                </button>
              </div>
            </div>
          </PortalPanel>
        </div>
      </div>
    </PortalPage>
  );
}
