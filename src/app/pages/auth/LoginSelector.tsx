import { ArrowRight, BookOpen, GraduationCap, ShieldCheck } from "lucide-react";
import { Link } from "react-router";

const roles = [
  {
    title: "Student Portal",
    subtitle: "Submit projects, track progress, and monitor deadlines.",
    to: "/student/login",
    icon: GraduationCap,
    ring: "ring-blue-200",
    iconBg: "bg-blue-800",
    hover: "hover:border-blue-200 hover:shadow-blue-800/10",
  },
  {
    title: "Teacher Portal",
    subtitle: "Review submissions, manage subjects, and notify students.",
    to: "/teacher/login",
    icon: BookOpen,
    ring: "ring-teal-200",
    iconBg: "bg-teal-600",
    hover: "hover:border-teal-200 hover:shadow-teal-700/10",
  },
  {
    title: "Admin Portal",
    subtitle: "Manage users, reports, announcements, and system tools.",
    to: "/admin/login",
    icon: ShieldCheck,
    ring: "ring-slate-200",
    iconBg: "bg-slate-800",
    hover: "hover:border-slate-200 hover:shadow-slate-800/10",
  },
] as const;

export default function LoginSelector() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-5xl space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-blue-800 text-white flex items-center justify-center">
              <GraduationCap size={18} />
            </div>
            <div className="text-left">
              <p className="text-slate-900 font-bold text-sm leading-none">PROJTRACK</p>
              <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-[0.18em] mt-1">Choose your portal</p>
            </div>
          </div>
          <h1 className="text-slate-900 font-bold mt-6" style={{ fontSize: "2.2rem", letterSpacing: "-0.04em" }}>Login to your workspace</h1>
          <p className="text-slate-500 max-w-2xl mx-auto mt-3 text-sm">
            Choose the correct PROJTRACK portal for students, teachers, or administrators.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <Link key={role.to} to={role.to} className={`group bg-white rounded-3xl border border-slate-200 shadow-sm p-6 transition-all ${role.hover}`}>
                <div className={`w-12 h-12 rounded-2xl ${role.iconBg} text-white flex items-center justify-center ring-4 ${role.ring}`}>
                  <Icon size={20} />
                </div>
                <h2 className="text-slate-900 font-bold text-lg mt-5">{role.title}</h2>
                <p className="text-slate-500 text-sm leading-6 mt-2 min-h-[72px]">{role.subtitle}</p>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 group-hover:text-slate-900">
                  Continue <ArrowRight size={15} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
