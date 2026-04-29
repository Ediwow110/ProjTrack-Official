import { useMemo } from "react";
import { useNavigate } from "react-router";
import {
  BookOpen,
  ChevronRight,
  ClipboardList,
  Sparkles,
  Users,
} from "lucide-react";
import {
  PortalEmptyState,
  PortalHero,
  PortalPage,
} from "../../components/portal/PortalPage";
import { teacherCatalogService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";

export default function TeacherSubjects() {
  const navigate = useNavigate();
  const { data, loading } = useAsyncData(() => teacherCatalogService.getSubjects(), []);
  const filtered = useMemo(() => data ?? [], [data]);

  const totalStudents = filtered.reduce(
    (sum, subject) => sum + Number(subject.students || 0),
    0,
  );
  const totalPending = filtered.reduce(
    (sum, subject) => sum + Number(subject.pending || 0),
    0,
  );
  const totalActivities = filtered.reduce(
    (sum, subject) => sum + Number(subject.activities || 0),
    0,
  );

  const openSubject = (subjectId: string | number) => {
    navigate(
      `/teacher/subjects/${subjectId}?back=${encodeURIComponent("/teacher/subjects")}`,
    );
  };

  return (
    <PortalPage className="space-y-6">
      <PortalHero
        tone="teal"
        eyebrow="Teaching Workspaces"
        title="My Subjects"
        description="Manage every subject space from one place, keep activity counts visible, and jump straight into the section that needs attention."
        icon={BookOpen}
        meta={[
          { label: "Portal", value: "Teacher workspace" },
          { label: "View", value: "Active classes" },
          { label: "Focus", value: "Current subjects" },
        ]}
        stats={[
          {
            label: "Subjects",
            value: String(filtered.length),
            hint: "Assigned subject workspaces in your current view.",
          },
          {
            label: "Students",
            value: String(totalStudents),
            hint: "Combined active learners across visible subjects.",
          },
          {
            label: "Activities",
            value: String(totalActivities),
            hint: "Published activity count across your classes.",
          },
          {
            label: "Pending",
            value: String(totalPending),
            hint: "Submissions waiting for review in these subjects.",
          },
        ]}
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-[280px] animate-pulse rounded-[28px] border border-white/70 bg-white/85 dark:bg-slate-900/85"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <PortalEmptyState
          title="No subject workspaces assigned yet"
          description="Your teaching spaces will appear here once subjects are assigned to your account."
          icon={Sparkles}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {filtered.map((subject, index) => (
            <div
              key={`${subject.id || subject.code}-${subject.section}-${index}`}
              onClick={() => openSubject(subject.id || index + 1)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openSubject(subject.id || index + 1);
                }
              }}
              role="link"
              tabIndex={0}
              aria-label={`Open subject ${subject.code}`}
              className="group relative overflow-hidden rounded-[30px] border border-white/70 bg-white/88 dark:bg-slate-900/85 p-6 shadow-[0_24px_70px_-44px_rgba(15,23,42,0.42)] transition duration-200 hover:-translate-y-1 hover:border-teal-200 hover:shadow-[0_30px_75px_-40px_rgba(13,148,136,0.4)]"
            >
              <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.18),transparent_65%)]" />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-teal-100 text-teal-700 dark:text-teal-300 shadow-inner shadow-white">
                      <BookOpen size={22} strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0">
                      <span className="rounded-full bg-teal-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">
                        {subject.code}
                      </span>
                      <p className="mt-3 font-display text-2xl font-semibold tracking-[-0.04em] text-slate-900 dark:text-slate-100">
                        {subject.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subject.section}</p>
                    </div>
                  </div>
                  <div className="mt-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 p-2 text-slate-400 dark:text-slate-300 transition group-hover:bg-teal-100 group-hover:text-teal-700">
                    <ChevronRight size={16} />
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/85 dark:bg-slate-800/70 px-4 py-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-300">
                      <Users size={14} />
                      Students
                    </div>
                    <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-900 dark:text-slate-100">
                      {subject.students}
                    </p>
                  </div>

                  <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/85 dark:bg-slate-800/70 px-4 py-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-300">
                      <BookOpen size={14} />
                      Activities
                    </div>
                    <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-900 dark:text-slate-100">
                      {subject.activities}
                    </p>
                  </div>

                  <div
                    className={`rounded-[22px] border px-4 py-4 ${
                      subject.pending > 5
                        ? "border-amber-200 dark:border-amber-500/30 bg-amber-50/85"
                        : "border-slate-200/80 bg-slate-50/85 dark:bg-slate-800/70"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-300">
                      <ClipboardList size={14} />
                      Pending
                    </div>
                    <p
                      className={`mt-3 text-2xl font-semibold tracking-[-0.04em] ${
                        subject.pending > 5 ? "text-amber-700 dark:text-amber-300" : "text-slate-900 dark:text-slate-100"
                      }`}
                    >
                      {subject.pending}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PortalPage>
  );
}
