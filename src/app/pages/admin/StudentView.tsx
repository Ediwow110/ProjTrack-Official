import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ChevronLeft, PencilLine, RefreshCcw, ShieldOff } from "lucide-react";
import { AppModal } from "../../components/ui/app-modal";
import { BootstrapIcon } from "../../components/ui/bootstrap-icon";
import { StatusChip } from "../../components/ui/StatusChip";
import {
  getCourseOptions,
  getSectionOptions,
  getYearLevelOptions,
} from "../../lib/academicStructure";
import { adminCatalogService, adminDetailService, adminService } from "../../lib/api/services";
import { assertConfirmedMailJob } from "../../lib/mailActionSafety";
import type {
  AdminAcademicYearRecord,
  AdminSectionRecord,
  AdminStudentUpsertInput,
  AdminStudentViewResponse,
} from "../../lib/api/contracts";

const modalFieldClassName =
  "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-700/10 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-400/20";

export default function AdminStudentView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [data, setData] = useState<AdminStudentViewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [sections, setSections] = useState<AdminSectionRecord[]>([]);
  const [academicYears, setAcademicYears] = useState<AdminAcademicYearRecord[]>([]);
  const [sectionsError, setSectionsError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AdminStudentUpsertInput | null>(null);
  const [actionState, setActionState] = useState<{ busy: boolean; error: string | null; note: string | null }>({
    busy: false,
    error: null,
    note: null,
  });

  const loadRecord = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    setActionState((current) => ({ ...current, error: null }));
    return adminDetailService
      .getStudentView(String(id ?? ""))
      .then(setData)
      .catch(() => setError("Unable to load student record."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setActionState({ busy: false, error: null, note: null });
    loadRecord();
  }, [id]);

  useEffect(() => {
    let active = true;
    Promise.all([
      adminCatalogService.getSections(),
      adminCatalogService.getAcademicYears(),
    ]).then(([rows, years]) => {
      if (!active) return;
      setSections(rows);
      setAcademicYears(years);
      setSectionsError(null);
    }).catch((sectionsLoadError) => {
      if (!active) return;
      setSectionsError(
        sectionsLoadError instanceof Error
          ? sectionsLoadError.message
          : "Unable to load academic structure for this student form.",
      );
    });
    return () => {
      active = false;
    };
  }, []);

  const editSectionRecord =
    editForm
      ? sections.find((section) => section.id === editForm.section) ?? null
      : null;
  const editAcademicYearId =
    editForm?.academicYearId ||
    editSectionRecord?.academicYearId ||
    academicYears.find((year) => String(year.status).toLowerCase() === "active")?.id ||
    "";
  const editCourseOptions = getCourseOptions(sections, editAcademicYearId);
  const editYearLevelOptions = getYearLevelOptions(sections, {
    academicYearId: editAcademicYearId,
    course: editForm?.course ?? "",
  });
  const editYearLevelLabel =
    editYearLevelOptions.find((option) => option.id === editForm?.yearLevelId)?.label ??
    editForm?.yearLevelName ??
    editForm?.yearLevel ??
    "";
  const editSectionOptions = getSectionOptions(sections, {
    academicYearId: editAcademicYearId,
    course: editForm?.course ?? "",
    yearLevelId: editForm?.yearLevelId,
    yearLevelName: editYearLevelLabel,
  }) as AdminSectionRecord[];

  const handleSendSetupLink = async () => {
    if (!id || actionState.busy) return;
    setActionState({ busy: true, error: null, note: null });
    try {
      const result = await adminService.sendStudentResetLink(id);
      const mailJobId = assertConfirmedMailJob(result, "student setup/reset email");
      await loadRecord();
      setActionState({ busy: false, error: null, note: `Student setup/reset MailJob queued (${mailJobId}). Open Mail Jobs to watch delivery.` });
    } catch (err) {
      setActionState({
        busy: false,
        error: err instanceof Error ? err.message : "Unable to send setup link.",
        note: null,
      });
    }
  };

  const handleDeactivate = async () => {
    if (!id || actionState.busy) return;
    setActionState({ busy: true, error: null, note: null });
    try {
      await adminService.deactivateStudent(id);
      await loadRecord();
      setActionState({ busy: false, error: null, note: "Student account deactivated." });
    } catch (err) {
      setActionState({
        busy: false,
        error: err instanceof Error ? err.message : "Unable to deactivate student.",
        note: null,
      });
    }
  };

  const handleOpenEdit = () => {
    if (!data) return;
    const selectedSection = sections.find((section) => section.id === data.form.section) ?? null;
    setEditForm({
      ...data.form,
      academicYearId: data.form.academicYearId || selectedSection?.academicYearId || "",
      academicYear:
        data.form.academicYear ||
        selectedSection?.academicYear ||
        selectedSection?.ay ||
        "",
      course: data.form.course || selectedSection?.program || "",
      yearLevelId: data.form.yearLevelId || selectedSection?.yearLevelId || "",
      yearLevelName:
        data.form.yearLevelName ||
        selectedSection?.yearLevelName ||
        selectedSection?.yearLevelLabel ||
        selectedSection?.yearLevel ||
        "",
      yearLevel:
        data.form.yearLevel ||
        selectedSection?.yearLevelName ||
        selectedSection?.yearLevelLabel ||
        selectedSection?.yearLevel ||
        "",
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!id || !editForm) return;
    setActionState({ busy: true, error: null, note: null });
    try {
      await adminService.updateStudent(id, editForm);
      await loadRecord();
      setEditOpen(false);
      setActionState({ busy: false, error: null, note: "Student details updated." });
    } catch (editError) {
      setActionState({
        busy: false,
        error: editError instanceof Error ? editError.message : "Unable to update student.",
        note: null,
      });
    }
  };

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300">{error}</div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin/students")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70">
            <ChevronLeft size={14} /> Back to Students
          </button>
          <button disabled={loading || actionState.busy} onClick={loadRecord} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50">
            <RefreshCcw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return <div className="p-6 max-w-7xl mx-auto text-sm text-slate-400 dark:text-slate-300">Loading student record…</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {actionState.error && <div className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"><BootstrapIcon name="x-circle-fill" tone="danger" className="mt-0.5 shrink-0" /> <span>{actionState.error}</span></div>}
      {sectionsError && <div className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"><BootstrapIcon name="x-circle-fill" tone="danger" className="mt-0.5 shrink-0" /> <span>{sectionsError}</span></div>}
      {actionState.note && <div className="flex items-start gap-2 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"><BootstrapIcon name="check-circle-fill" tone="success" className="mt-0.5 shrink-0" /> <span>{actionState.note}</span></div>}
      {actionState.busy && <div className="text-xs text-slate-400 dark:text-slate-300">Updating student account state…</div>}
      {loading && data && <div className="text-xs text-slate-400 dark:text-slate-300">Refreshing student record…</div>}

      <div className="flex items-center justify-between gap-4">
        <button onClick={() => navigate("/admin/students")} className="flex items-center gap-1.5 text-slate-400 dark:text-slate-300 hover:text-slate-700 text-sm">
          <ChevronLeft size={15} /> Back to Students
        </button>
        <button disabled={loading || actionState.busy} onClick={loadRecord} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50">
          <RefreshCcw size={14} /> Refresh
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-blue-800 flex items-center justify-center text-white text-lg font-bold shrink-0">{data.initials}</div>
            <div>
              <h1 className="text-slate-900 dark:text-slate-100 font-bold text-xl">{data.name}</h1>
              <p className="text-slate-400 dark:text-slate-300 text-sm">{data.subtitle}</p>
              <div className="flex gap-2 mt-2">
                <StatusChip status={data.status} />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={loadRecord} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/70">
              <RefreshCcw size={13} /> Refresh
            </button>
            <button disabled={actionState.busy} onClick={handleOpenEdit} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-semibold hover:bg-blue-50 disabled:opacity-50">
              <PencilLine size={13} /> Edit
            </button>
            <button
              disabled={
                actionState.busy ||
                data.status === "Inactive" ||
                data.status === "Restricted" ||
                data.status === "Disabled" ||
                data.status === "Archived" ||
                data.status === "Graduated"
              }
              onClick={handleSendSetupLink}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-50 disabled:opacity-50"
            >
              <ShieldOff size={13} /> {data.status === "Pending Activation" ? "Send Activation Link" : data.status === "Pending Setup" ? "Send Setup Link" : "Send Reset Link"}
            </button>
            <button disabled={actionState.busy} onClick={handleDeactivate} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-50">
              <ShieldOff size={13} /> Deactivate
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-5">
            <p className="text-slate-600 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">Account Details</p>
            <div className="space-y-2">
              {data.accountDetails.map((field) => (
                <div key={field.label} className="flex items-center justify-between py-1.5 border-b border-slate-50 dark:border-slate-700/60 last:border-0">
                  <span className="text-slate-400 dark:text-slate-300 text-xs">{field.label}</span>
                  <span className="text-slate-700 dark:text-slate-200 text-xs font-semibold">{field.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-5">
            <p className="text-slate-600 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">Assigned Subjects</p>
            <div className="space-y-2">
              {data.assignedSubjects.map((subject) => (
                <div key={subject} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-300 text-xs">{subject}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {data.stats.map((stat) => (
              <div key={stat.l} className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-4">
                <p className="text-slate-400 dark:text-slate-300 text-xs">{stat.l}</p>
                <p className="text-slate-900 dark:text-slate-100 font-bold text-xl mt-1">{stat.v}</p>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-900/85 rounded-xl border border-slate-100 dark:border-slate-700/70 shadow-sm p-5">
            <p className="text-slate-800 dark:text-slate-100 text-sm font-bold mb-3">Recent Submissions</p>
            <div className="space-y-2">
              {data.recentSubmissions.map((submission) => (
                <div key={submission.title} className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800/70 px-3 py-2.5">
                  <div>
                    <p className="text-slate-700 dark:text-slate-200 text-xs font-semibold">{submission.title}</p>
                    <p className="text-slate-400 dark:text-slate-300 text-[10px]">{submission.subject} · {submission.date}</p>
                  </div>
                  <StatusChip status={submission.status} size="xs" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AppModal
        open={editOpen && Boolean(editForm)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setEditOpen(false);
          }
        }}
        title="Edit Student"
        description="Update student identity and section details."
        size="xl"
        footer={
          <>
            <button
              onClick={() => setEditOpen(false)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/85 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800/70 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              disabled={actionState.busy}
              onClick={handleSaveEdit}
              className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:opacity-50"
            >
              Save Changes
            </button>
          </>
        }
      >
        {editForm ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="First Name" value={editForm.firstName} onChange={(value) => setEditForm((current) => current ? { ...current, firstName: value } : current)} />
            <Field label="M.I." value={editForm.middleInitial ?? ""} onChange={(value) => setEditForm((current) => current ? { ...current, middleInitial: value } : current)} />
            <Field label="Last Name" value={editForm.lastName} onChange={(value) => setEditForm((current) => current ? { ...current, lastName: value } : current)} />
            <Field label="Email" type="email" value={editForm.email} onChange={(value) => setEditForm((current) => current ? { ...current, email: value } : current)} />
            <Field label="Student Number / Student ID" value={editForm.studentNumber} onChange={(value) => setEditForm((current) => current ? { ...current, studentNumber: value } : current)} />
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300">Academic Year</label>
              <select
                value={editAcademicYearId}
                onChange={(event) =>
                  setEditForm((current) => {
                    if (!current) return current;
                    const selectedAcademicYear = academicYears.find(
                      (year) => year.id === event.target.value,
                    );
                    return {
                      ...current,
                      academicYearId: event.target.value,
                      academicYear: selectedAcademicYear?.name ?? "",
                      course: "",
                      yearLevelId: "",
                      yearLevelName: "",
                      yearLevel: "",
                      section: "",
                    };
                  })
                }
                className={modalFieldClassName}
              >
                <option value="">Select academic year</option>
                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300">Course / Program</label>
              <select
                value={editForm.course ?? ""}
                onChange={(event) =>
                  setEditForm((current) =>
                    current
                      ? {
                          ...current,
                          course: event.target.value,
                          yearLevelId: "",
                          yearLevelName: "",
                          yearLevel: "",
                          section: "",
                        }
                      : current,
                  )
                }
                disabled={!editAcademicYearId}
                className={modalFieldClassName}
              >
                <option value="">
                  {editAcademicYearId ? "Select course" : "Select academic year first"}
                </option>
                {editCourseOptions.map((course) => (
                  <option key={course} value={course}>
                    {course}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300">Year Level</label>
              <select
                value={editForm.yearLevelId ?? ""}
                onChange={(event) =>
                  setEditForm((current) => {
                    if (!current) return current;
                    const selectedYearLevel = editYearLevelOptions.find(
                      (option) => option.id === event.target.value,
                    );
                    return {
                      ...current,
                      yearLevelId: event.target.value,
                      yearLevelName: selectedYearLevel?.label ?? "",
                      yearLevel: selectedYearLevel?.label ?? "",
                      section: "",
                    };
                  })
                }
                disabled={!editAcademicYearId || !editForm.course?.trim()}
                className={modalFieldClassName}
              >
                <option value="">
                  {editForm.course?.trim() ? "Select year level" : "Select course first"}
                </option>
                {editYearLevelOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300">Section</label>
              <select
                value={editForm.section}
                onChange={(event) =>
                  setEditForm((current) => {
                    if (!current) return current;
                    const selectedSection = editSectionOptions.find(
                      (section) => section.id === event.target.value,
                    );
                    return {
                      ...current,
                      section: event.target.value,
                      course: selectedSection?.program ?? current.course,
                      academicYearId: selectedSection?.academicYearId ?? current.academicYearId,
                      academicYear:
                        selectedSection?.academicYear ??
                        selectedSection?.ay ??
                        current.academicYear,
                      yearLevelId: selectedSection?.yearLevelId ?? current.yearLevelId,
                      yearLevelName:
                        selectedSection?.yearLevelName ??
                        selectedSection?.yearLevelLabel ??
                        current.yearLevelName,
                      yearLevel:
                        selectedSection?.yearLevelName ??
                        selectedSection?.yearLevelLabel ??
                        selectedSection?.yearLevel ??
                        current.yearLevel,
                    };
                  })
                }
                disabled={!editForm.yearLevelId}
                className={modalFieldClassName}
              >
                <option value="">
                  {editForm.yearLevelId ? "Select section" : "Select year level first"}
                </option>
                {editSectionOptions.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.code} · {section.program} · {section.yearLevelName ?? section.yearLevelLabel ?? section.yearLevel} · {section.academicYear ?? section.ay}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/15 px-4 py-3 text-sm text-blue-800 md:col-span-2 dark:text-blue-100">
              Placement changes follow the same academic hierarchy as manual add, bulk import, and bulk move.
            </div>
          </div>
        ) : null}
      </AppModal>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300">{label}</label>
      <input value={value} type={type} onChange={(event) => onChange(event.target.value)} className={modalFieldClassName} />
    </div>
  );
}
