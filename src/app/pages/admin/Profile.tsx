import { useEffect, useState } from "react";
import { Camera, CheckCircle2, Eye, EyeOff, Lock, Trash2 } from "lucide-react";
import { profileService } from "../../lib/api/services";
import type { AdminProfileResponse } from "../../lib/api/contracts";
import { toast } from "sonner";

export default function AdminProfile() {
  const [profile, setProfile] = useState<AdminProfileResponse | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", office: "", avatarRelativePath: "" });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState("");
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(() => Date.now());

  useEffect(() => {
    let mounted = true;
    profileService.getAdminProfile().then((data) => {
      if (!mounted) return;
      setProfile(data);
      setForm({ ...data.form, avatarRelativePath: data.form.avatarRelativePath ?? "" });
      setLoading(false);
    }).catch((err) => {
      if (!mounted) return;
      setError(err instanceof Error ? err.message : 'Unable to load profile.');
      setLoading(false);
    });
    return () => { mounted = false; };
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

  const refresh = (next: AdminProfileResponse) => {
    setProfile(next);
    setForm({ ...next.form, avatarRelativePath: next.form.avatarRelativePath ?? "" });
    setAvatarRefreshKey(Date.now());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try { refresh(await profileService.updateAdminProfile(form)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to save profile.'); }
    finally { setBusy(false); }
  };

  const changePassword = async () => {
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try { await profileService.changeAdminPassword(currentPassword, newPassword); setCurrentPassword(''); setNewPassword(''); setSaved(true); window.setTimeout(() => setSaved(false), 2500); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to update password.'); }
    finally { setBusy(false); }
  };

  const handleAvatarChange = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try { refresh(await profileService.uploadAdminAvatar(file)); }
    catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to upload avatar.';
      setError(message);
      toast.error(message);
    }
    finally { setBusy(false); }
  };

  const removeAvatar = async () => {
    setBusy(true);
    setError(null);
    try { refresh(await profileService.removeAdminAvatar()); }
    catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to remove avatar.';
      setError(message);
      toast.error(message);
    }
    finally { setBusy(false); }
  };

  if (loading) return <div className="p-6 max-w-5xl mx-auto text-sm text-slate-400 dark:text-slate-300">Loading profile…</div>;
  if (!profile) return <div className="p-6 max-w-5xl mx-auto text-sm text-rose-600">{error || 'Profile unavailable.'}</div>;

  return <div className="p-6 max-w-5xl mx-auto space-y-6">
    <div><h1 className="text-slate-900 dark:text-slate-100 font-bold" style={{ fontSize: '1.3rem', letterSpacing: '-0.02em' }}>My Profile</h1><p className="text-slate-400 dark:text-slate-300 text-sm mt-0.5">Manage your administrator account and password.</p></div>
    {error && <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300">{error}</div>}
    {saved && <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30"><CheckCircle2 size={16} className="text-emerald-600 shrink-0" /><p className="text-emerald-700 dark:text-emerald-300 text-sm font-semibold">Profile changes were saved.</p></div>}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-6 text-center">
        <div className="relative inline-block mb-4">
          {avatarSrc ? <img src={avatarSrc} alt="Admin avatar" className="w-20 h-20 rounded-2xl object-cover mx-auto" /> : <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center text-white text-2xl font-bold mx-auto">{profile.initials}</div>}
          <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white dark:bg-slate-900/85 border border-slate-200 dark:border-slate-700 shadow flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer"><Camera size={13} /><input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => handleAvatarChange(e.target.files?.[0])} /></label>
        </div>
        {profile.avatarRelativePath && <button type="button" disabled={busy} onClick={removeAvatar} className="mx-auto mb-3 inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-rose-600 disabled:opacity-50"><Trash2 size={12} /> Remove avatar</button>}
        <p className="text-slate-900 dark:text-slate-100 font-bold text-base">{profile.fullName}</p><p className="text-slate-400 dark:text-slate-300 text-xs mt-0.5">{profile.roleLabel}</p>
        <div className="mt-4 space-y-2 text-left">{profile.summary.map((f) => <div key={f.label} className="flex items-center justify-between py-1.5 border-b border-slate-50 dark:border-slate-700/60 last:border-0"><span className="text-slate-400 dark:text-slate-300 text-xs">{f.label}</span><span className={`text-xs font-semibold ${f.tone ?? 'text-slate-700 dark:text-slate-200'}`}>{f.value}</span></div>)}</div>
      </div>
      <div className="lg:col-span-2 space-y-5">
        <form onSubmit={saveProfile} className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-6">
          <h2 className="text-slate-800 dark:text-slate-100 text-sm font-bold mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/70">Personal Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[{ key: 'firstName', label: 'First Name', type: 'text' },{ key: 'lastName', label: 'Last Name', type: 'text' },{ key: 'email', label: 'Email Address', type: 'email' },{ key: 'phone', label: 'Phone Number', type: 'tel' },{ key: 'office', label: 'Office', type: 'text' }].map((f) => <div key={f.key}><label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">{f.label}</label><input type={f.type} value={form[f.key as keyof typeof form]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 text-sm outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-700/10 transition-all" /></div>)}</div>
          <div className="mt-4 flex justify-end"><button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-900 disabled:opacity-50">Save Changes</button></div>
        </form>
        <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/70"><Lock size={15} className="text-slate-500 dark:text-slate-400" /><h2 className="text-slate-800 dark:text-slate-100 text-sm font-bold">Change Password</h2></div>
          <div className="space-y-4">
            <div><label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Current Password</label><div className="relative"><input value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} type={showOld ? 'text' : 'password'} className="w-full px-3 py-2.5 pr-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 text-sm outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-700/10 transition-all" /><button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300">{showOld ? <EyeOff size={14} /> : <Eye size={14} />}</button></div></div>
            <div><label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">New Password</label><div className="relative"><input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type={showNew ? 'text' : 'password'} className="w-full px-3 py-2.5 pr-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 text-sm outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-700/10 transition-all" /><button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300">{showNew ? <EyeOff size={14} /> : <Eye size={14} />}</button></div></div>
            <div className="flex justify-end"><button type="button" onClick={changePassword} disabled={busy || !currentPassword || !newPassword} className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50">Update Password</button></div>
          </div>
        </div>
      </div>
    </div>
  </div>;
}
