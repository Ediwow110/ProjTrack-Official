from pathlib import Path
import re

root = Path('/mnt/data/phase2')
contracts = root/'src/app/lib/api/contracts.ts'
services = root/'src/app/lib/api/services.ts'
student_subject = root/'src/app/pages/student/SubjectDetails.tsx'
teacher_review = root/'src/app/pages/teacher/SubmissionReview.tsx'
admin_groups = root/'src/app/pages/admin/Groups.tsx'

# Update contracts
text = contracts.read_text()
text = text.replace(
"""export interface TeacherSubmissionReviewResponse {
  title: string;
  subject: string;
  section: string;
  due: string;
  student: string;
  studentId: string;
  initials: string;
  description: string;
  files: TeacherSubmissionFileItem[];
  timeline: TeacherSubmissionTimelineItem[];
  status: string;
  activity: string;
  submittedAt: string;
  late: string;
  type?: \"Individual\" | \"Group\";
  groupName?: string;
  submittedBy?: string;
  groupMembers?: string[];
}
""",
"""export interface TeacherSubmissionReviewResponse {
  title: string;
  subject: string;
  section: string;
  due: string;
  student: string;
  studentId: string;
  initials: string;
  description: string;
  files: TeacherSubmissionFileItem[];
  timeline: TeacherSubmissionTimelineItem[];
  status: string;
  activity: string;
  submittedAt: string;
  late: string;
  type?: \"Individual\" | \"Group\";
  groupName?: string;
  submittedBy?: string;
  groupMembers?: string[];
  allowedActions?: {
    canMarkReviewed: boolean;
    canGrade: boolean;
    canRequestRevision: boolean;
    canReopen: boolean;
    final: boolean;
    reason?: string;
  };
}
""")
text = text.replace(
"""export interface AdminGroupRecord {
  id: string;
  name: string;
  subject: string;
  section: string;
  leader: string;
  members: string[];
  status: string;
  mode: string;
  code: string;
}
""",
"""export interface AdminGroupRecord {
  id: string;
  name: string;
  subject: string;
  section: string;
  leader: string;
  members: string[];
  status: string;
  mode: string;
  code: string;
  leaderId?: string;
  memberDetails?: Array<{ id: string; name: string; isLeader: boolean }>;
}
""")
text = text.replace(
"""export interface StudentSubjectResponse {
  code: string;
  name: string;
  teacher: string;
  section: string;
  term: string;
  activitiesCount: number;
  overview: Array<{ label: string; value: string }>;
  activities: StudentSubjectActivityItem[];
  group: {
    code: string;
    leader: string;
    membersCount: string;
    locked: string;
    status: string;
  };
  members: StudentSubjectMemberItem[];
  recentActivity: string[];
}
""",
"""export interface StudentSubjectResponse {
  code: string;
  name: string;
  teacher: string;
  section: string;
  term: string;
  activitiesCount: number;
  overview: Array<{ label: string; value: string }>;
  activities: StudentSubjectActivityItem[];
  group: {
    id?: string;
    code: string;
    leader: string;
    membersCount: string;
    locked: string;
    status: string;
  } | null;
  members: StudentSubjectMemberItem[];
  recentActivity: string[];
}
""")
contracts.write_text(text)

# Update services imports line for StudentSubjectResponse unaffected
st = services.read_text()
insert_helpers_after = "function buildStoredFileDownloadUrl(relativePath?: string) {\n  if (!relativePath) return undefined;\n  const cleaned = relativePath.replace(/^\\/+/, \"\");\n  return buildBackendFileUrl(`/files/download/${cleaned}`);\n}\n"
helpers = """

function normalizeSubmissionStatus(status?: string | null) {
  const normalized = String(status || 'DRAFT').trim().replace(/\s+/g, '_').toUpperCase();
  const canonical = normalized === 'PENDING_REVIEW' ? 'SUBMITTED' : normalized;
  return canonical;
}

function formatSubmissionStatus(status?: string | null) {
  return normalizeSubmissionStatus(status).replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function getReviewActionState(status?: string | null) {
  const canonical = normalizeSubmissionStatus(status);
  const final = canonical === 'GRADED' || canonical === 'REVIEWED';
  return {
    canonical,
    canMarkReviewed: canonical === 'SUBMITTED' || canonical === 'LATE' || canonical === 'REOPENED' || canonical === 'NEEDS_REVISION',
    canGrade: canonical === 'SUBMITTED' || canonical === 'LATE' || canonical === 'REOPENED' || canonical === 'NEEDS_REVISION' || canonical === 'REVIEWED',
    canRequestRevision: canonical === 'SUBMITTED' || canonical === 'LATE' || canonical === 'REOPENED' || canonical === 'REVIEWED',
    canReopen: canonical === 'GRADED' || canonical === 'REVIEWED' || canonical === 'NEEDS_REVISION',
    final,
    reason: final ? 'Finalized submissions must be reopened before further changes.' : undefined,
  };
}

function buildGroupMemberRows(group: any) {
  const raw = Array.isArray(group?.members) ? group.members : Array.isArray(group?.memberUserIds) ? group.memberUserIds.map((id: string) => ({ id, name: id })) : [];
  return raw.map((member: any, index: number) => ({
    id: String(member?.id || member?.userId || member?.name || member),
    name: String(member?.name || member),
    isLeader: Boolean(member?.isLeader) || index === 0,
  }));
}
"""
if helpers not in st:
    st = st.replace(insert_helpers_after, insert_helpers_after + helpers)

