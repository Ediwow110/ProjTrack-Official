import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  BookOpen,
  ChevronRight,
  Filter,
  GraduationCap,
  Layers3,
  Sparkles,
} from "lucide-react";
import {
  PortalEmptyState,
  PortalHero,
  PortalPage,
} from "../../components/portal/PortalPage";
import { studentCatalogService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";

const ALL_TERMS = "All Terms";

export default function StudentSubjects() {
  const navigate = useNavigate();
  const [termFilter, setTermFilter] = useState(ALL_TERMS);

  const { data, loading } = useAsyncData(() => studentCatalogService.getSubjects(), []);

  const terms = useMemo(() => {
    const uniqueTerms = new Set(
      (data ?? [])
        .map((subject) => subject.term)
        .filter((term): term is string => Boolean(term)),
    );

    return [ALL_TERMS, ...Array.from(uniqueTerms)];
  }, [data]);

  const filtered = useMemo(() => {
    return (data ?? []).filter((subject) => {
      return termFilter === ALL_TERMS || subject.term === termFilter;
    });
  }, [data, termFilter]);

  const totalActivities = filtered.reduce(
    (sum, subject) => sum + Number(subject.activities || 0),
    0,
  );
  const uniqueTeachers = new Set(filtered.map((subject) => subject.teacher)).size;

  const openSubject = (subjectId: string | number) => {
    navigate(`/student/subjects/${encodeURIComponent(String(subjectId))}`);
  };

  return (
    <PortalPage className="space-y-6">
      <PortalHero
        tone="blue"
        eyebrow="Subject Directory"
        title="My Subjects"
        description="Explore your current learning spaces, keep tabs on activity volume, and jump into the subject that needs attention next."
        icon={BookOpen}
        meta={[
          { label: "Academic Year", value: "2025-2026" },
          { label: "Semester", value: termFilter === ALL_TERMS ? "Current term" : termFilter },
          { label: "View", value: "Subject workspace" },
        ]}
        stats={[
          {
            label: "Enrolled",
            value: String(data?.length ?? 0),
            hint: "Subjects currently assigned to you.",
          },
          {
            label: "Visible",
            value: String(filtered.length),
            hint: "Results after the active filters.",
          },
          {
            label: "Activities",
            value: String(totalActivities),
            hint: "Combined activity count across visible subjects.",
          },
          {
            label: "Teachers",
            value: String(uniqueTeachers),
            hint: "Distinct instructors in this view.",
          },
        ]}
      />

      <div className="flex justify-end">
        <label className="flex min-w-[240px] items-center gap-3 rounded-[24px] border border-white/70 bg-white/82 px-4 py-3 text-slate-500 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.42)]">
          <Filter size={16} />
          <span className="text-sm font-semibold text-slate-700">Term</span>
          <select
            value={termFilter}
            onChange={(event) => setTermFilter(event.target.value)}
            className="ml-auto bg-transparent text-sm font-medium text-slate-700 outline-none"
            aria-label="Filter subjects by term"
          >
            {terms.map((term) => (
              <option key={term} value={term}>
                {term}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-[270px] animate-pulse rounded-[28px] border border-white/70 bg-white/85"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <PortalEmptyState
          title="No subjects matched this view"
          description="Switch back to all terms to see the rest of your enrolled classes."
          icon={Sparkles}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {filtered.map((subject, index) => (
            <div
              key={`${subject.code}-${index}`}
              onClick={() => openSubject(subject.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openSubject(subject.id);
                }
              }}
              role="link"
              tabIndex={0}
              aria-label={`Open subject ${subject.code}`}
              className="group relative overflow-hidden rounded-[30px] border border-white/70 bg-white/88 p-6 shadow-[0_24px_70px_-44px_rgba(15,23,42,0.42)] transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_30px_75px_-40px_rgba(37,99,235,0.45)]"
            >
              <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_65%)]" />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-blue-100 text-blue-700 shadow-inner shadow-white">
                      <BookOpen size={22} strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">
                          {subject.code}
                        </span>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          {subject.status}
                        </span>
                      </div>
                      <p className="mt-3 font-display text-2xl font-semibold tracking-[-0.04em] text-slate-900">
                        {subject.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">{subject.term}</p>
                    </div>
                  </div>
                  <div className="mt-1 rounded-2xl bg-slate-100 p-2 text-slate-400 transition group-hover:bg-blue-100 group-hover:text-blue-700">
                    <ChevronRight size={16} />
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/85 px-4 py-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      <GraduationCap size={14} />
                      Teacher
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-800">
                      {subject.teacher}
                    </p>
                  </div>

                  <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/85 px-4 py-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      <Layers3 size={14} />
                      Section
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-800">
                      {subject.section}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between rounded-[22px] border border-blue-100 bg-blue-50/75 px-4 py-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-500">
                      Activity load
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-900">
                      {subject.activities}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-blue-700">Open workspace</p>
                    <p className="mt-1 text-xs text-slate-500">
                      View overview, tasks, and your group.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/70 bg-white/72 px-4 py-3 text-sm text-slate-500 shadow-[0_18px_45px_-38px_rgba(15,23,42,0.45)]">
        <span>
          Showing {filtered.length} enrolled subject{filtered.length === 1 ? "" : "s"}.
        </span>
        <span className="font-medium text-slate-700">
          {termFilter === ALL_TERMS ? "All terms" : termFilter}
        </span>
      </div>
    </PortalPage>
  );
}
