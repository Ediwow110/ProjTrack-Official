import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  BookOpen,
  Plus,
  RefreshCcw,
  Search,
  Users,
} from "lucide-react";
import { BoxArrowUpRight } from "react-bootstrap-icons";
import { StatusChip } from "../../components/ui/StatusChip";
import { AppModal } from "../../components/ui/app-modal";
import { Button } from "../../components/ui/button";
import {
  PortalEmptyState,
  PortalHero,
  PortalPage,
  PortalPanel,
} from "../../components/portal/PortalPage";
import { adminCatalogService, adminService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import type {
  AdminSectionRecord,
  AdminSubjectUpsertInput,
  AdminTeacherRecord,
} from "../../lib/api/contracts";

const initialForm: AdminSubjectUpsertInput = {
  code: "",
  name: "",
  teacherId: "",
  status: "Active",
  groupEnabled: true,
  allowLateSubmission: true,
  sectionCodes: [],
};

export default function AdminSubjects() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<AdminSubjectUpsertInput>(initialForm);
  const [teachers, setTeachers] = useState<AdminTeacherRecord[]>([]);
  const [sections, setSections] = useState<AdminSectionRecord[]>([]);
  const [submitState, setSubmitState] = useState<{
    saving: boolean;
    error: string | null;
  }>({ saving: false, error: null });
  const { data, loading, error, reload } = useAsyncData(
    () => adminService.getSubjects({ search }),
    [search],
  );
  const subjects = data ?? [];
  const resultCount = subjects.length;
  const totalActivities = subjects.reduce(
    (sum, subject) => sum + Number(subject.activities || 0),
    0,
  );
  const totalStudents = subjects.reduce(
    (sum, subject) => sum + Number(subject.students || 0),
    0,
  );

  const openSubject = (subjectId: string) => {
    if (loading) return;
    navigate(`/admin/subjects/${encodeURIComponent(subjectId)}`);
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      adminCatalogService.getTeachers(),
      adminCatalogService.getSections(),
    ])
      .then(([teacherRows, sectionRows]) => {
        if (!active) return;
        setTeachers(teacherRows);
        setSections(sectionRows);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const openCreateModal = () => {
    setForm(initialForm);
    setSubmitState({ saving: false, error: null });
    setCreateOpen(true);
  };

  const handleCreateSubject = async () => {
    setSubmitState({ saving: true, error: null });
    try {
      await adminService.createSubject(form);
      await reload();
      setCreateOpen(false);
      setForm(initialForm);
      setSubmitState({ saving: false, error: null });
    } catch (createError) {
      setSubmitState({
        saving: false,
        error:
          createError instanceof Error
            ? createError.message
            : "Unable to create subject.",
      });
    }
  };

  return (
    <PortalPage className="space-y-6">
      <PortalHero
        tone="slate"
        eyebrow="Subject Administration"
        title="Subjects"
        description="Manage the academic catalog with clearer visibility over assignments, teacher ownership, section mapping, and learner volume."
        icon={BookOpen}
        meta={[
          { label: "Search", value: search.trim() ? "Filtered" : "All subjects" },
          { label: "Portal", value: "Admin workspace" },
          { label: "Catalog", value: "Live" },
        ]}
        stats={[
          {
            label: "Subjects",
            value: String(resultCount),
            hint: "Current records visible in this view.",
          },
          {
            label: "Activities",
            value: String(totalActivities),
            hint: "Combined activity count across visible subjects.",
          },
          {
            label: "Students",
            value: String(totalStudents),
            hint: "Learners tied to the filtered subject list.",
          },
          {
            label: "Teachers",
            value: String(new Set(subjects.map((subject) => subject.teacher)).size),
            hint: "Distinct assigned instructors in this view.",
          },
        ]}
        actions={
          <>
            <button
              disabled={loading}
              onClick={reload}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-lg shadow-slate-950/10 transition hover:bg-slate-100 disabled:opacity-60"
            >
              <RefreshCcw size={16} />
              Refresh
            </button>
            <button
              disabled={loading}
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/16 disabled:opacity-60"
            >
              <Plus size={16} />
              Add Subject
            </button>
          </>
        }
      />

      {error ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <PortalPanel
        title="Search and review subject records"
        description="Open a subject to inspect ownership, sections, activities, and learner counts."
      >
        <label className="flex max-w-xl items-center gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-3 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.42)]">
          <Search size={16} className="shrink-0 text-slate-400" />
          <input
            disabled={loading}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by code, title, teacher, or section..."
            aria-label="Search subjects"
            className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 disabled:opacity-50"
          />
        </label>
      </PortalPanel>

      <PortalPanel
        title="Subject Catalog"
        description={`${resultCount} subject${resultCount === 1 ? "" : "s"} in the current view.`}
        contentClassName="px-0 py-0"
      >
        {loading && subjects.length === 0 ? (
          <div className="space-y-3 px-5 py-5 sm:px-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-[22px] bg-slate-100"
              />
            ))}
          </div>
        ) : subjects.length === 0 ? (
          <div className="px-5 py-5 sm:px-6">
            <PortalEmptyState
              title="No subjects matched"
              description="Broaden the current search to see the rest of the catalog."
              icon={BookOpen}
              className="border-slate-200 bg-slate-50/80"
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-slate-200/70 bg-slate-50/80">
                  {[
                    "Code",
                    "Subject Name",
                    "Teacher",
                    "Sections",
                    "Activities",
                    "Students",
                    "Status",
                    "Actions",
                  ].map((header) => (
                    <th
                      key={header}
                      className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjects.map((subject) => (
                  <tr
                    key={subject.code}
                    className={`${loading ? "opacity-80" : "cursor-pointer bg-white/70 transition hover:bg-slate-50"}`}
                    onClick={() => openSubject(String(subject.id || subject.code))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openSubject(String(subject.id || subject.code));
                      }
                    }}
                    role="button"
                    tabIndex={loading ? -1 : 0}
                    aria-label={`Open subject ${subject.code}`}
                  >
                    <td className="px-5 py-4 text-xs font-bold text-slate-700">
                      {subject.code}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-xs font-semibold text-slate-800">
                        {subject.name}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600">
                      {subject.teacher}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {subject.sections.join(", ") || "—"}
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-800">
                      {subject.activities}
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-800">
                      <div className="inline-flex items-center gap-1.5">
                        <Users size={13} className="text-slate-400" />
                        {subject.students}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusChip status={subject.status} size="xs" />
                    </td>
                    <td className="px-5 py-4">
                      <button
                        disabled={loading}
                        onClick={(event) => {
                          event.stopPropagation();
                          openSubject(String(subject.id || subject.code));
                        }}
                        aria-label={`Open ${subject.name}`}
                        title="Open subject"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 bg-white/90 text-blue-700 transition hover:bg-slate-100 hover:text-blue-800 disabled:opacity-50 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-blue-300 dark:hover:bg-slate-800 dark:hover:text-blue-200"
                      >
                        <BoxArrowUpRight size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PortalPanel>

      <AppModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Add Subject"
        description="Create a subject record, assign a teacher, and map the correct sections in one flow."
        size="xl"
        bodyClassName="space-y-6"
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={submitState.saving || !form.code.trim() || !form.name.trim()}
              onClick={handleCreateSubject}
              className="bg-slate-900 text-white hover:bg-slate-950 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
            >
              {submitState.saving ? "Creating..." : "Create Subject"}
            </Button>
          </>
        )}
      >
        <div className="rounded-[24px] border border-slate-200/70 bg-slate-50/85 px-4 py-4 text-sm leading-6 text-slate-600 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-300">
          Group submissions and late submissions are now enabled automatically for teacher-managed subjects. Teachers can still control those rules inside their subject workspace.
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Field
            label="Subject Code"
            value={form.code}
            onChange={(value) => setForm((current) => ({ ...current, code: value }))}
          />
          <Field
            label="Subject Name"
            value={form.name}
            onChange={(value) => setForm((current) => ({ ...current, name: value }))}
          />

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Teacher
            </label>
            <select
              value={form.teacherId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  teacherId: event.target.value,
                }))
              }
              className="h-12 w-full rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
            >
              <option value="">Unassigned</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Status
            </label>
            <select
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({ ...current, status: event.target.value }))
              }
              className="h-12 w-full rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
            >
              <option value="Active">Active</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/85 p-5 lg:col-span-2 dark:border-slate-700/60 dark:bg-slate-900/70">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Section Mapping
            </p>
            <select
              value={form.sectionCodes[0] ?? ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  sectionCodes: event.target.value ? [event.target.value] : [],
                }))
              }
              className="mt-4 h-12 w-full rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
            >
              <option value="">Select section</option>
              {sections.map((section) => (
                <option key={section.code} value={section.code}>
                  {section.code}
                </option>
              ))}
            </select>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              The selected section will have its current student roster enrolled into this subject.
            </p>
          </div>

          {submitState.error ? (
            <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 lg:col-span-2 dark:border-rose-500/35 dark:bg-rose-500/12 dark:text-rose-200">
              {submitState.error}
            </div>
          ) : null}
        </div>
      </AppModal>
    </PortalPage>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
      />
    </div>
  );
}
