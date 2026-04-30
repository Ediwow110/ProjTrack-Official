import { useEffect, useMemo, useState } from "react";
import { Database, Key, Mail, RefreshCcw, Shield } from "lucide-react";
import { adminOpsService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import type { SystemSettingsResponse } from "../../lib/api/contracts";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { SettingsFieldRow } from "../../components/settings/SettingsFieldRow";
import { SettingsSection } from "../../components/settings/SettingsSection";
import { SettingsShell } from "../../components/settings/SettingsShell";
import { SettingsStatusBanner } from "../../components/settings/SettingsStatusBanner";
import { StickySaveBar } from "../../components/settings/StickySaveBar";

const defaultForm: SystemSettingsResponse = {
  schoolName: "PROJTRACK Academy Portal",
  email: "admin@projtrack.edu.ph",
  notifEmail: "noreply@projtrack.edu.ph",
  minPassLen: "8",
  maxFailedLogins: "5",
  sessionTimeout: "60",
  allowRegistration: false,
  requireEmailVerification: true,
  twoFactorAdmin: false,
  backupFrequency: "Daily",
  accountAccessEmailsEnabled: true,
  classroomActivityEmailsEnabled: false,
  classroomActivitySystemNotificationsEnabled: true,
};

export default function AdminSettings() {
  const { data, loading, error, reload } = useAsyncData(() => adminOpsService.getSystemSettings(), []);
  const [saved, setSaved] = useState(false);
  const [saveState, setSaveState] = useState<{ saving: boolean; error: string | null }>({
    saving: false,
    error: null,
  });
  const [form, setForm] = useState<SystemSettingsResponse>(defaultForm);
  const baseForm = useMemo<SystemSettingsResponse>(
    () =>
      data
        ? {
            ...data,
            accountAccessEmailsEnabled: true,
            classroomActivitySystemNotificationsEnabled: data.classroomActivityEmailsEnabled
              ? data.classroomActivitySystemNotificationsEnabled
              : true,
          }
        : defaultForm,
    [data],
  );

  useEffect(() => {
    if (data) {
      setForm(baseForm);
    }
  }, [baseForm, data]);

  const handleSave = async () => {
    if (saveState.saving) return;
    setSaved(false);
    setSaveState({ saving: true, error: null });

    try {
      await adminOpsService.saveSystemSettings({
        ...form,
        accountAccessEmailsEnabled: true,
        classroomActivitySystemNotificationsEnabled: form.classroomActivityEmailsEnabled
          ? form.classroomActivitySystemNotificationsEnabled
          : true,
      });
      await reload();
      setSaved(true);
      setSaveState({ saving: false, error: null });
      window.setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaveState({ saving: false, error: "Unable to save system settings right now." });
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void handleSave();
  };

  const resetForm = () => {
    setSaved(false);
    setSaveState((current) => ({ ...current, error: null }));
    setForm(baseForm);
  };

  const busy = loading || saveState.saving;
  const initialLoading = loading && !data;
  const isDirty = JSON.stringify(form) !== JSON.stringify(baseForm);

  const sections = [
    {
      icon: Shield,
      title: "Branding",
      description: "Control the shared product identity shown across public-facing screens and notifications.",
      fields: [{ key: "schoolName", label: "School Name", type: "text", description: "Primary institution or portal name." }],
    },
    {
      icon: Mail,
      title: "Email Settings",
      description: "Set the inboxes used for administrator contact and outbound notification delivery.",
      fields: [
        { key: "email", label: "Admin Email", type: "email", description: "Main support and escalation address." },
        { key: "notifEmail", label: "Notification From", type: "email", description: "Visible sender for system mail." },
      ],
    },
    {
      icon: Key,
      title: "Password Policy",
      description: "Define the core account protection rules used by the portal.",
      fields: [
        { key: "minPassLen", label: "Min Password Length", type: "number", description: "Minimum length required for passwords." },
      ],
    },
    {
      icon: Database,
      title: "Backup",
      description: "Backup cadence is controlled by BACKUP_WORKER_ENABLED and BACKUP_INTERVAL_HOURS in the deployment environment.",
      fields: [],
    },
  ] as const;

  return (
    <SettingsShell
      title="Settings"
      description="System-wide configuration and preferences for portal identity, account policies, notifications, and backups."
      meta={loading ? "Refreshing settings..." : `${sections.length + 2} configuration groups`}
      actions={
        <Button type="button" variant="outline" disabled={busy} onClick={reload}>
          <RefreshCcw size={14} />
          Refresh
        </Button>
      }
    >
      {error ? (
        <SettingsStatusBanner
          tone="error"
          title="Unable to load system settings."
          description={error}
        />
      ) : null}
      {saveState.error ? (
        <SettingsStatusBanner
          tone="error"
          title="Unable to save system settings right now."
          description={saveState.error}
        />
      ) : null}
      {saved ? (
        <SettingsStatusBanner
          tone="success"
          title="Settings saved successfully."
          description="Your system-wide preferences are now up to date."
        />
      ) : null}
      {loading ? (
        <SettingsStatusBanner
          tone="info"
          title="Refreshing settings..."
          description="Fetching the latest portal configuration."
        />
      ) : null}

      {initialLoading ? (
        <SettingsSection
          title="Loading system settings"
          description="Pulling the current configuration from the server before editing is enabled."
        >
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Please wait while the latest system configuration is prepared.
          </p>
        </SettingsSection>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <SettingsSection
                key={section.title}
                title={section.title}
                description={section.description}
                className={busy ? "opacity-95" : undefined}
              >
                <div className="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                  <Icon size={18} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {section.fields.map((field) => {
                    const fieldId = `system-${field.key}`;
                    const labelId = `${fieldId}-label`;
                    const value = String(form[field.key as keyof SystemSettingsResponse]);
                    const selectOptions =
                      "opts" in field && Array.isArray(field.opts)
                        ? (field.opts as readonly string[])
                        : null;

                    return (
                      <SettingsFieldRow
                        key={field.key}
                        label={field.label}
                        htmlFor={selectOptions ? undefined : fieldId}
                        labelId={labelId}
                        description={field.description}
                      >
                        {selectOptions ? (
                          <Select
                            value={value}
                            onValueChange={(nextValue) => setForm({ ...form, [field.key]: nextValue })}
                          >
                            <SelectTrigger id={fieldId} aria-labelledby={labelId}>
                              <SelectValue placeholder={field.label} />
                            </SelectTrigger>
                            <SelectContent>
                              {selectOptions.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id={fieldId}
                            type={field.type}
                            value={value}
                            onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                          />
                        )}
                      </SettingsFieldRow>
                    );
                  })}
                </div>
              </SettingsSection>
            );
          })}

          <SettingsSection
            title="Access Rules"
            description="Save portal policies for new accounts and administrator sign-ins."
            className={busy ? "opacity-95" : undefined}
          >
            <div className="rounded-[var(--radius-card)] border border-slate-200/80 bg-white/70 px-4 py-4 text-xs leading-6 text-slate-500 dark:border-slate-700/60 dark:bg-slate-900/30 dark:text-slate-400">
              These policy settings are stored centrally and applied where the current portal flow supports them.
            </div>
            {[
              {
                label: "Allow self-registration",
                key: "allowRegistration",
                description: "Let new users create their own portal accounts without staff setup.",
              },
              {
                label: "Require email verification",
                key: "requireEmailVerification",
                description: "Require account email confirmation before the portal is fully unlocked.",
              },
              {
                label: "Require 2FA for admins (coming soon)",
                key: "twoFactorAdmin",
                description: "Two-factor authentication is not active until the backend 2FA flow is implemented.",
              },
            ].map((item) => {
              const switchId = `system-${item.key}`;
              const labelId = `${switchId}-label`;
              const enabled = Boolean(form[item.key as keyof SystemSettingsResponse]);

              return (
                <SettingsFieldRow
                  key={item.key}
                  label={item.label}
                  labelId={labelId}
                  description={item.description}
                  layout="inline"
                >
                  <Switch
                    id={switchId}
                    aria-labelledby={labelId}
                    checked={enabled}
                    disabled={item.key === "twoFactorAdmin"}
                    onCheckedChange={(checked) => setForm({ ...form, [item.key]: checked })}
                  />
                </SettingsFieldRow>
              );
            })}
          </SettingsSection>

          <SettingsSection
            title="Notification Delivery"
            description="Keep account access emails available, then choose how classroom activity updates reach users."
            className={busy ? "opacity-95" : undefined}
          >
            <div className="rounded-[var(--radius-card)] border border-blue-200/70 bg-blue-50/85 px-4 py-4 text-xs leading-6 text-blue-800 dark:border-blue-400/25 dark:bg-blue-500/12 dark:text-blue-100">
              Invitations, account activation, and password resets stay email-based. Classroom activity can use email, in-app notifications, or both.
            </div>

            <SettingsFieldRow
              label="Account access emails"
              description="Required for invitations, account activation, and password reset delivery."
              layout="inline"
            >
              <Switch checked disabled />
            </SettingsFieldRow>

            <SettingsFieldRow
              label="Send classroom activity emails"
              description="Deliver subject updates, grading, reopen notices, and similar classroom events by email."
              layout="inline"
            >
              <Switch
                checked={form.classroomActivityEmailsEnabled}
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    classroomActivityEmailsEnabled: checked,
                    classroomActivitySystemNotificationsEnabled: checked
                      ? current.classroomActivitySystemNotificationsEnabled
                      : true,
                  }))
                }
              />
            </SettingsFieldRow>

            <SettingsFieldRow
              label="Use in-app system notifications for classroom activity"
              description={
                form.classroomActivityEmailsEnabled
                  ? "Show the same classroom updates inside the portal notification feed."
                  : "This stays on automatically while classroom activity email is turned off."
              }
              layout="inline"
            >
              <Switch
                checked={
                  form.classroomActivityEmailsEnabled
                    ? form.classroomActivitySystemNotificationsEnabled
                    : true
                }
                disabled={!form.classroomActivityEmailsEnabled}
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    classroomActivitySystemNotificationsEnabled: checked,
                  }))
                }
              />
            </SettingsFieldRow>
          </SettingsSection>
        </form>
      )}

      <StickySaveBar
        open={!initialLoading && (isDirty || saveState.saving)}
        saving={saveState.saving}
        saveLabel="Save Settings"
        resetLabel="Reset changes"
        title="Unsaved system settings"
        description={
          saveState.saving
            ? "Saving your latest configuration now."
            : "Review your updates, then save them when you're ready."
        }
        onSave={() => {
          void handleSave();
        }}
        onReset={resetForm}
      />
    </SettingsShell>
  );
}
