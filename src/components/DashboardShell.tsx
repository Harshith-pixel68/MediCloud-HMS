import { useEffect, useState, type ReactNode } from 'react';
import {
  CalendarClock,
  Database,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  RotateCcw,
  Stethoscope,
  Users,
  X,
} from 'lucide-react';
import type { ActiveSection, AuthUserProfile, StorageModeInfo } from '../types/hospital';

interface DashboardShellProps {
  activeSection: ActiveSection;
  onNavigate: (section: ActiveSection) => void;
  user: AuthUserProfile;
  modeInfo: StorageModeInfo;
  onSignOut: () => void;
  onResetDemoData?: () => void;
  resettingDemo?: boolean;
  onPrimaryAction: () => void;
  children: ReactNode;
}

const NAV_ITEMS: Array<{
  id: ActiveSection;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'patients', label: 'Patients', icon: Users },
  { id: 'doctors', label: 'Doctors', icon: Stethoscope },
  { id: 'appointments', label: 'Appointments', icon: CalendarClock },
];

const SECTION_META: Record<ActiveSection, { title: string; actionLabel: string }> = {
  dashboard: { title: 'Dashboard', actionLabel: 'Book Appointment' },
  patients: { title: 'Patient Management', actionLabel: 'Register Patient' },
  doctors: { title: 'Doctor Directory', actionLabel: 'Add Doctor' },
  appointments: { title: 'Appointments', actionLabel: 'Book Appointment' },
};

export function DashboardShell({
  activeSection,
  onNavigate,
  user,
  modeInfo,
  onSignOut,
  onResetDemoData,
  resettingDemo = false,
  onPrimaryAction,
  children,
}: DashboardShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  const meta = SECTION_META[activeSection];

  function handleSelectSection(section: ActiveSection) {
    onNavigate(section);
    setMobileMenuOpen(false);
  }

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[#0B2239] text-white">
      <div>
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0284C7] text-white">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </div>
            <span className="font-display text-base font-bold tracking-tight whitespace-nowrap">
              MediCloud HMS
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
            className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="mt-5 px-3" aria-label="Hospital administration navigation">
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => handleSelectSection(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#0284C7] text-white'
                      : 'text-slate-300 hover:bg-[#133150] hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Bottom Storage & Session Panel */}
      <div className="space-y-3 border-t border-white/10 p-4">
        <div className="rounded-lg border border-white/15 bg-[#102D4B] p-3 text-xs">
          <div className="flex items-center gap-2 font-semibold text-white">
            <Database className="h-3.5 w-3.5 shrink-0 text-[#38BDF8]" />
            <span>{modeInfo.mode === 'demo' ? 'Demo Storage' : 'Azure SQL Database'}</span>
          </div>
          <p className="mt-1 leading-relaxed text-slate-300">
            {modeInfo.mode === 'demo'
              ? 'Temporary in-memory sample dataset. Not persisted to Azure.'
              : `Persistent DB: ${modeInfo.databaseName || 'Azure SQL'}`}
          </p>
          {modeInfo.mode === 'demo' && onResetDemoData && (
            <button
              type="button"
              onClick={onResetDemoData}
              disabled={resettingDemo}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-60"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{resettingDemo ? 'Restoring...' : 'Reset Sample Data'}</span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{user.fullName}</p>
            <p className="truncate text-xs text-slate-400">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            title="Sign Out"
            aria-label="Sign Out"
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#0B2239]">
      {/* Desktop Fixed Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#0B2239]/60"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-50 w-72 max-w-[85vw]">{sidebarContent}</aside>
        </div>
      )}

      {/* Main Content Wrapper */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="hidden text-slate-500 sm:inline whitespace-nowrap">
                Hospital Administration
              </span>
              <span className="hidden text-slate-300 sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="truncate font-display text-base font-semibold text-[#0B2239] sm:text-lg">
                {meta.title}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={onPrimaryAction}
              className="flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0369A1]"
            >
              <Plus className="h-4 w-4" />
              <span>{meta.actionLabel}</span>
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
