import { useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { adminOpsService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import type { AcademicSettingsResponse } from "../../lib/api/contracts";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { SettingsFieldRow } from "../../components/settings/SettingsFieldRow";
import { SettingsSection } from "../../components/settings/SettingsSection";
import { SettingsShell } from "../../components/settings/SettingsShell";
import { SettingsStatusBanner } from "../../components/settings/SettingsStatusBanner";
import { StickySaveBar } from "../../components/settings/StickySaveBar";

const defaultForm: AcademicSettingsResponse = {
  schoolYear: "2025–2026",
  semester: "2nd Semester",
  periodStart: "2026-01-15",
  periodEnd: "2026-05-30",
  latePolicy: "24h",
  lateDeduction: "10",
  allowedTypes: ["pdf", "docx", "pptx", "zip"],
};

export default function AdminAcademicSettings() {
  const { data, loading, error, reload } = useAsyncData(
    () => adminOpsService.getAcademicSettings(),
    [],
  );
  const [saved, setSaved] = useState(false);
  const [saveState, setSaveState] = useState<{ saving: boolean; error: string | null }>({
    saving: false,
    error: null,
  });
  const [form, setForm] = useState<AcademicSettingsResponse>(defaultForm);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const handleSave = async () => {
    if (saveState.saving) return;

    setSaved(false);
    setSaveState({ saving: true, error: null });

    try {
      await adminOpsService.saveAcademicSettings(form);
      await reload();
      setSaved(true);
      setSaveState({ saving: false, error: null });
      window.setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaveState({
        saving: false,
        error: "Unable to save academic settings right now.",
      });
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void handleSave();
  };

  const resetForm = () => {
    setSaved(false);
    setSaveState((current) => ({ ...current, error: null }));
    setForm(data ?? defaultForm);
  };

  const busy = loading || saveState.saving;
  const initialLoading = loading && !data;
  const isDirty = JSON.stringify(form) !== JSON.stringify(data ?? defaultForm);
  const schoolYearSuggestions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const generated = Array.from({ length: 4 }, (_, index) => {
      const startYear = currentYear - 1 + index;
      return `${startYear}\u2013${startYear + 1}`;
    });

    return Array.from(
      new Set(
        [form.schoolYear, ...generated]
          .map((value) => String(value ?? "").trim())
          .filter(Boolean),
      ),
    );
  }, [form.schoolYear]);

  return (
    <SettingsShell
      title="Academic Settings"
      description="Configure the active school year, submission window, and late-policy defaults used across the portal."
      meta={
        loading
          ? "Loading academic settings..."
          : saveState.saving
            ? "Saving academic settings..."
            : "Changes take effect after saving."
      }
      actions={
        <Button type="button" variant="outline" disabled={busy} onClick={reload}>
          <RefreshCcw size={14} />
          Refresh
        </Button>
      }
    >
      <SettingsStatusBanner
        tone="info"
        title="Manage the active school year, term, and submission policies."
        description="These settings drive the current academic cycle shown to administrators, teachers, and students."
      />

      {error ? (
        <SettingsStatusBanner
          tone="error"
          title="Unable to load academic settings right now."
          description={error}
        />
      ) : null}

      {saveState.error ? (
        <SettingsStatusBanner
          tone="error"
          title="Unable to save academic settings right now."
          description={saveState.error}
        />
      ) : null}

      {saved ? (
        <SettingsStatusBanner
          tone="success"
          title="Academic settings saved successfully."
          description="The latest term and submission policy values are now active."
        />
      ) : null}

      {initialLoading ? (
        <SettingsSection
          title="Loading academic settings"
          description="Pulling the current academic term configuration before editing is enabled."
        >
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Please wait while the latest academic settings are prepared.
          </p>
        </SettingsSection>
      ) : (
        <form onSubmit={handleSubmit} className={busy ? "opacity-90" : undefined}>
          <div className="space-y-5">
            <SettingsSection
              title="Academic Year & Term"
              description="Keep the active year and semester aligned with the current operating period."
              className={busy ? "opacity-95" : undefined}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <SettingsFieldRow
                  label="School Year"
                  htmlFor="academic-school-year"
                  description="Type a new academic year here to make it the active year across the portal."
                >
                  <div className="space-y-3">
                    <Input
                      id="academic-school-year"
                      disabled={busy}
                      value={form.schoolYear}
                      onChange={(event) =>
                        setForm({ ...form, schoolYear: event.target.value })
                      }
                      placeholder="2026–2027"
                    />
                    <div className="flex flex-wrap gap-2">
                      {schoolYearSuggestions.map((year) => (
                        <button
                          key={year}
                          type="button"
                          disabled={busy}
                          onClick={() => setForm({ ...form, schoolYear: year })}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition disabled:opacity-50 ${
                            form.schoolYear === year
                              ? "border-blue-700 bg-blue-700 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800"
                          }`}
                        >
                          {year}
                        </button>
                      ))}
                    </div>
                  </div>
                </SettingsFieldRow>

                <SettingsFieldRow
                  label="Active Semester"
                  labelId="academic-semester-label"
                  description="Current term applied to submissions and timelines."
                >
                  <Select
                    value={form.semester}
                    onValueChange={(nextValue) => setForm({ ...form, semester: nextValue })}
                  >
                    <SelectTrigger
                      id="academic-semester"
                      aria-labelledby="academic-semester-label"
                      disabled={busy}
                    >
                      <SelectValue placeholder="Active Semester" />
                    </SelectTrigger>
                    <SelectContent>
                      {["1st Semester", "2nd Semester", "Summer"].map((semester) => (
                        <SelectItem key={semester} value={semester}>
                          {semester}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingsFieldRow>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Submission Period"
              description="Set the default submission window used by the active academic term."
              className={busy ? "opacity-95" : undefined}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <SettingsFieldRow
                  label="Period Start"
                  htmlFor="academic-period-start"
                  description="Opening date for the active submission cycle."
                >
                  <Input
                    id="academic-period-start"
                    disabled={busy}
                    type="date"
                    value={form.periodStart}
                    onChange={(event) => setForm({ ...form, periodStart: event.target.value })}
                  />
                </SettingsFieldRow>

                <SettingsFieldRow
                  label="Period End"
                  htmlFor="academic-period-end"
                  description="Closing date for the active submission cycle."
                >
                  <Input
                    id="academic-period-end"
                    disabled={busy}
                    type="date"
                    value={form.periodEnd}
                    onChange={(event) => setForm({ ...form, periodEnd: event.target.value })}
                  />
                </SettingsFieldRow>
              </div>
            </SettingsSection>

            <SettingsSection
              title="Late Submission Policy"
              description="Define how long submissions stay eligible and how much score is deducted."
              className={busy ? "opacity-95" : undefined}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <SettingsFieldRow
                  label="Grace Period"
                  labelId="academic-late-policy-label"
                  description="Allowed window after the due date before submissions are fully blocked."
                >
                  <Select
                    value={form.latePolicy}
                    onValueChange={(nextValue) => setForm({ ...form, latePolicy: nextValue })}
                  >
                    <SelectTrigger
                      id="academic-late-policy"
                      aria-labelledby="academic-late-policy-label"
                      disabled={busy}
                    >
                      <SelectValue placeholder="Grace Period" />
                    </SelectTrigger>
                    <SelectContent>
                      {["None", "12h", "24h", "48h", "1 week"].map((policy) => (
                        <SelectItem key={policy} value={policy}>
                          {policy}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingsFieldRow>

                <SettingsFieldRow
                  label="Point Deduction (%)"
                  htmlFor="academic-late-deduction"
                  description="Score reduction applied when work is submitted during the late window."
                >
                  <Input
                    id="academic-late-deduction"
                    disabled={busy}
                    type="number"
                    min="0"
                    max="100"
                    value={form.lateDeduction}
                    onChange={(event) => setForm({ ...form, lateDeduction: event.target.value })}
                  />
                </SettingsFieldRow>
              </div>

              <SettingsFieldRow
                label="Allowed Upload Types"
                description="Current file types accepted across academic submission flows."
              >
                <div className="flex flex-wrap gap-2">
                  {form.allowedTypes.map((type) => (
                    <span
                      key={type}
                      className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {type}
                    </span>
                  ))}
                </div>
              </SettingsFieldRow>
            </SettingsSection>
          </div>
        </form>
      )}

      <StickySaveBar
        open={!initialLoading && (isDirty || saveState.saving)}
        saving={saveState.saving}
        saveLabel="Save Settings"
        resetLabel="Reset changes"
        title="Unsaved academic settings"
        description={
          saveState.saving
            ? "Saving the current academic configuration."
            : "Review your academic-term updates, then save them when you're ready."
        }
        onSave={() => {
          void handleSave();
        }}
        onReset={resetForm}
      />
    </SettingsShell>
  );
}
