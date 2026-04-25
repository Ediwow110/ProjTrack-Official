import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Download, RefreshCcw, Search, Users, ShieldCheck, KeyRound, FolderOpen } from "lucide-react";
import { StatusChip } from "../../components/ui/StatusChip";
import { useAsyncData } from "../../lib/hooks/useAsyncData";
import { adminService } from "../../lib/api/services";

export default function AdminGroups() {
  const navigate = useNavigate();
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
  const sectionOptions = ['All Sections', ...Array.from(new Set(groups.map((g) => g.section).filter(Boolean)))];
  const statusOptions = ['All Statuses', ...Array.from(new Set(groups.map((g) => g.status).filter(Boolean)))];

  const toggleExpanded = (groupId: string) => {
    setExpanded(expanded === groupId ? null : groupId);
  };

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
      setExpanded(groupId);
    } catch {
      setPageError('Unable to complete the group action right now.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-slate-900 font-bold" style={{ fontSize: '1.3rem', letterSpacing: '-0.02em' }}>Groups</h1>
          <p className="text-slate-400 text-sm mt-0.5">Monitor group formation, invitation codes, leadership, and submission ownership.</p>
          <p className="text-slate-400 text-xs mt-1">{loading ? 'Loading groups…' : `${groups.length} group${groups.length === 1 ? '' : 's'}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <button disabled={loading || exportState.exporting} onClick={reload} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"><RefreshCcw size={14} /> Refresh</button>
          <button disabled={loading || exportState.exporting || groups.length === 0} onClick={exportGroups} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"><Download size={14} /> {exportState.exporting ? 'Exporting…' : 'Export Groups'}</button>
        </div>
      </div>

      {(pageError || exportState.error || error) && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{pageError || exportState.error || 'Unable to load groups.'}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[
        { label: 'Total Groups', value: groups.length, icon: Users, tone: 'bg-blue-50 text-blue-700' },
        { label: 'Active Groups', value: activeCount, icon: ShieldCheck, tone: 'bg-emerald-50 text-emerald-700' },
        { label: 'Locked Groups', value: lockedCount, icon: KeyRound, tone: 'bg-amber-50 text-amber-700' },
        { label: 'Pending Review', value: pendingCount, icon: Users, tone: 'bg-violet-50 text-violet-700' },
      ].map((item) => {
        const Icon = item.icon;
        return <div key={item.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4"><div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.tone}`}><Icon size={15} /></div><p className="text-slate-900 font-bold text-2xl mt-3">{item.value}</p><p className="text-slate-500 text-xs mt-0.5">{item.label}</p></div>;
      })}</div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white flex-1 min-w-[220px]"><Search size={14} className="text-slate-400 shrink-0" /><input disabled={loading || exportState.exporting} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search group, code, leader, subject…" className="text-sm text-slate-700 placeholder-slate-400 outline-none flex-1 disabled:opacity-50" aria-label="Search groups" /></div>
        <select disabled={loading || exportState.exporting} value={sectionF} onChange={(e) => setSectionF(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 outline-none disabled:opacity-50" aria-label="Filter groups by section">{sectionOptions.map((opt) => <option key={opt}>{opt}</option>)}</select>
        <select disabled={loading || exportState.exporting} value={statusF} onChange={(e) => setStatusF(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 outline-none disabled:opacity-50" aria-label="Filter groups by status">{statusOptions.map((opt) => <option key={opt}>{opt}</option>)}</select>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading && groups.length === 0 ? <div className="p-6 text-sm text-slate-400">Loading groups…</div> : groups.length === 0 ? <div className="p-6 text-sm text-slate-400">No groups matched the current filters.</div> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">{['Group', 'Subject', 'Section', 'Leader', 'Members', 'Mode', 'Status', ''].map((h) => <th key={h} className="text-left px-5 py-3 text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {groups.flatMap((g) => [
                <tr
                  key={`${g.id}-summary`}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => toggleExpanded(g.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      toggleExpanded(g.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expanded === g.id}
                  aria-label={`Open group ${g.name}`}
                >
                  <td className="px-5 py-3.5"><p className="text-slate-800 font-semibold text-sm">{g.name}</p><p className="text-slate-400 text-[11px] mt-0.5">{g.id} · {g.code}</p></td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs">{g.subject}</td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs">{g.section}</td>
                  <td className="px-5 py-3.5 text-slate-700 text-xs font-medium">{g.leader}</td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs">{g.members.length}</td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs">{g.mode}</td>
                  <td className="px-5 py-3.5"><StatusChip status={g.status} size="xs" /></td>
                  <td className="px-5 py-3.5 text-right text-slate-400 text-xs">{expanded === g.id ? 'Hide' : 'View'}</td>
                </tr>,
                expanded === g.id ? (
                  <tr key={`${g.id}-details`}>
                    <td colSpan={8} className="px-5 py-4 bg-slate-50/70 border-t border-slate-100">
                      <div className="grid lg:grid-cols-[1fr,1.6fr] gap-4 text-xs">
                        <div className="bg-white rounded-lg border border-slate-100 p-4 space-y-3">
                          <div>
                            <p className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">Invite / Ownership</p>
                            <div className="mt-3 space-y-2 text-slate-600">
                              <p><span className="font-semibold text-slate-700">Invite Code:</span> {g.code}</p>
                              <p><span className="font-semibold text-slate-700">Formation Mode:</span> {g.mode}</p>
                              <p><span className="font-semibold text-slate-700">Submission Owner:</span> Group</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button disabled={busyId === g.id || g.status !== 'Pending Review'} onClick={() => runAction(g.id, () => adminService.approveGroup(g.id))} className="px-3 py-2 rounded-lg bg-blue-800 text-white font-semibold disabled:opacity-50" aria-label={`Approve group ${g.name}`}>Approve</button>
                            <button disabled={busyId === g.id || g.status === 'Locked'} onClick={() => runAction(g.id, () => adminService.lockGroup(g.id))} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold disabled:opacity-50" aria-label={`Lock group ${g.name}`}>Lock</button>
                            <button disabled={busyId === g.id || g.status !== 'Locked'} onClick={() => runAction(g.id, () => adminService.unlockGroup(g.id))} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold disabled:opacity-50" aria-label={`Unlock group ${g.name}`}>Unlock</button>
                            <button onClick={() => navigate(`/admin/submissions?group=${encodeURIComponent(g.id)}`)} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold inline-flex items-center gap-2" aria-label={`Open submissions for group ${g.name}`}><FolderOpen size={14} /> Related submissions</button>
                          </div>
                        </div>
                        <div className="bg-white rounded-lg border border-slate-100 p-4">
                          <p className="text-slate-400 uppercase tracking-wider text-[10px] font-semibold">Members</p>
                          <div className="mt-3 grid sm:grid-cols-2 gap-2">{(g.memberDetails || g.members.map((name, index) => ({ id: String(index + 1), name, isLeader: index === 0 }))).map((member) => <div key={member.id} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 text-slate-700 space-y-2"><div className="flex items-center justify-between gap-2"><span className="truncate">{member.name}</span>{member.isLeader && <span className="text-[10px] font-bold text-blue-700">Leader</span>}</div><div className="flex gap-2"><button disabled={busyId === g.id || member.isLeader} onClick={() => runAction(g.id, () => adminService.assignGroupLeader(g.id, member.id))} className="px-2 py-1 rounded border border-slate-200 bg-white text-[11px] font-semibold disabled:opacity-50" aria-label={`Assign ${member.name} as leader for group ${g.name}`}>Assign leader</button><button disabled={busyId === g.id || g.members.length <= 1} onClick={() => runAction(g.id, () => adminService.removeGroupMember(g.id, member.id))} className="px-2 py-1 rounded border border-rose-200 bg-rose-50 text-[11px] font-semibold text-rose-700 disabled:opacity-50" aria-label={`Remove ${member.name} from group ${g.name}`}>Remove</button></div></div>)}</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null,
              ])}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