# Replace studentSubjectService.getSubject block
pattern = re.compile(r"export const studentSubjectService = \{.*?\n\};\n\n\nexport const teacherDashboardService = \{", re.S)
replacement = """export const studentSubjectService = {
  async getSubject(id: string): Promise<StudentSubjectResponse> {
    if (!id) {
      throw new Error("Subject id is required.");
    }
    if (apiRuntime.useBackend) {
      const subject = await http.get<any>(`/student/subjects/${id}`);
      const memberRows = buildGroupMemberRows(subject.group);
      const group = subject.group ? {
        id: String(subject.group.id || ''),
        code: subject.group.inviteCode || '—',
        leader: subject.group.leader || memberRows.find((m) => m.isLeader)?.name || '—',
        membersCount: String(memberRows.length),
        locked: subject.group.status === 'LOCKED' ? 'Locked' : 'Open',
        status: subject.group.status || 'Active',
      } : null;
      return {
        code: subject.code,
        name: subject.name,
        teacher: subject.teacherName || 'Assigned Teacher',
        section: Array.isArray(subject.sections) ? subject.sections.join(', ') : subject.section,
        term: 'AY 2025–2026 · 2nd Semester',
        activitiesCount: (subject.activities || []).length,
        overview: [
          { label: 'Teacher', value: subject.teacherName || 'Assigned Teacher' },
          { label: 'Sections', value: Array.isArray(subject.sections) ? subject.sections.join(', ') : (subject.section || '—') },
          { label: 'Activities', value: String((subject.activities || []).length) },
          { label: 'Status', value: subject.status || 'Active' },
        ],
        activities: (subject.activities || []).map((a: any, index: number) => ({
          id: String(a.id ?? index + 1),
          title: a.title,
          type: a.submissionMode === 'GROUP' ? 'Group' : 'Individual',
          due: a.deadline ? new Date(a.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
          fileTypes: (a.fileTypes || a.acceptedFileTypes || []).join(', ') || 'See submission rules',
          window: a.windowStatus || 'Open',
          status: formatSubmissionStatus(a.submissionStatus || 'NOT_STARTED'),
          action: a.actionLabel || 'Submit',
          daysLeft: a.deadline ? Math.ceil((new Date(a.deadline).getTime() - Date.now()) / 86400000) : 0,
        })),
        group,
        members: memberRows.map((member) => ({ name: member.name, role: member.isLeader ? 'Leader' : 'Member', status: 'Active' })),
        recentActivity: (subject.activities || []).slice(0, 4).map((a: any) => `${a.title} · ${a.windowStatus || 'Open'}`),
      };
    }
    await delay();
    return JSON.parse(JSON.stringify(studentSubjectData));
  },
};


export const teacherDashboardService = {"""
st = pattern.sub(replacement, st)

# Student submissions status formatting
st = st.replace("status: String(row.status).replace(/_/g, ' '),", "status: formatSubmissionStatus(row.status),")
st = st.replace("status: String(s.status).replace(/_/g, ' '),", "status: formatSubmissionStatus(s.status),")
st = st.replace("status: String(row.status).replace(/_/g, ' '),", "status: formatSubmissionStatus(row.status),")
# Teacher review block replacement
pattern = re.compile(r"async getSubmissionReview\(id = \"subm_1\"\): Promise<TeacherSubmissionReviewResponse> \{.*?\n  \},\n  async exportSubmissionsCsv", re.S)
replacement = """async getSubmissionReview(id = \"subm_1\"): Promise<TeacherSubmissionReviewResponse> {
    if (apiRuntime.useBackend) {
      const row = await http.get<any>(`/teacher/submissions/${id}`);
      const actionState = getReviewActionState(row.status);
      const groupMembers = Array.isArray(row.members) ? row.members.map((m: any) => String(m?.name || m)).filter(Boolean) : [];
      const timeline = [{ action: 'Submission loaded', by: 'System', time: row.submittedAt ? new Date(row.submittedAt).toLocaleString() : '—', type: 'info' }];
      if (row.reviewedAt) {
        timeline.push({ action: 'Marked as reviewed', by: row.reviewedBy || 'Teacher', time: new Date(row.reviewedAt).toLocaleString(), type: 'review' });
      }
      if (row.gradedAt) {
        timeline.push({ action: 'Graded', by: row.gradedBy || 'Teacher', time: new Date(row.gradedAt).toLocaleString(), type: 'grade' });
      }
      if (row.reopenedAt) {
        timeline.push({ action: 'Reopened', by: row.reopenedBy || 'Teacher', time: new Date(row.reopenedAt).toLocaleString(), type: 'reopen' });
      }
      return {
        title: row.title,
        subject: row.subject || row.subjectId || 'Subject',
        section: row.section || 'BSIT 3A',
        due: row.deadline ? new Date(row.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
        student: row.owner || row.submittedBy || 'Student',
        studentId: row.entityId || '—',
        initials: (row.owner || row.submittedBy || 'ST').split(' ').map((s: string) => s[0]).join('').slice(0,2).toUpperCase(),
        description: row.description || row.feedback || row.notes || 'Submission details are available for this record.',
        files: (row.files || []).map((f: any) => ({
          name: f.name || f.fileName || f,
          size: f.sizeKb ? `${f.sizeKb} KB` : f.fileSize ? `${f.fileSize} KB` : '—',
          href: buildStoredFileDownloadUrl(f.relativePath),
        })),
        timeline,
        status: formatSubmissionStatus(row.status),
        activity: row.title,
        submittedAt: row.submittedAt ? new Date(row.submittedAt).toLocaleString() : '—',
        late: normalizeSubmissionStatus(row.status) === 'LATE' ? 'Late' : 'On time',
        type: row.groupId ? 'Group' : 'Individual',
        groupName: row.groupName || undefined,
        submittedBy: row.submittedBy || undefined,
        groupMembers,
        allowedActions: actionState,
      };
    }
    await delay();
    return {
      ...JSON.parse(JSON.stringify(teacherSubmissionReviewData)),
      allowedActions: getReviewActionState((teacherSubmissionReviewData as any).status),
    };
  },
  async exportSubmissionsCsv"""
st = pattern.sub(replacement, st)

# reviewSubmission client-side mapping for reopen support
st = st.replace("return http.patch(`/teacher/submissions/${id}/review`, {\n      status: payload.status,\n      grade: payload.grade,\n      feedback: payload.feedback,\n    });",
                "return http.patch(`/teacher/submissions/${id}/review`, {\n      status: payload.status,\n      grade: payload.grade,\n      feedback: payload.feedback,\n    });")

