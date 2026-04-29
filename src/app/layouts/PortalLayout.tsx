import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  getAuthSession,
  subscribeAuthSession,
  type AuthSession,
} from "../lib/mockAuth";
import {
  adminService,
  authService,
  profileService,
  studentCatalogService,
  teacherNotificationService,
} from "../lib/api/services";
import { fadeInVariants, slideInVariants, springTransition } from "../lib/motion";
import { subscribeNotificationBadgeInvalidation } from "../lib/notificationBadges";
import { roleThemeStyle, roleThemes, type PortalRole } from "../lib/roleTheme";
import { useTheme } from "../context/ThemeContext";
import { TopbarNotificationMenu } from "../components/portal/TopbarNotificationMenu";
import { ProjTrackLogo } from "../components/brand/ProjTrackLogo";
import { cn } from "../components/ui/utils";
import {
  LayoutDashboard, BookOpen, FileCheck2, Bell, UserCircle,
  Users, ClipboardList, GraduationCap, Layers, BarChart3,
  Settings2, Settings, Wrench, ShieldCheck,
  LogOut, Menu, X, Search,
  FileBadge, Grid3X3, CalendarDays, Megaphone, Mail, FolderOpen, ShieldAlert, ClipboardCheck,
  Moon, Sun, Building2, UserCog, Database,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  badge?: number;
  section?: string;
}

const STUDENT_NAV: NavItem[] = [
  { to: "/student/dashboard",     icon: LayoutDashboard, label: "Dashboard",      section: "main" },
  { to: "/student/subjects",      icon: BookOpen,        label: "Subjects",        section: "main" },
  { to: "/student/submissions",   icon: FileCheck2,      label: "My Submissions",  section: "main" },
  { to: "/student/calendar",      icon: CalendarDays,    label: "Calendar",        section: "main" },
  { to: "/student/notifications", icon: Bell,            label: "Notifications",   section: "main" },
  { to: "/student/profile",       icon: UserCircle,      label: "Profile",         section: "account" },
];

const TEACHER_NAV: NavItem[] = [
  { to: "/teacher/dashboard",     icon: LayoutDashboard, label: "Dashboard",   section: "main" },
  { to: "/teacher/subjects",      icon: BookOpen,        label: "Subjects",    section: "main" },
  { to: "/teacher/students",      icon: Users,           label: "Students",    section: "main" },
  { to: "/teacher/submissions",   icon: ClipboardList,   label: "Submissions", badge: 7, section: "main" },
  { to: "/teacher/notifications", icon: Bell,            label: "Notifications", section: "main" },
  { to: "/teacher/profile",       icon: UserCircle,      label: "Profile",     section: "account" },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/admin/dashboard",          icon: LayoutDashboard, label: "Dashboard",          section: "main" },
  { to: "/admin/users",              icon: UserCog,         label: "Users",              section: "main" },
  { to: "/admin/students",           icon: GraduationCap,   label: "Students",           section: "main" },
  { to: "/admin/teachers",           icon: Users,           label: "Teachers",           section: "main" },
  { to: "/admin/departments",        icon: Building2,       label: "Departments",        section: "main" },
  { to: "/admin/subjects",           icon: BookOpen,        label: "Subjects",           section: "main" },
  { to: "/admin/sections",           icon: Grid3X3,         label: "Academic Years",     section: "main" },
  { to: "/admin/submissions",        icon: FileBadge,       label: "Submissions",        section: "main" },
  { to: "/admin/reports",            icon: BarChart3,       label: "Reports",            section: "operations" },
  { to: "/admin/groups",             icon: Users,           label: "Groups",             section: "operations" },
  { to: "/admin/announcements",      icon: Megaphone,       label: "Announcements",      section: "operations" },
  { to: "/admin/calendar",           icon: CalendarDays,    label: "Calendar",           section: "operations" },
  { to: "/admin/academic-settings",  icon: Settings2,       label: "Academic Settings",  section: "operations" },
  { to: "/admin/notifications",      icon: Bell,            label: "Notifications",      section: "operations" },
  { to: "/admin/audit-logs",         icon: ClipboardList,   label: "Audit Logs",         section: "system" },
  { to: "/admin/settings",           icon: Settings,        label: "Settings",           section: "system" },
  { to: "/admin/system-tools",       icon: Wrench,          label: "System Tools",       section: "system" },
  { to: "/admin/backups",            icon: Database,        label: "Backups",            section: "system" },
  { to: "/admin/mail-jobs",          icon: Mail,            label: "Mail Jobs",          section: "system" },
  { to: "/admin/file-inventory",      icon: FolderOpen,      label: "File Inventory",     section: "system" },
  { to: "/admin/system-health",       icon: ShieldAlert,    label: "System Health",      section: "system" },
  { to: "/admin/release-status",      icon: ClipboardCheck,  label: "Release Status",     section: "system" },
  { to: "/admin/bootstrap-guide",     icon: ShieldCheck,     label: "Deployment Checklist", section: "system" },
  { to: "/admin/profile",             icon: UserCircle,      label: "Profile",            section: "account" },
];

