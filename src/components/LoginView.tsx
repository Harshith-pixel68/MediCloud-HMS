import { useState, type FormEvent } from 'react';
import { ArrowRight, Database, Lock, RefreshCw, ShieldCheck, UserCheck } from 'lucide-react';
import { ApiError, hospitalApi, type AuthResponse } from '../lib/apiClient';
import type { AuthStatusResponse } from '../types/hospital';

interface LoginViewProps {
  authStatus: AuthStatusResponse | null;
  loadingStatus: boolean;
  statusError?: string | null;
  onRetryStatus?: () => void;
  onAuthenticated: (auth: AuthResponse) => void;
}

export function LoginView({
  authStatus,
  loadingStatus,
  statusError,
  onRetryStatus,
  onAuthenticated,
}: LoginViewProps) {
  const [mode, setMode] = useState<'login' | 'setup'>('login');
  const [fullName, setFullName] = useState('Hospital Administrator');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDemoMode = authStatus?.modeInfo.mode === 'demo';
  const needsSetup = Boolean(authStatus?.needsFirstRunSetup) && !isDemoMode;
  const activeMode = needsSetup ? 'setup' : mode;

  async function handleFormSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      if (activeMode === 'setup') {
        const result = await hospitalApi.setupAdmin(fullName, email, password);
        onAuthenticated(result);
      } else {
        const result = await hospitalApi.login(email, password);
        onAuthenticated(result);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Unable to connect to the hospital administration server.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemoLogin() {
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const result = await hospitalApi.demoLogin();
      onAuthenticated(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Unable to initialize demo administrator session.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] lg:grid lg:grid-cols-12">
      {/* Left Institutional Brand & Architecture Panel */}
      <div className="flex flex-col justify-between bg-[#0B2239] px-8 py-10 text-white lg:col-span-5 lg:px-12 lg:py-14">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0284C7] text-white">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </div>
            <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap">
              MediCloud HMS
            </span>
          </div>

          <div className="mt-12 max-w-md">
            <p className="text-xs font-medium tracking-wide text-[#7DD3FC]">
              Microsoft Azure Compatible Architecture
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight text-white text-balance lg:text-4xl">
              Cloud-Based Hospital Management System
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              Centralized clinical administration portal for patient registration, physician
              rosters, and outpatient appointment scheduling, engineered for Azure App Service and
              Azure SQL Database.
            </p>
          </div>

          <div className="mt-10 space-y-4 border-t border-white/10 pt-8 text-sm">
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 h-4 w-4 shrink-0 text-[#38BDF8]" />
              <div>
                <p className="font-medium text-white">Separated Storage Layers</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
                  Demo Mode operates strictly in temporary server memory. Production mode connects
                  to Microsoft Azure SQL Database via parameterized T-SQL queries.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#38BDF8]" />
              <div>
                <p className="font-medium text-white">Protected Clinical Endpoints</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
                  All patient, doctor, and appointment REST routes require verified administrator
                  session tokens.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-slate-400">
          Academic Cloud Engineering Project · Azure App Service &amp; Azure SQL Ready
        </div>
      </div>

      {/* Right Authentication Panel */}
      <div className="flex items-center justify-center px-6 py-12 lg:col-span-7 lg:px-16">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="border-b border-slate-100 pb-5">
            <h2 className="text-2xl font-bold text-[#0B2239]">
              {activeMode === 'setup' ? 'Initial Administrator Setup' : 'Administrator Sign In'}
            </h2>
            <p className="mt-1.5 text-sm text-slate-600">
              {activeMode === 'setup'
                ? 'Create the first administrator account in Azure SQL Database to secure this deployment.'
                : 'Sign in to access hospital operations, patient records, and scheduling.'}
            </p>
          </div>

          {/* Environment Storage Disclosure / Status Error Retry */}
          {loadingStatus && !authStatus && (
            <div className="mt-5 h-16 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
          )}

          {!loadingStatus && statusError && !authStatus && (
            <div
              role="alert"
              className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800"
            >
              <span>{statusError}</span>
              {onRetryStatus && (
                <button
                  type="button"
                  onClick={onRetryStatus}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-red-200 bg-white px-2.5 py-1.5 font-semibold text-red-800 transition-colors hover:bg-red-100"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          )}

          {!loadingStatus && authStatus && (
            <div
              className={`mt-5 rounded-lg border px-4 py-3 text-xs leading-relaxed ${
                isDemoMode
                  ? 'border-sky-200 bg-sky-50 text-[#0B2239]'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-950'
              }`}
            >
              <div className="font-semibold">
                Active Environment: {authStatus.modeInfo.label}
              </div>
              <p className="mt-1 text-slate-600">
                {isDemoMode
                  ? 'Running in standalone Demo Mode with sample hospital data. Changes reset when the server restarts and are not stored in Azure SQL.'
                  : `Connected to Azure SQL database (${authStatus.modeInfo.databaseName || 'configured'}). Changes are persisted.`}
              </p>
            </div>
          )}

          {/* One-Click Demo Login (only when Demo Mode is active) */}
          {isDemoMode && authStatus?.demoLoginAvailable && (
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[#0B2239]">Demo Administrator Access</p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Role: Hospital Administrator · No Azure subscription required
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={submitting}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0284C7] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0369A1] disabled:opacity-60"
              >
                <UserCheck className="h-4 w-4" />
                <span>{submitting ? 'Signing In...' : 'Sign in as Demo Administrator'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {errorMessage}
            </div>
          )}

          {/* Standard Credential Form */}
          <form onSubmit={handleFormSubmit} className="mt-6 space-y-4">
            {isDemoMode && (
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {activeMode === 'setup'
                    ? 'Register a custom demo admin account'
                    : 'Or sign in with configured / registered credentials'}
                </span>
                {authStatus?.needsFirstRunSetup && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setMode(mode === 'login' ? 'setup' : 'login');
                    }}
                    className="font-medium text-[#0284C7] hover:underline whitespace-nowrap"
                  >
                    {mode === 'login' ? 'Create Account' : 'Back to Login'}
                  </button>
                )}
              </div>
            )}

            {activeMode === 'setup' && (
              <div>
                <label htmlFor="admin-fullname" className="block text-sm font-medium text-[#0B2239]">
                  Administrator Full Name
                </label>
                <input
                  id="admin-fullname"
                  type="text"
                  autoComplete="name"
                  required
                  minLength={2}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Dr. Elena Vance"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#0B2239] outline-none transition-colors focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20"
                />
              </div>
            )}

            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium text-[#0B2239]">
                Administrator Email
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@hospital.local"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#0B2239] outline-none transition-colors focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium text-[#0B2239]">
                {activeMode === 'setup' ? 'Create Password (min. 8 characters)' : 'Password'}
              </label>
              <input
                id="admin-password"
                type="password"
                autoComplete={activeMode === 'setup' ? 'new-password' : 'current-password'}
                required
                minLength={activeMode === 'setup' ? 8 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter administrator password"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#0B2239] outline-none transition-colors focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || loadingStatus}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#0B2239] bg-[#0B2239] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#133150] disabled:opacity-60"
            >
              <Lock className="h-4 w-4" />
              <span>
                {submitting
                  ? 'Verifying...'
                  : activeMode === 'setup'
                    ? 'Create Administrator & Enter'
                    : 'Sign In'}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