# admin groups mapping and methods
st = st.replace("members: (g.members || []).map((m: any) => m.name),\n        status: g.status,\n        mode: 'Group',\n        code: g.inviteCode,",
                "members: (g.members || []).map((m: any) => String(m.name || m)),\n        status: formatSubmissionStatus(g.status).replace('Submitted', 'Active'),\n        mode: 'Group',\n        code: g.inviteCode,\n        leaderId: String((g.members || []).find((m: any) => m.isLeader)?.id || ''),\n        memberDetails: (g.members || []).map((m: any, index: number) => ({ id: String(m.id || index + 1), name: String(m.name || m), isLeader: Boolean(m.isLeader) || index === 0 })),")
# Insert admin group action methods before exportGroupsCsv
st = st.replace("  async exportGroupsCsv(records: AdminGroupRecord[]) {",
"""  async approveGroup(id: string) {
    if (apiRuntime.useBackend) return http.post(`/admin/groups/${id}/approve`, {});
    await delay(180);
    return { success: true };
  },
  async lockGroup(id: string) {
    if (apiRuntime.useBackend) return http.post(`/admin/groups/${id}/lock`, {});
    await delay(180);
    return { success: true };
  },
  async unlockGroup(id: string) {
    if (apiRuntime.useBackend) return http.post(`/admin/groups/${id}/unlock`, {});
    await delay(180);
    return { success: true };
  },
  async assignGroupLeader(id: string, memberId: string) {
    if (apiRuntime.useBackend) return http.post(`/admin/groups/${id}/leader`, { memberId });
    await delay(180);
    return { success: true };
  },
  async removeGroupMember(id: string, memberId: string) {
    if (apiRuntime.useBackend) return http.delete(`/admin/groups/${id}/members/${memberId}`);
    await delay(180);
    return { success: true };
  },
  async exportGroupsCsv(records: AdminGroupRecord[]) {""")
# add student group service before adminCatalogService
marker = "\n\nexport const adminCatalogService = {"
student_group_service = """

export const studentGroupService = {
  async createGroup(subjectId: string, name: string) {
    if (apiRuntime.useBackend) {
      return http.post(`/student/subjects/${subjectId}/group`, { name });
    }
    await delay(180);
    return { success: true };
  },
  async joinGroup(subjectId: string, inviteCode: string) {
    if (apiRuntime.useBackend) {
      return http.post(`/student/subjects/${subjectId}/group/join`, { inviteCode });
    }
    await delay(180);
    return { success: true };
  },
};

export const adminCatalogService = {"""
st = st.replace(marker, student_group_service)
services.write_text(st)