const roleConfig: Record<PortalRole, {
  nav: NavItem[];
  label: string;
  user: { name: string; sub: string; initials: string };
}> = {
  student: {
    nav: STUDENT_NAV,
    label: roleThemes.student.label,
    user: { name: "Student Account", sub: "Student workspace", initials: "ST" },
  },
  teacher: {
    nav: TEACHER_NAV,
    label: roleThemes.teacher.label,
    user: { name: "Teacher Account", sub: "Teacher workspace", initials: "TC" },
  },
  admin: {
    nav: ADMIN_NAV,
    label: roleThemes.admin.label,
    user: { name: "Admin Account", sub: "Administrator workspace", initials: "AD" },
  },
};

function UserAvatar({
  src,
  name,
  initials,
  className,
}: {
  src?: string;
  name: string;
  initials: string;
  className: string;
}) {
  if (src) {
    return <img src={src} alt={name} className={cn(className, "object-cover")} />;
  }

  return (
    <div
      className={cn(
        "portal-avatar-accent flex items-center justify-center text-sm font-bold",
        className,
      )}
    >
      {initials}
    </div>
  );
}

function NavTooltip({ label, children, show }: { key?: string; label: string; children: React.ReactNode; show: boolean }) {
  const [vis, setVis] = useState(false);
  const reducedMotion = useReducedMotion() ?? false;
  if (!show) return <>{children}</>;
  return (
    <div className="relative" onMouseEnter={() => setVis(true)} onMouseLeave={() => setVis(false)}>
      {children}
      <AnimatePresence>
        {vis && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={slideInVariants(reducedMotion, { axis: "x", distance: -6 })}
            className="absolute left-full ml-3 z-50 pointer-events-none"
          >
            <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium whitespace-nowrap shadow-lg">
              {label}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SidebarProps {
  role: PortalRole;
  collapsed: boolean;
  isMobile: boolean;
  notificationBadgeCount: number | null;
  session: AuthSession | null;
  avatarSrc: string;
  onClose?: () => void;
}

function SidebarContent({
  role,
  collapsed,
  isMobile,
  notificationBadgeCount,
  session,
  avatarSrc,
  onClose,
}: SidebarProps) {
  const cfg = roleConfig[role];
  const profileTarget = `/${role}/profile`;
  const notificationsTarget = `/${role}/notifications`;
  const userInfo = session ? {
    ...cfg.user,
    name: session.displayName,
    sub: role === 'student' ? `${session.identifier} · BSIT 3A` : role === 'teacher' ? `${session.identifier} · Teacher` : `${session.identifier} · Super Admin`,
    initials: session.displayName.split(' ').map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || cfg.user.initials,
  } : cfg.user;
  const navigate = useNavigate();
  const location = useLocation();
  const isCollapsed = isMobile ? false : collapsed;

  const sections: Record<string, string> = {
    main: "Main Menu",
    operations: "Operations",
    system: "System",
    account: "Account",
  };

  const groupedNav = cfg.nav.reduce<Record<string, NavItem[]>>((acc, item) => {
    const sec = item.section || "main";
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(item);
    return acc;
  }, {});

  return (
    <div className="portal-sidebar-shell relative flex h-full flex-col overflow-hidden rounded-[var(--radius-hero)] border border-white/65 shadow-[var(--shadow-shell)] backdrop-blur-xl dark:border-slate-700/60">
      <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.85),transparent_70%)] dark:bg-[radial-gradient(circle_at_top,rgba(51,65,85,0.32),transparent_70%)]" />
      {/* Logo */}
      <div
        className={`relative flex min-h-[86px] shrink-0 items-center border-b border-slate-200/70 dark:border-slate-700/60 ${isCollapsed ? "justify-center px-3 py-4" : "justify-between px-4 py-4"}`}
        data-testid="portal-sidebar-brand"
      >
        <div className={`flex min-w-0 items-center overflow-hidden ${isCollapsed ? "justify-center" : "flex-1 gap-3"}`}>
          <ProjTrackLogo
            role={role}
            compact={isCollapsed}
            showRoleDot={!isCollapsed}
            subtitle={cfg.label.toUpperCase()}
            textClassName="overflow-visible"
          />
        </div>
        {isMobile ? (
          <button onClick={onClose}
            aria-label={`Close ${cfg.label} navigation`}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/70 bg-white/80 text-slate-400 hover:text-slate-600 hover:bg-white dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-800">
            <X size={15} />
          </button>
        ) : null}
      </div>

      {/* Nav */}
      <div className={`relative flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-none ${isCollapsed ? "px-2.5" : "px-3"}`}>
        {Object.entries(groupedNav).map(([section, items], si) => (
          <div key={section} className={si > 0 ? "pt-2" : ""}>
            <AnimatePresence>
              {!isCollapsed && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="px-3 pb-2 text-[11px] text-slate-400 dark:text-slate-500 uppercase tracking-[0.18em] font-semibold select-none">
                  {sections[section]}
                </motion.p>
              )}
            </AnimatePresence>
            {isCollapsed && si > 0 && <div className="my-2 mx-2 border-t border-slate-100 dark:border-slate-700/50" />}
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
              const itemBadge =
                item.to === notificationsTarget
                  ? notificationBadgeCount && notificationBadgeCount > 0
                    ? notificationBadgeCount
                    : undefined
                  : item.badge;
              return (
                <NavTooltip key={item.to} label={item.label} show={isCollapsed}>
                  <NavLink to={item.to}
                    onClick={() => { if (isMobile && onClose) onClose(); }}
                  className={`relative flex items-center transition-all duration-150 group
                      ${isCollapsed ? "mx-auto h-12 w-12 justify-center rounded-[22px]" : "gap-3.5 px-4 py-3 rounded-[22px]"}
                      ${isActive ? `portal-nav-active ${isCollapsed ? "shadow-sm ring-1 ring-black/5 dark:ring-white/10" : "shadow-[0_16px_36px_-30px_rgba(15,23,42,0.55)]"}` : "text-slate-500 hover:text-slate-800 hover:bg-white/75 dark:text-slate-300 dark:hover:text-slate-100 dark:hover:bg-slate-800/75"}`}
                  >
                    {isActive && (
                      <motion.div layoutId={`indicator-${role}`}
                        className={`portal-nav-indicator absolute top-1/2 -translate-y-1/2 rounded-r-full ${isCollapsed ? "left-1 h-6 w-0.5" : "left-0 h-5 w-0.5"}`}
                        transition={{ type: "spring", stiffness: 500, damping: 42 }} />
                    )}
                    <div className={`relative shrink-0 ${isCollapsed ? "flex h-12 w-12 items-center justify-center" : ""}`}>
                      <Icon size={19} strokeWidth={isActive ? 2.2 : 1.9} />
                      {isCollapsed && itemBadge !== undefined && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500" />
                      )}
                    </div>
                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.15 }}
                          className="flex-1 flex items-center justify-between overflow-hidden">
                          <span className="text-[15px] font-semibold whitespace-nowrap">{item.label}</span>
                          {itemBadge !== undefined && (
                            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full shrink-0
                              ${isActive ? "bg-white/75 text-slate-800 dark:bg-slate-100 dark:text-slate-900" : "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-200"}`}>
                              {itemBadge}
                            </span>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </NavLink>
                </NavTooltip>
              );
            })}
          </div>
        ))}
      </div>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-slate-200/70 dark:border-slate-700/60 shrink-0 space-y-2">
        <NavTooltip label="Logout" show={isCollapsed}>
          <button onClick={async () => { await authService.logout(); navigate(`/${role}/login`); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-[22px] text-slate-400 hover:text-rose-600
              hover:bg-rose-50 transition-all dark:text-slate-400 dark:hover:bg-rose-500/12 ${isCollapsed ? "justify-center" : ""}`}>
            <LogOut size={18} strokeWidth={1.9} />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.15 }}
                  className="text-[15px] font-medium overflow-hidden whitespace-nowrap">
                  Logout
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </NavTooltip>
        <NavTooltip label={userInfo.name} show={isCollapsed}>
          <button
            type="button"
            onClick={() => {
              navigate(profileTarget);
              if (isMobile && onClose) onClose();
            }}
            aria-label={`Open ${role} profile from sidebar`}
            className={`w-full flex items-center gap-3 rounded-[22px] text-left border border-white/70 bg-white/72 shadow-[0_18px_38px_-34px_rgba(15,23,42,0.45)] hover:bg-white transition-colors dark:border-slate-700/60 dark:bg-slate-900/80 dark:hover:bg-slate-800 ${isCollapsed ? "justify-center px-0 py-3" : "px-4 py-3.5"}`}
          >
            <UserAvatar
              src={avatarSrc}
              name={userInfo.name}
              initials={userInfo.initials}
              className="h-10 w-10 rounded-[var(--radius-card)] shrink-0"
            />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden min-w-0">
                  <p className="text-slate-800 dark:text-slate-100 text-sm font-semibold whitespace-nowrap truncate">{userInfo.name}</p>
                  <p className="text-slate-400 dark:text-slate-400 text-[11px] whitespace-nowrap truncate">{userInfo.sub}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </NavTooltip>
      </div>
    </div>
  );
}

