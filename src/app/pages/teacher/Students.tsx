import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Download, Search, Users } from "lucide-react";

import {
  PortalEmptyState,
  PortalHero,
  PortalPage,
  PortalPanel,
} from "../../components/portal/PortalPage";
import { teacherCatalogService } from "../../lib/api/services";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import type { SectionMasterListResponse } from "../../lib/api/contracts";

export default function TeacherStudents() {
  const [search, setSearch] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const {
    data: sections,
    loading,
    error,
    reload,
  } = useAsyncData(() => teacherCatalogService.getAssignedSections(), []);

  const filteredSections = useMemo(() => {
    const records = sections ?? [];
    const query = search.trim().toLowerCase();
    if (!query) return records;
    return records.filter((section) =>
      [section.code, section.academicYear, section.yearLevel, section.course, section.adviser]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [search, sections]);

  const selectedSection =
    (sections ?? []).find((section) => section.id === selectedSectionId) ?? null;

  const {
    data: masterList,
    loading: masterListLoading,
    error: masterListError,
  } = useAsyncData(
    () =>
      selectedSectionId
        ? teacherCatalogService.getSectionMasterList(selectedSectionId)
        : Promise.resolve(null as SectionMasterListResponse | null),
    [selectedSectionId],
  );

  return (
    <PortalPage className="space-y-6">
      <PortalHero
        tone="teal"
        eyebrow="Master's List"
        title={selectedSection ? selectedSection.code : "Assigned Sections"}
        description={
          selectedSection
            ? "Read-only section roster for your assigned class."
            : "Open an assigned section to view and download its read-only master's list."
        }
        icon={Users}
        meta={[
          { label: "Search", value: search.trim() ? "Filtered" : "All assigned sections" },
          { label: "Roster", value: selectedSection ? "Master list" : "Section cards" },
          { label: "Access", value: "Teacher read-only" },
        ]}
        stats={[
          {
            label: selectedSection ? "Students" : "Sections",
            value: selectedSection
              ? String(masterList?.rows.length ?? 0)
              : String(filteredSections.length),
            hint: selectedSection
              ? "Students in the selected master list."
              : "Assigned sections available to you.",
          },
          {
            label: "Academic Year",
            value: selectedSection ? selectedSection.academicYear : "Assigned",
            hint: selectedSection ? "Current section academic year." : "Sections across your assignments.",
          },
          {
            label: "Year Level",
            value: selectedSection ? selectedSection.yearLevel : "Multiple",
            hint: selectedSection ? "Current section year level." : "Year levels across your assignments.",
          },
          {
            label: "Export",
            value: selectedSection ? ".xlsx" : "Available",
            hint: "Download the same master list you see on screen.",
          },
        ]}
      />

      {selectedSection ? (
        <PortalPanel
          title="Section Master's List"
          description={`${selectedSection.academicYear} / ${selectedSection.yearLevel} / ${selectedSection.course}`}
          contentClassName="space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setSelectedSectionId("")}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft size={14} />
              Back to Sections
            </button>
            <button
              type="button"
              onClick={() => teacherCatalogService.downloadSectionMasterList(selectedSection.id)}
              className="inline-flex items-center gap-2 rounded-full bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-600"
            >
              <Download size={14} />
              Download Master&apos;s List
            </button>
          </div>

          {masterListError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {masterListError}
            </div>
          ) : null}

          {masterListLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-500">
              Loading master list...
            </div>
          ) : !masterList || masterList.rows.length === 0 ? (
            <PortalEmptyState
              title="No students in this section"
              description="This section does not have any students assigned yet."
              icon={Users}
              className="border-slate-200 bg-slate-50/80"
            />
          ) : (
            <div className="overflow-x-auto rounded-[26px] border border-slate-200">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200/70 bg-slate-50/80">
                    {["Student ID", "Last Name", "First Name", "M.I."].map((header) => (
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
                  {masterList.rows.map((student) => (
                    <tr key={`${student.id}-${student.studentId}`} className="bg-white/70">
                      <td className="px-5 py-4 font-mono text-xs text-slate-500">{student.studentId}</td>
                      <td className="px-5 py-4 text-xs font-semibold text-slate-800">{student.lastName}</td>
                      <td className="px-5 py-4 text-xs text-slate-600">{student.firstName}</td>
                      <td className="px-5 py-4 text-xs text-slate-600">{student.middleInitial || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PortalPanel>
      ) : (
        <>
          <PortalPanel
            title="Search Assigned Sections"
            description="Find a section by code, academic year, year level, course, or adviser."
          >
            <label className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-3 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.42)]">
              <Search size={16} className="shrink-0 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search assigned sections..."
                className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </label>
          </PortalPanel>

          <PortalPanel
            title="Assigned Sections"
            description="Open a section to view the read-only master's list and export it to Excel."
            contentClassName="space-y-4"
          >
            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {error}
              </div>
            ) : null}

            {loading && filteredSections.length === 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-44 animate-pulse rounded-[26px] bg-slate-100" />
                ))}
              </div>
            ) : filteredSections.length === 0 ? (
              <PortalEmptyState
                title="No assigned sections found"
                description="Try a broader search or reload your assignments."
                icon={Users}
                className="border-slate-200 bg-slate-50/80"
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredSections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setSelectedSectionId(section.id)}
                    className="rounded-[26px] border border-slate-200 bg-white p-5 text-left shadow-[0_24px_58px_-42px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:border-teal-300 hover:bg-teal-50/35"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-bold text-slate-900">{section.code}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {section.academicYear} / {section.yearLevel}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-slate-400" />
                    </div>
                    <div className="mt-4 space-y-1 text-xs text-slate-500">
                      <p>Course: {section.course}</p>
                      <p>Adviser: {section.adviser || "Unassigned"}</p>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <StatCard label="Students" value={section.students} />
                      <StatCard label="Subjects" value={section.subjects} />
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={reload}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Refresh Sections
              </button>
            </div>
          </PortalPanel>
        </>
      )}
    </PortalPage>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[18px] bg-slate-50 px-3 py-3">
      <p className="text-base font-bold text-slate-900">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
    </div>
  );
}