# Rewrite teacher review page
teacher_review.write_text("""import { useEffect, useMemo, useState } from \"react\";
import { useNavigate, useParams, useSearchParams } from \"react-router\";
import { ChevronLeft, FileText, Download, CheckCircle2, RotateCcw, Star, Clock, Users, AlertCircle } from \"lucide-react\";
import { StatusChip } from \"../../components/ui/StatusChip\";
import { teacherService } from \"../../lib/api/services\";
import { useAsyncData } from \"../../lib/hooks/useAsyncData\";

export default function TeacherSubmissionReview() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const backTarget = searchParams.get('back') || '/teacher/submissions';
  const { data, reload, error } = useAsyncData(() => teacherService.getSubmissionReview(id), [id]);
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');
  const [status, setStatus] = useState('Submitted');
  const [saved, setSaved] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.status) setStatus(data.status);
    if ((data as any)?.feedback) setFeedback((data as any).feedback);
    if (data?.allowedActions?.final && data?.status === 'Graded' && !grade) {
      setGrade((data as any)?.grade || '');
    }
  }, [data, grade]);

  const actionState = data?.allowedActions;
  const infoRows = useMemo(() => {
    const rows = [
      { label: 'Student', value: data?.student ?? '—' },
      { label: 'Activity', value: data?.activity ?? '—' },
      { label: 'Submitted', value: data?.submittedAt ?? '—' },
      { label: 'Late?', value: data?.late ?? '—' },
    ];
    if (data?.type === 'Group') {
      rows.splice(1, 0,
        { label: 'Group', value: data.groupName ?? '—' },
        { label: 'Submitted By', value: data.submittedBy ?? data.student ?? '—' },
        { label: 'Members', value: (data.groupMembers ?? []).join(', ') || '—' },
      );
    }
    return rows;
  }, [data]);

  const handleAction = async (action: 'grade' | 'review' | 'return' | 'reopen') => {
    const actionMap = {
      grade: { nextStatus: 'GRADED', allowed: actionState?.canGrade },
      review: { nextStatus: 'REVIEWED', allowed: actionState?.canMarkReviewed },
      return: { nextStatus: 'NEEDS_REVISION', allowed: actionState?.canRequestRevision },
      reopen: { nextStatus: 'REOPENED', allowed: actionState?.canReopen },
    } as const;
    const selected = actionMap[action];
    if (!selected.allowed) {
      setActionError(actionState?.reason || 'This action is not valid for the current submission status.');
      return;
    }
    if (action === 'grade' && (!grade || Number.isNaN(Number(grade)))) {
      setActionError('Enter a numeric grade before marking the submission as graded.');
      return;
    }
    setActionError(null);
    try {
      if (id) {
        await teacherService.reviewSubmission(id, {
          status: selected.nextStatus,
          grade: grade ? Number(grade) : undefined,
          feedback,
        });
        await reload();
      }
      setSaved(true);
      setStatus(selected.nextStatus.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()));
      window.setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaved(false);
      setActionError('Unable to save the review action.');
    }
  };

  return (
    <div className=\"p-6 max-w-7xl mx-auto space-y-6\">
      <div className=\"flex items-center justify-between\">
        <button onClick={() => navigate(backTarget)} className=\"flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-sm\">
          <ChevronLeft size={15} /> Back to Submissions
        </button>
        <StatusChip status={status} />
      </div>

      {saved && <div className=\"flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200\"><CheckCircle2 size={16} className=\"text-emerald-600 shrink-0\" /><p className=\"text-emerald-700 text-sm font-semibold\">Review action saved successfully.</p></div>}
      {error && <div className=\"px-4 py-3 rounded-xl border border-rose-200 bg-rose-50 text-sm font-medium text-rose-700\">Unable to load this submission.</div>}
      {actionError && <div className=\"px-4 py-3 rounded-xl border border-rose-200 bg-rose-50 text-sm font-medium text-rose-700\">{actionError}</div>}
      {actionState?.reason && <div className=\"px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-sm font-medium text-amber-800\">{actionState.reason}</div>}

      <div className=\"grid grid-cols-1 xl:grid-cols-3 gap-6\">
        <div className=\"xl:col-span-2 space-y-5\">
          <div className=\"bg-white rounded-xl border border-slate-100 shadow-sm p-6\">
            <div className=\"flex items-start justify-between mb-5\">
              <div>
                <h1 className=\"text-slate-900 font-bold\" style={{ fontSize: '1.2rem', letterSpacing: '-0.02em' }}>{data?.title ?? 'Loading…'}</h1>
                <p className=\"text-slate-400 text-sm mt-0.5\">{data?.subject ?? ''} · {data?.section ?? ''}</p>
              </div>
              <div className=\"flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-100\">
                <Clock size={13} className=\"text-amber-600\" />
                <span className=\"text-amber-700 text-xs font-semibold\">Due {data?.due ?? '—'}</span>
              </div>
            </div>

            <div className=\"grid grid-cols-1 md:grid-cols-2 gap-3 mb-5\">
              {infoRows.map((row) => (
                <div key={row.label} className=\"rounded-xl border border-slate-100 bg-slate-50 px-4 py-3\">
                  <p className=\"text-[10px] uppercase tracking-wider font-semibold text-slate-400\">{row.label}</p>
                  <p className=\"text-sm font-semibold text-slate-800 mt-1\">{row.value}</p>
                </div>
              ))}
            </div>

            {data?.type === 'Group' && (
              <div className=\"mb-5 rounded-xl border border-teal-100 bg-teal-50/60 p-4\">
                <div className=\"flex items-center gap-2 mb-2\">
                  <Users size={14} className=\"text-teal-700\" />
                  <p className=\"text-teal-800 text-xs font-semibold uppercase tracking-wider\">Group Details</p>
                </div>
                <p className=\"text-slate-800 text-sm font-semibold\">{data.groupName ?? '—'}</p>
                <p className=\"text-slate-500 text-xs mt-1\">Submitted by {data.submittedBy ?? data.student ?? '—'}</p>
                {(data.groupMembers ?? []).length > 0 && <ul className=\"mt-3 text-xs text-slate-600 space-y-1 list-disc pl-4\">{data.groupMembers?.map((member) => <li key={member}>{member}</li>)}</ul>}
              </div>
            )}

            <div className=\"mb-5\">
              <p className=\"text-slate-600 text-xs font-semibold uppercase tracking-wider mb-2\">Submission Description</p>
              <p className=\"text-slate-600 text-sm leading-relaxed\">{data?.description}</p>
            </div>

            <div>
              <p className=\"text-slate-600 text-xs font-semibold uppercase tracking-wider mb-2\">Attached Files</p>
              <div className=\"space-y-2\">{(data?.files ?? []).map((f) => <div key={f.name} className=\"flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50\"><div className=\"flex items-center gap-2.5\"><FileText size={15} className=\"text-blue-700\" /><div><p className=\"text-slate-700 text-xs font-medium\">{f.name}</p><p className=\"text-slate-400 text-[10px]\">{f.size}</p></div></div>{f.href ? <a href={f.href} target=\"_blank\" rel=\"noreferrer\" className=\"flex items-center gap-1 text-teal-700 text-xs font-semibold hover:underline\"><Download size={12} /> Download</a> : <span className=\"flex items-center gap-1 text-slate-400 text-xs font-semibold\"><Download size={12} /> Unavailable</span>}</div>)}</div>
            </div>
          </div>
        </div>

        <div className=\"space-y-4\">
          <div className=\"bg-white rounded-xl border border-slate-100 shadow-sm p-5 sticky top-6\">
            <h2 className=\"text-slate-800 text-sm font-bold mb-4\">Review & Grade</h2>
            <div className=\"mb-4\">
              <label className=\"block text-xs font-semibold text-slate-700 mb-1.5\">Grade (out of 100)</label>
              <input type=\"number\" min=\"0\" max=\"100\" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder=\"e.g. 92\" className=\"w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10 transition-all\" />
            </div>
            <div className=\"mb-5\">
              <label className=\"block text-xs font-semibold text-slate-700 mb-1.5\">Feedback / Comments</label>
              <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={6} placeholder=\"Provide constructive feedback for the student…\" className=\"w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10 transition-all resize-none\" />
            </div>
            <div className=\"rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 mb-4\">
              <div className=\"flex items-start gap-2\"><AlertCircle size={14} className=\"mt-0.5 text-slate-500 shrink-0\" /><p>Only valid actions are enabled for the current submission state. Finalized submissions must be reopened before they can be changed again.</p></div>
            </div>
            <div className=\"space-y-2\">
              <button disabled={!actionState?.canGrade} onClick={() => handleAction('grade')} className=\"w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50\"><Star size={14} /> Mark as Graded</button>
              <button disabled={!actionState?.canMarkReviewed} onClick={() => handleAction('review')} className=\"w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-bold hover:bg-teal-800 transition-colors disabled:opacity-50\"><CheckCircle2 size={14} /> Mark as Reviewed</button>
              <button disabled={!actionState?.canRequestRevision} onClick={() => handleAction('return')} className=\"w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-orange-200 text-orange-600 text-sm font-semibold hover:bg-orange-50 transition-colors disabled:opacity-50\"><RotateCcw size={14} /> Return for Revision</button>
              <button disabled={!actionState?.canReopen} onClick={() => handleAction('reopen')} className=\"w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50\"><RotateCcw size={14} /> Reopen Submission</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
""")