export function PortalLayout({ role }: { role: PortalRole }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [topbarSearch, setTopbarSearch] = useState("");
  const [notificationBadgeCount, setNotificationBadgeCount] = useState<number | null>(null);
  const [session, setSession] = useState<AuthSession | null>(() => getAuthSession());
  const [avatarSrc, setAvatarSrc] = useState("");
  const { isDark, onToggleDark } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion() ?? false;

  useEffect(() => {
    return subscribeAuthSession((nextSession) => {
      setSession(nextSession);
    });
  }, []);

  useEffect(() => {
    const check = () => { setIsMobile(window.innerWidth < 1024); };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    let active = true;

    const loadNotificationBadge = async () => {
      try {
        const notifications =
          role === "student"
            ? await studentCatalogService.getNotifications()
            : role === "teacher"
              ? await teacherNotificationService.getNotifications()
              : await adminService.getNotifications();

        if (!active) return;
        setNotificationBadgeCount(notifications.filter((item) => !item.read).length);
      } catch {
        if (!active) return;
        setNotificationBadgeCount(null);
      }
    };

    const handleFocus = () => {
      void loadNotificationBadge();
    };

    const unsubscribe = subscribeNotificationBadgeInvalidation((detail) => {
      if (detail.role !== role) return;
      void loadNotificationBadge();
    });

    void loadNotificationBadge();
    window.addEventListener("focus", handleFocus);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("focus", handleFocus);
    };
  }, [role, location.pathname]);

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    if (!session?.avatarRelativePath) {
      setAvatarSrc("");
      return () => undefined;
    }

    profileService
      .getAvatarObjectUrl(session.avatarRelativePath, session.avatarVersion ?? Date.now())
      .then((url) => {
        if (!active) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setAvatarSrc(url);
      })
      .catch((avatarError) => {
        console.warn("Unable to load portal avatar preview.", avatarError);
        if (active) setAvatarSrc("");
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [session?.avatarRelativePath, session?.avatarVersion]);

  const cfg = roleConfig[role];
  const userInfo = session ? {
    ...cfg.user,
    name: session.displayName,
    sub: role === 'student' ? `${session.identifier} · BSIT 3A` : role === 'teacher' ? `${session.identifier} · Teacher` : `${session.identifier} · Super Admin`,
    initials: session.displayName.split(' ').map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || cfg.user.initials,
  } : cfg.user;

  // Topbar title from path
  const pathLabel = (() => {
    const all = [...STUDENT_NAV, ...TEACHER_NAV, ...ADMIN_NAV];
    const match = all.find((n) => location.pathname === n.to || location.pathname.startsWith(n.to + "/"));
    return match?.label ?? "Dashboard";
  })();

  const handleTopbarSearch = () => {
    const query = topbarSearch.trim().toLowerCase();
    if (!query) return;
    const match = cfg.nav.find((item) => item.label.toLowerCase().includes(query));
    if (match) {
      navigate(match.to);
      setTopbarSearch("");
    }
  };

  const notificationsTarget = `/${role}/notifications`;
  const profileTarget = `/${role}/profile`;
  const isNotificationsPage =
    location.pathname === notificationsTarget || location.pathname.startsWith(`${notificationsTarget}/`);

  return (
    <div
      className={cn(
        "relative flex h-screen w-full overflow-hidden bg-[var(--surface-canvas)] dark:bg-[var(--surface-canvas)]",
        `portal-role-${role}`,
      )}
      style={roleThemeStyle(role)}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.92),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(255,255,255,0.75),transparent_28%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(30,41,59,0.8),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(15,23,42,0.8),transparent_28%)]" />
      <div className="portal-shell-gradient pointer-events-none absolute inset-x-0 top-0 h-[32rem]" />
      <div className="pointer-events-none absolute -left-20 top-24 h-72 w-72 rounded-full bg-white/45 blur-3xl dark:bg-blue-900/15" />
      <div className="pointer-events-none absolute right-[-5rem] top-10 h-80 w-80 rounded-full bg-white/30 blur-3xl dark:bg-slate-700/20" />
      {/* Desktop sidebar */}
      {!isMobile && (
        <motion.div animate={{ width: collapsed ? 112 : 288 }} transition={springTransition(reducedMotion, { stiffness: 400, damping: 38 })}
          className="shrink-0 h-full overflow-hidden p-3">
          <SidebarContent
            role={role}
            collapsed={collapsed}
            isMobile={false}
            notificationBadgeCount={notificationBadgeCount}
            session={session}
            avatarSrc={avatarSrc}
          />
        </motion.div>
      )}

      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobile && mobileOpen && (
          <>
            <motion.div key="backdrop" initial="hidden" animate="visible" exit="exit" variants={fadeInVariants(reducedMotion)}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" />
            <motion.div key="drawer" initial="hidden" animate="visible" exit="exit"
              variants={slideInVariants(reducedMotion, { axis: "x", distance: -296 })}
              transition={springTransition(reducedMotion, { stiffness: 380, damping: 40 })}
              className="fixed top-0 left-0 bottom-0 z-50 w-[280px] p-3">
              <SidebarContent
                role={role}
                collapsed={false}
                isMobile={true}
                notificationBadgeCount={notificationBadgeCount}
                session={session}
                avatarSrc={avatarSrc}
                onClose={() => setMobileOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden pb-3 pr-3">
        {/* Topbar */}
        <header className="mt-3 flex h-[72px] items-center gap-4 rounded-[var(--radius-panel)] border border-white/65 bg-[var(--surface-shell)] px-4 shadow-[0_20px_65px_-42px_rgba(15,23,42,0.5)] backdrop-blur-xl dark:border-slate-700/60 dark:bg-[var(--surface-shell)] sm:px-6">
          <button
            onClick={() => {
              if (isMobile) {
                setMobileOpen(true);
                return;
              }
              setCollapsed((value) => !value);
            }}
            aria-label={
              isMobile
                ? `Open ${cfg.label} navigation`
                : collapsed
                  ? `Expand ${cfg.label} sidebar`
                  : `Collapse ${cfg.label} sidebar`
            }
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/70 bg-white/80 text-slate-500 transition-colors hover:bg-white dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {isMobile ? <Menu size={18} /> : collapsed ? <Menu size={18} /> : <Menu size={18} />}
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-display truncate text-base font-semibold tracking-[-0.03em] text-slate-900 dark:text-slate-100">{pathLabel}</p>
              <span className="portal-topbar-pill hidden rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] sm:inline-flex">
                {cfg.label}
              </span>
            </div>
            <p className="portal-accent-text text-[10px] font-semibold uppercase tracking-[0.22em]">{cfg.label}</p>
          </div>
          <div className="flex-1" />
          {/* Search */}
          <div className="portal-search-focus hidden w-56 items-center gap-2 rounded-[var(--radius-card)] border border-slate-200/80 bg-white/70 px-4 py-2 transition-all dark:border-slate-700/60 dark:bg-slate-900/70 sm:flex">
            <Search size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
            <input
              value={topbarSearch}
              onChange={(event) => setTopbarSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleTopbarSearch();
                }
              }}
              placeholder="Go to…"
              aria-label={`Quick navigation for ${cfg.label}`}
              className="bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none flex-1 w-0 dark:text-slate-200 dark:placeholder-slate-500"
            />
          </div>
          <button
            onClick={onToggleDark}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={isDark}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/70 bg-white/70 text-slate-500 transition-colors hover:bg-white dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <TopbarNotificationMenu
            role={role}
            badgeCount={notificationBadgeCount}
            notificationsTarget={notificationsTarget}
            isActive={isNotificationsPage}
            onNavigate={navigate}
          />
          {/* Avatar */}
          <button
            onClick={() => navigate(profileTarget)}
            aria-label={`Open ${role} profile`}
            className="shrink-0"
          >
            <UserAvatar
              src={avatarSrc}
              name={userInfo.name}
              initials={userInfo.initials}
              className="h-10 w-10 rounded-[var(--radius-card)] shadow-lg shadow-slate-900/10"
            />
          </button>
        </header>

        {/* Page content */}
        <main className="portal-theme-surface relative flex-1 overflow-y-auto pt-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
