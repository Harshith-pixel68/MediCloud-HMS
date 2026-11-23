import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import { AppointmentsView } from './components/AppointmentsView';
import { DashboardShell } from './components/DashboardShell';
import { DashboardView } from './components/DashboardView';
import { DoctorsView } from './components/DoctorsView';
import { LoginView } from './components/LoginView';
import { PatientsView } from './components/PatientsView';
import {
  ApiError,
  hospitalApi,
  setAuthToken,
  setOnUnauthorized,
  type AuthResponse,
} from './lib/apiClient';
import type {
  ActiveSection,
  AuthStatusResponse,
  AuthUserProfile,
  DashboardSummary,
  StorageModeInfo,
} from './types/hospital';

interface ToastBanner {
  id: number;
  type: 'success' | 'error';
  message: string;
}

const VALID_SECTIONS = new Set<ActiveSection>([
  'dashboard',
  'patients',
  'doctors',
  'appointments',
]);

function readSectionFromHash(): ActiveSection {
  const cleaned = window.location.hash.replace(/^#\/?/, '') as ActiveSection;
  return VALID_SECTIONS.has(cleaned) ? cleaned : 'dashboard';
}

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [authStatusError, setAuthStatusError] = useState<string | null>(null);

  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [modeInfo, setModeInfo] = useState<StorageModeInfo>({
    mode: 'demo',
    label: 'Demo Mode (In-Memory Sample Data)',
    persistent: false,
    databaseName: null,
    serverHost: null,
  });

  const [activeSection, setActiveSectionState] = useState<ActiveSection>(readSectionFromHash);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardRefreshSeq, setDashboardRefreshSeq] = useState(0);

  const [patientAddSignal, setPatientAddSignal] = useState(0);
  const [doctorAddSignal, setDoctorAddSignal] = useState(0);
  const [appointmentAddSignal, setAppointmentAddSignal] = useState(0);

  const [resettingDemo, setResettingDemo] = useState(false);
  const [toast, setToast] = useState<ToastBanner | null>(null);

  const setActiveSection = useCallback((section: ActiveSection) => {
    setActiveSectionState(section);
    const targetHash = `#/${section}`;
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      setActiveSectionState(readSectionFromHash());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ id: Date.now(), type, message });
  }, []);

  const resetSessionUiState = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    setDashboardSummary(null);
    setPatientAddSignal(0);
    setDoctorAddSignal(0);
    setAppointmentAddSignal(0);
  }, []);

  const handleForcedLogout = useCallback(() => {
    resetSessionUiState();
  }, [resetSessionUiState]);

  useEffect(() => {
    setOnUnauthorized(handleForcedLogout);
    return () => setOnUnauthorized(null);
  }, [handleForcedLogout]);

  const loadAuthStatus = useCallback(async () => {
    setLoadingStatus(true);
    setAuthStatusError(null);
    try {
      const status = await hospitalApi.getAuthStatus();
      setAuthStatus(status);
      setModeInfo(status.modeInfo);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'Unable to reach hospital backend server.';
      setAuthStatusError(msg);
      showToast('error', msg);
    } finally {
      setLoadingStatus(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadAuthStatus();
  }, [loadAuthStatus]);

  const loadDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    try {
      const { summary, modeInfo: currentMode } = await hospitalApi.getDashboard();
      setDashboardSummary(summary);
      setModeInfo(currentMode);
      setDashboardRefreshSeq((n) => n + 1);
    } catch (err) {
      showToast(
        'error',
        err instanceof ApiError ? err.message : 'Failed to load hospital dashboard.'
      );
    } finally {
      setLoadingDashboard(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (user && activeSection === 'dashboard') {
      void loadDashboard();
    }
  }, [user, activeSection, loadDashboard]);

  function handleAuthenticated(auth: AuthResponse) {
    setAuthToken(auth.token);
    setUser(auth.user);
    setModeInfo(auth.modeInfo);
    setActiveSection('dashboard');
    showToast('success', `Signed in as ${auth.user.fullName}.`);
  }

  async function handleSignOut() {
    try {
      await hospitalApi.logout();
    } catch {
      // Clear local memory session regardless
    }
    resetSessionUiState();
    void loadAuthStatus();
  }

  async function handleResetDemoData() {
    setResettingDemo(true);
    try {
      const res = await hospitalApi.resetDemoData();
      showToast('success', res.message);
      if (activeSection === 'dashboard') {
        await loadDashboard();
      } else {
        setActiveSection('dashboard');
      }
    } catch (err) {
      showToast(
        'error',
        err instanceof ApiError ? err.message : 'Unable to reset sample data.'
      );
    } finally {
      setResettingDemo(false);
    }
  }

  function handlePrimaryHeaderAction() {
    if (activeSection === 'patients') {
      setPatientAddSignal((n) => n + 1);
    } else if (activeSection === 'doctors') {
      setDoctorAddSignal((n) => n + 1);
    } else if (activeSection === 'appointments') {
      setAppointmentAddSignal((n) => n + 1);
    } else {
      setActiveSection('appointments');
      setAppointmentAddSignal((n) => n + 1);
    }
  }

  if (!user) {
    return (
      <LoginView
        authStatus={authStatus}
        loadingStatus={loadingStatus}
        statusError={authStatusError}
        onRetryStatus={() => void loadAuthStatus()}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  return (
    <>
      <DashboardShell
        activeSection={activeSection}
        onNavigate={setActiveSection}
        user={user}
        modeInfo={modeInfo}
        onSignOut={() => void handleSignOut()}
        onResetDemoData={modeInfo.mode === 'demo' ? () => void handleResetDemoData() : undefined}
        resettingDemo={resettingDemo}
        onPrimaryAction={handlePrimaryHeaderAction}
      >
        {activeSection === 'dashboard' && (
          <DashboardView
            summary={dashboardSummary}
            loading={loadingDashboard}
            modeInfo={modeInfo}
            refreshSignal={dashboardRefreshSeq}
            onNavigate={setActiveSection}
            onBookAppointment={() => {
              setActiveSection('appointments');
              setAppointmentAddSignal((n) => n + 1);
            }}
          />
        )}

        {activeSection === 'patients' && (
          <PatientsView
            openAddSignal={patientAddSignal}
            storageMode={modeInfo.mode}
            onNotify={showToast}
            onDataChanged={() => {
              void loadDashboard();
            }}
          />
        )}

        {activeSection === 'doctors' && (
          <DoctorsView
            openAddSignal={doctorAddSignal}
            storageMode={modeInfo.mode}
            onNotify={showToast}
            onDataChanged={() => {
              void loadDashboard();
            }}
          />
        )}

        {activeSection === 'appointments' && (
          <AppointmentsView
            openAddSignal={appointmentAddSignal}
            storageMode={modeInfo.mode}
            onNotify={showToast}
            onDataChanged={() => {
              void loadDashboard();
            }}
          />
        )}
      </DashboardShell>

      {/* Non-intrusive Action Feedback Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-white text-[#0B2239]'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 text-red-600" />
          )}
          <span className="flex-1 text-xs font-medium">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            className="rounded p-1 text-slate-400 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
}