# Rewrite student subject details page
student_subject.write_text("""import { useMemo, useState } from \"react\";
import { useNavigate, useParams, useSearchParams } from \"react-router\";
import { ChevronLeft, BookOpen, Users, FileText, Clock, Copy, CheckCircle2, Plus, Lock, UserPlus } from \"lucide-react\";
import { StatusChip } from \"../../components/ui/StatusChip\";
import { useAsyncData } from \"../../lib/hooks/useAsyncData\";
import { studentGroupService, studentService, studentSubjectService } from \"../../lib/api/services\";

const tabs = ['Overview', 'Activities', 'My Group'] as const;
const tabParamMap: Record<string, (typeof tabs)[number]> = { overview: 'Overview', activities: 'Activities', group: 'My Group' };
const reverseTabParamMap: Record<(typeof tabs)[number], string> = { Overview: 'overview', Activities: 'activities', 'My Group': 'group' };

function isViewOnlyStatus(status: string, action: string) {
  const normalized = `${status} ${action}`.toLowerCase();
  return normalized.includes('submitted') || normalized.includes('graded') || normalized.includes('reviewed') || normalized.includes('revision');
}

function isDisabledAction(action: string) {
  return action.toLowerCase().includes('not yet open');
}

export default function StudentSubjectDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabParamMap[searchParams.get('tab') || ''] || 'Overview';
  const [copied, setCopied] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [groupActionState, setGroupActionState] = useState<{ saving: boolean; error: string | null; success: string | null }>({ saving: false, error: null, success: null });
  const { data, loading, reload } = useAsyncData(() => id ? studentSubjectService.getSubject(id) : Promise.reject(new Error('Subject id is required.')), [id]);
  const { data: submissionRows = [] } = useAsyncData(() => studentService.getSubmissions(), []);
  const subjectPath = `/student/subjects/${id || 1}`;
  const returnToActivities = `${subjectPath}?tab=activities`;

  const copyCode = async () => {
    if (!data?.group?.code || data.group.code === '—') return;
    try {
      await navigator.clipboard.writeText(data.group.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const handleTabChange = (nextTab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', reverseTabParamMap[nextTab as (typeof tabs)[number]] || 'overview');
    setSearchParams(next, { replace: true });
  };

  const activityRows = useMemo(() => {
    if (!data) return [];
    return data.activities.map((activity) => {
      const viewOnly = isViewOnlyStatus(activity.status, activity.action);
      const disabled = isDisabledAction(activity.action);
      const matchedSubmission = submissionRows.find((item) => item.title === activity.title);
      const target = viewOnly
        ? matchedSubmission
          ? `/student/submissions/${encodeURIComponent(String(matchedSubmission.id))}?back=${encodeURIComponent(returnToActivities)}`
          : `/student/submissions?openTitle=${encodeURIComponent(activity.title)}&back=${encodeURIComponent(returnToActivities)}`
        : disabled
          ? ''
          : `/student/submit?subject=${encodeURIComponent(data.name)}&activity=${encodeURIComponent(activity.title)}&back=${encodeURIComponent(returnToActivities)}`;
      const label = disabled ? 'Not Yet Open' : viewOnly ? 'View Submission' : activity.action;
      return { ...activity, disabled, target, label };
    });
  }, [data, returnToActivities, submissionRows]);

  const handleCreateGroup = async () => {
    if (!id || !groupName.trim()) return;
    setGroupActionState({ saving: true, error: null, success: null });
    try {
      await studentGroupService.createGroup(id, groupName.trim());
      await reload();
      setGroupName('');
      setGroupActionState({ saving: false, error: null, success: 'Group created successfully.' });
    } catch {
      setGroupActionState({ saving: false, error: 'Unable to create the group right now.', success: null });
    }
  };

  const handleJoinGroup = async () => {
    if (!id || !joinCode.trim()) return;
    setGroupActionState({ saving: true, error: null, success: null });
    try {
      await studentGroupService.joinGroup(id, joinCode.trim());
      await reload();
      setJoinCode('');
      setGroupActionState({ saving: false, error: null, success: 'Group joined successfully.' });
    } catch {
      setGroupActionState({ saving: false, error: 'Unable to join the group with that code.', success: null });
    }
  };

  if (!data && loading) return <div className=\"p-6 max-w-7xl mx-auto\"><div className=\"h-72 rounded-xl bg-slate-100 animate-pulse\" /></div>;
  if (!data) return null;

  return <div className=\"p-6 max-w-7xl mx-auto space-y-6\"> 
    <button onClick={() => navigate('/student/subjects')} className=\"flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-sm transition-colors\"><ChevronLeft size={15} /> Back to Subjects</button>
    <div className=\"bg-white rounded-xl border border-slate-100 shadow-sm p-6\"> 
      <div className=\"flex items-start gap-4\"> 
        <div className=\"w-14 h-14 rounded-xl bg-blue-800 flex items-center justify-center shrink-0\"><BookOpen size={24} className=\"text-white\" /></div>
        <div className=\"flex-1\"> 
          <div className=\"flex items-center gap-2 mb-1\"> <span className=\"text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider\">{data.code}</span> <span className=\"text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full\">Active</span> </div>
          <h1 className=\"text-slate-900 font-bold\" style={{ fontSize: '1.3rem', letterSpacing: '-0.02em' }}>{data.name}</h1>
          <div className=\"flex flex-wrap gap-4 mt-2 text-sm text-slate-500\"><span>👨‍🏫 {data.teacher}</span><span>📚 {data.section}</span><span>📅 {data.term}</span><span>📋 {data.activitiesCount} Activities</span></div>
        </div>
      </div>
    </div>
    <div className=\"flex gap-1 border-b border-slate-200\"> {tabs.map((t) => <button key={t} onClick={() => handleTabChange(t)} className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${tab === t ? 'border-blue-800 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{t}</button>)} </div>
    {tab === 'Overview' && <div className=\"grid grid-cols-1 md:grid-cols-3 gap-4\">{data.overview.map((s) => <div key={s.label} className=\"bg-white rounded-xl border border-slate-100 shadow-sm p-4\"><p className=\"text-slate-400 text-xs font-medium\">{s.label}</p><p className=\"text-slate-900 font-bold text-2xl mt-1\">{s.value}</p></div>)}</div>}
    {tab === 'Activities' && <div className=\"bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden\"><table className=\"w-full text-sm\"><thead><tr className=\"bg-slate-50 border-b border-slate-100\">{['Activity Title', 'Type', 'Due Date', 'File Types', 'Window', 'Status', 'Action'].map((h) => <th key={h} className=\"text-left px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wider\">{h}</th>)}</tr></thead><tbody className=\"divide-y divide-slate-50\">{activityRows.map((a) => <tr key={a.id} className=\"hover:bg-slate-50 transition-colors\"><td className=\"px-5 py-3.5\"><p className=\"text-slate-800 font-semibold text-xs\">{a.title}</p>{a.daysLeft < 0 && <p className=\"text-rose-500 text-[10px] font-semibold\">Overdue by {Math.abs(a.daysLeft)}d</p>}{a.daysLeft >= 0 && a.daysLeft <= 5 && <p className=\"text-amber-600 text-[10px] font-semibold\">{a.daysLeft}d left</p>}</td><td className=\"px-5 py-3.5\"><span className=\"flex items-center gap-1 text-xs text-slate-500\">{a.type === 'Group' ? <Users size={11} /> : <FileText size={11} />} {a.type}</span></td><td className=\"px-5 py-3.5 text-slate-500 text-xs flex items-center gap-1\"><Clock size={11} className=\"shrink-0\" /> {a.due}</td><td className=\"px-5 py-3.5 text-slate-400 text-[11px]\">{a.fileTypes}</td><td className=\"px-5 py-3.5\"><StatusChip status={a.window} size=\"xs\" /></td><td className=\"px-5 py-3.5\"><StatusChip status={a.status} size=\"xs\" /></td><td className=\"px-5 py-3.5\"><button onClick={() => !a.disabled && a.target && navigate(a.target)} disabled={a.disabled} className={`text-xs font-semibold whitespace-nowrap ${a.disabled ? 'text-slate-300 cursor-not-allowed' : 'text-blue-700 hover:underline'}`}>{a.label} {!a.disabled ? '→' : ''}</button></td></tr>)}</tbody></table></div>}
    {tab === 'My Group' && <div className=\"grid grid-cols-1 xl:grid-cols-[1.15fr,0.85fr] gap-6\"> 
      <div className=\"space-y-5\"> 
        {!data.group ? <div className=\"bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-5\"> 
          <div><p className=\"text-slate-400 text-xs font-medium\">No active group yet</p><h2 className=\"text-slate-900 text-lg font-bold mt-1\">Create or Join a Group</h2><p className=\"text-slate-500 text-sm mt-1\">This subject supports group work. Create a new group or paste a valid invite code to join an existing one.</p></div>
          {groupActionState.error && <div className=\"rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700\">{groupActionState.error}</div>}
          {groupActionState.success && <div className=\"rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700\">{groupActionState.success}</div>}
          <div className=\"grid md:grid-cols-2 gap-4\"> 
            <div className=\"rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3\"> 
              <p className=\"text-sm font-bold text-slate-800\">Create Group</p>
              <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder=\"Enter group name\" className=\"w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm\" />
              <button onClick={handleCreateGroup} disabled={groupActionState.saving || !groupName.trim()} className=\"inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-800 text-white text-sm font-semibold hover:bg-blue-900 disabled:opacity-50\"><Plus size={14} /> Create Group</button>
            </div>
            <div className=\"rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3\"> 
              <p className=\"text-sm font-bold text-slate-800\">Join by Code</p>
              <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder=\"Paste invite code\" className=\"w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm uppercase\" />
              <button onClick={handleJoinGroup} disabled={groupActionState.saving || !joinCode.trim()} className=\"inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50\"><UserPlus size={14} /> Join Group</button>
            </div>
          </div>
        </div> : <>
          <div className=\"bg-white rounded-xl border border-slate-100 shadow-sm p-5\"> 
            <div className=\"flex items-start justify-between gap-3\"> 
              <div><p className=\"text-slate-400 text-xs font-medium\">Current Group</p><h2 className=\"text-slate-900 text-lg font-bold mt-1\">{data.group.id || data.group.code}</h2><p className=\"text-slate-500 text-sm mt-1\">Your active group is linked to all group-based activities in this subject.</p></div>
              <StatusChip status={data.group.status} size=\"xs\" />
            </div>
            <div className=\"grid grid-cols-2 md:grid-cols-4 gap-3 mt-5\"> 
              <div className=\"rounded-lg bg-slate-50 px-3 py-2.5\"><p className=\"text-[10px] font-semibold uppercase tracking-wide text-slate-400\">Group Code</p><p className=\"text-sm font-bold text-slate-700 mt-1\">{data.group.code}</p></div>
              <div className=\"rounded-lg bg-slate-50 px-3 py-2.5\"><p className=\"text-[10px] font-semibold uppercase tracking-wide text-slate-400\">Leader</p><p className=\"text-sm font-bold text-slate-700 mt-1\">{data.group.leader}</p></div>
              <div className=\"rounded-lg bg-slate-50 px-3 py-2.5\"><p className=\"text-[10px] font-semibold uppercase tracking-wide text-slate-400\">Members</p><p className=\"text-sm font-bold text-slate-700 mt-1\">{data.group.membersCount}</p></div>
              <div className=\"rounded-lg bg-slate-50 px-3 py-2.5\"><p className=\"text-[10px] font-semibold uppercase tracking-wide text-slate-400\">Grouping</p><p className=\"text-sm font-bold text-slate-700 mt-1\">{data.group.locked}</p></div>
            </div>
            <div className=\"flex flex-wrap gap-2 mt-4\"> 
              <button onClick={copyCode} className=\"inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50\">{copied ? <CheckCircle2 size={14} className=\"text-emerald-600\" /> : <Copy size={14} />} {copied ? 'Code Copied' : 'Copy Invite Code'}</button>
              <button onClick={copyCode} className=\"inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-800 text-white text-sm font-semibold hover:bg-blue-900\"><Plus size={14} /> {copied ? 'Invite Code Copied' : 'Invite Member'}</button>
              <button className=\"inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-400 text-sm font-semibold cursor-not-allowed\"><Lock size={14} /> {data.group.locked === 'Locked' ? 'Group Locked' : 'Managed by teacher/admin'}</button>
            </div>
          </div>
          <div className=\"bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden\"><div className=\"px-5 py-4 border-b border-slate-100\"><h3 className=\"text-slate-800 text-sm font-bold\">Members</h3></div><table className=\"w-full text-sm\"><thead><tr className=\"bg-slate-50 border-b border-slate-100\">{['Name', 'Role', 'Status', 'Submission Visibility'].map((h) => <th key={h} className=\"text-left px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wider\">{h}</th>)}</tr></thead><tbody className=\"divide-y divide-slate-50\">{data.members.map((member) => <tr key={member.name} className=\"hover:bg-slate-50\"><td className=\"px-5 py-3.5 text-slate-800 text-xs font-semibold\">{member.name}</td><td className=\"px-5 py-3.5 text-slate-500 text-xs\">{member.role}</td><td className=\"px-5 py-3.5\"><StatusChip status={member.status} size=\"xs\" /></td><td className=\"px-5 py-3.5 text-slate-500 text-xs\">Can view all group submissions</td></tr>)}</tbody></table></div>
        </>}
      </div>
      <div className=\"space-y-5\"> 
        <div className=\"bg-blue-50 border border-blue-100 rounded-xl p-5\"><h3 className=\"text-blue-800 text-sm font-bold mb-2\">Group Submission Rules</h3><div className=\"space-y-2 text-blue-700 text-xs\"><p>• One group can submit only once per activity.</p><p>• Group members are shown automatically on the submission page.</p><p>• Locked groups reject join requests.</p><p>• Resubmission is allowed only when the teacher reopens the activity.</p></div></div>
        <div className=\"bg-white rounded-xl border border-slate-100 shadow-sm p-5\"><h3 className=\"text-slate-800 text-sm font-bold mb-3\">Recent Group Activity</h3><div className=\"space-y-3\">{data.recentActivity.map((item) => <div key={item} className=\"text-xs text-slate-500 leading-relaxed\">{item}</div>)}</div></div>
      </div>
    </div>}
  </div>;
}
""")

# Rewrite admin groups page
admin_groups.write_text("""import { useMemo, useState } from \"react\";
import { Download, RefreshCcw, Search, Users, ShieldCheck, KeyRound, FolderOpen } from \"lucide-react\";
import { StatusChip } from \"../../components/ui/StatusChip\";
import { useAsyncData } from \"../../lib/hooks/useAsyncData\";
import { adminService } from \"../../lib/api/services\";

export default function AdminGroups() {
  const [search, setSearch] = useState('');
  const [sectionF, setSectionF] = useState('All Sections');
  const [statusF, setStatusF] = useState('All Statuses');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [exportState, setExportState] = useState<{ exporting: boolean; error: string | null }>({ exporting: false, error: null });
  const fetchGroups = useMemo(() => () => adminService.getGroups({ search, section: sectionF, status: statusF }), [search, sectionF, statusF]);
  const { data, loading, error, reload } = useAsyncData(fetchGroups, [fetchGroups]);
  const groups = data ?? [];
  const activeCount = groups.filter((g) => g.status === 'Active').length;
  const lockedCount = groups.filter((g) => g.status === 'Locked').length;
  const pendingCount = groups.filter((g) => g.status === 'Pending Review').length;

  const exportGroups = async () => {
    setExportState({ exporting: true, error: null });
    try {
      await adminService.exportGroupsCsv(groups);
      setExportState({ exporting: false, error: null });
    } catch {
      setExportState({ exporting: false, error: 'Unable to export groups right now.' });
    }
  };

  const runAction = async (groupId: string, action: () => Promise<unknown>) => {
    setPageError(null);
    setBusyId(groupId);
    try {
      await action();
      await reload();
    } catch {
      setPageError('Unable to complete the group action right now.');
    } finally {
      setBusyId(null);
    }
  };

  return <div className=\"p-6 max-w-7xl mx-auto space-y-6\"> 
    <div className=\"flex items-start justify-between gap-4 flex-wrap\"> 
      <div><h1 className=\"text-slate-900 font-bold\" style={{ fontSize: '1.3rem', letterSpacing: '-0.02em' }}>Groups</h1><p className=\"text-slate-400 text-sm mt-0.5\">Monitor group formation, invitation codes, leadership, and submission ownership.</p><p className=\"text-slate-400 text-xs mt-1\">{loading ? 'Loading groups…' : `${groups.length} group${groups.length === 1 ? '' : 's'}`}</p></div>
      <div className=\"flex items-center gap-2\"><button disabled={loading || exportState.exporting} onClick={reload} className=\"flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50\"><RefreshCcw size={14} /> Refresh</button><button disabled={loading || exportState.exporting || groups.length === 0} onClick={exportGroups} className=\"flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50\"><Download size={14} /> {exportState.exporting ? 'Exporting…' : 'Export Groups'}</button></div>
    </div>
    {(pageError || exportState.error || error) && <div className=\"rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700\">{pageError || exportState.error || 'Unable to load groups.'}</div>}
    <div className=\"grid grid-cols-2 lg:grid-cols-4 gap-4\">{[{ label: 'Total Groups', value: groups.length, icon: Users, tone: 'bg-blue-50 text-blue-700' }, { label: 'Active Groups', value: activeCount, icon: ShieldCheck, tone: 'bg-emerald-50 text-emerald-700' }, { label: 'Locked Groups', value: lockedCount, icon: KeyRound, tone: 'bg-amber-50 text-amber-700' }, { label: 'Pending Review', value: pendingCount, icon: Users, tone: 'bg-violet-50 text-violet-700' }].map((item) => { const Icon = item.icon; return <div key={item.label} className=\"bg-white rounded-xl border border-slate-100 shadow-sm p-4\"><div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.tone}`}><Icon size={15} /></div><p className=\"text-slate-900 font-bold text-2xl mt-3\">{item.value}</p><p className=\"text-slate-500 text-xs mt-0.5\">{item.label}</p></div>; })}</div>
    <div className=\"flex flex-wrap gap-3 items-center\"> 
      <div className=\"flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white flex-1 min-w-[220px]\"><Search size={14} className=\"text-slate-400 shrink-0\" /><input disabled={loading || exportState.exporting} value={search} onChange={(e) => setSearch(e.target.value)} placeholder=\"Search group, code, leader, subject…\" className=\"text-sm text-slate-700 placeholder-slate-400 outline-none flex-1 disabled:opacity-50\" /></div>
      <select disabled={loading || exportState.exporting} value={sectionF} onChange={(e) => setSectionF(e.target.value)} className=\"px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 outline-none disabled:opacity-50\">{['All Sections', 'BSIT 3A', 'BSIT 3B', 'BSCS 4A'].map((opt) => <option key={opt}>{opt}</option>)}</select>
      <select disabled={loading || exportState.exporting} value={statusF} onChange={(e) => setStatusF(e.target.value)} className=\"px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 outline-none disabled:opacity-50\">{['All Statuses', 'Active', 'Pending Review', 'Locked'].map((opt) => <option key={opt}>{opt}</option>)}</select>
    </div>
    <div className=\"bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden\">{loading && groups.length === 0 ? <div className=\"p-6 text-sm text-slate-400\">Loading groups…</div> : groups.length === 0 ? <div className=\"p-6 text-sm text-slate-400\">No groups matched the current filters.</div> : <table className=\"w-full text-sm\"><thead><tr className=\"bg-slate-50 border-b border-slate-100\">{['Group', 'Subject', 'Section', 'Leader', 'Members', 'Mode', 'Status', ''].map((h) => <th key={h} className=\"text-left px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wider\">{h}</th>)}</tr></thead><tbody className=\"divide-y divide-slate-50\">{groups.map((g) => <>
      <tr key={g.id} className=\"hover:bg-slate-50 cursor-pointer\" onClick={() => setExpanded(expanded === g.id ? null : g.id)}><td className=\"px-5 py-3.5\"><p className=\"text-slate-800 font-semibold text-sm\">{g.name}</p><p className=\"text-slate-400 text-[11px] mt-0.5\">{g.id} · {g.code}</p></td><td className=\"px-5 py-3.5 text-slate-500 text-xs\">{g.subject}</td><td className=\"px-5 py-3.5 text-slate-500 text-xs\">{g.section}</td><td className=\"px-5 py-3.5 text-slate-700 text-xs font-medium\">{g.leader}</td><td className=\"px-5 py-3.5 text-slate-500 text-xs\">{g.members.length}</td><td className=\"px-5 py-3.5 text-slate-500 text-xs\">{g.mode}</td><td className=\"px-5 py-3.5\"><StatusChip status={g.status} size=\"xs\" /></td><td className=\"px-5 py-3.5 text-right text-slate-400 text-xs\">{expanded === g.id ? 'Hide' : 'View'}</td></tr>
      {expanded === g.id && <tr><td colSpan={8} className=\"px-5 py-4 bg-slate-50/70 border-t border-slate-100\"><div className=\"grid lg:grid-cols-[1fr,1.6fr] gap-4 text-xs\"><div className=\"bg-white rounded-lg border border-slate-100 p-4 space-y-3\"><div><p className=\"text-slate-400 uppercase tracking-wider text-[10px] font-semibold\">Invite / Ownership</p><div className=\"mt-3 space-y-2 text-slate-600\"><p><span className=\"font-semibold text-slate-700\">Invite Code:</span> {g.code}</p><p><span className=\"font-semibold text-slate-700\">Formation Mode:</span> {g.mode}</p><p><span className=\"font-semibold text-slate-700\">Submission Owner:</span> Group</p></div></div><div className=\"flex flex-wrap gap-2\"><button disabled={busyId === g.id || g.status !== 'Pending Review'} onClick={() => runAction(g.id, () => adminService.approveGroup(g.id))} className=\"px-3 py-2 rounded-lg bg-blue-800 text-white font-semibold disabled:opacity-50\">Approve</button><button disabled={busyId === g.id || g.status === 'Locked'} onClick={() => runAction(g.id, () => adminService.lockGroup(g.id))} className=\"px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold disabled:opacity-50\">Lock</button><button disabled={busyId === g.id || g.status !== 'Locked'} onClick={() => runAction(g.id, () => adminService.unlockGroup(g.id))} className=\"px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold disabled:opacity-50\">Unlock</button><button onClick={() => window.location.href = `/admin/submissions?group=${encodeURIComponent(g.id)}`} className=\"px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold inline-flex items-center gap-2\"><FolderOpen size={14} /> Related submissions</button></div></div><div className=\"bg-white rounded-lg border border-slate-100 p-4\"><p className=\"text-slate-400 uppercase tracking-wider text-[10px] font-semibold\">Members</p><div className=\"mt-3 grid sm:grid-cols-2 gap-2\">{(g.memberDetails || g.members.map((name, index) => ({ id: String(index + 1), name, isLeader: index === 0 }))).map((member) => <div key={member.id} className=\"px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 text-slate-700 space-y-2\"><div className=\"flex items-center justify-between gap-2\"><span className=\"truncate\">{member.name}</span>{member.isLeader && <span className=\"text-[10px] font-bold text-blue-700\">Leader</span>}</div><div className=\"flex gap-2\"><button disabled={busyId === g.id || member.isLeader} onClick={() => runAction(g.id, () => adminService.assignGroupLeader(g.id, member.id))} className=\"px-2 py-1 rounded border border-slate-200 bg-white text-[11px] font-semibold disabled:opacity-50\">Assign leader</button><button disabled={busyId === g.id || g.members.length <= 1} onClick={() => runAction(g.id, () => adminService.removeGroupMember(g.id, member.id))} className=\"px-2 py-1 rounded border border-rose-200 bg-rose-50 text-[11px] font-semibold text-rose-700 disabled:opacity-50\">Remove</button></div></div>)}</div></div></div></td></tr>}
    </> )}</tbody></table>}</div>
  </div>;
}
""")

print('Second pass changes applied.')
