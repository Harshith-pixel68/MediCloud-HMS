import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  Pencil,
  PlusCircle,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { ApiError, hospitalApi } from '../lib/apiClient';
import type { ActivityAction, ActivityEntityType, ActivityLogEntry } from '../types/hospital';

interface ActivityLogPanelProps {
  initialLogs: ActivityLogEntry[];
  refreshSignal?: number;
}

const ENTITY_TABS: ReadonlyArray<{ value: ActivityEntityType | 'All'; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'Patient', label: 'Patients' },
  { value: 'Doctor', label: 'Doctors' },
  { value: 'Appointment', label: 'Appointments' },
];

const ACTION_OPTIONS: ReadonlyArray<ActivityAction | 'All'> = [
  'All',
  'Created',
  'Updated',
  'Status Changed',
  'Deleted',
];

function ActionIndicator({ action }: { action: ActivityAction }) {
  if (action === 'Created') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
        <PlusCircle className="h-3.5 w-3.5 shrink-0" />
        <span>Created</span>
      </span>
    );
  }
  if (action === 'Updated') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0284C7] whitespace-nowrap">
        <Pencil className="h-3.5 w-3.5 shrink-0" />
        <span>Updated</span>
      </span>
    );
  }
  if (action === 'Status Changed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
        <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" />
        <span>Status Changed</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
      <Trash2 className="h-3.5 w-3.5 shrink-0" />
      <span>Deleted</span>
    </span>
  );
}

function formatAuditTimestamp(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function ActivityLogPanel({ initialLogs, refreshSignal = 0 }: ActivityLogPanelProps) {
  const [entityType, setEntityType] = useState<ActivityEntityType | 'All'>('All');
  const [actionFilter, setActionFilter] = useState<ActivityAction | 'All'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [logs, setLogs] = useState<ActivityLogEntry[]>(initialLogs);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestSeqRef = useRef(0);

  const hasActiveFilters =
    entityType !== 'All' || actionFilter !== 'All' || searchTerm.trim().length > 0;

  const fetchLogs = useCallback(
    async (
      nextEntity: ActivityEntityType | 'All',
      nextAction: ActivityAction | 'All',
      nextSearch: string
    ) => {
      const seq = ++requestSeqRef.current;
      setLoading(true);
      setErrorMessage(null);
      try {
        const res = await hospitalApi.listActivityLogs({
          entityType: nextEntity,
          action: nextAction,
          search: nextSearch,
          limit: 50,
        });
        if (seq === requestSeqRef.current) {
          setLogs(res.logs);
        }
      } catch (err) {
        if (seq === requestSeqRef.current) {
          setErrorMessage(
            err instanceof ApiError ? err.message : 'Unable to load audit activity log.'
          );
        }
      } finally {
        if (seq === requestSeqRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  // Sync with fresh dashboard summary when no filter overrides are active
  useEffect(() => {
    if (!hasActiveFilters) {
      setLogs(initialLogs);
    }
  }, [initialLogs, hasActiveFilters]);

  // Query server whenever filters, search, or external refreshSignal change
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchLogs(entityType, actionFilter, searchTerm);
    }, searchTerm.trim() ? 180 : 0);
    return () => clearTimeout(timer);
  }, [entityType, actionFilter, searchTerm, refreshSignal, fetchLogs]);

  function handleResetFilters() {
    setEntityType('All');
    setActionFilter('All');
    setSearchTerm('');
  }

  return (
    <section
      aria-label="Audit activity log"
      className="rounded-xl border border-slate-200 bg-white"
    >
      {/* Header & Entity Segmented Filter */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-6 py-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-base font-semibold text-[#0B2239]">Audit Activity Log</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Chronological record of recent create, update, status, and delete operations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            role="tablist"
            aria-label="Filter activity log by record type"
            className="flex items-center gap-1 rounded-lg bg-slate-100 p-1"
          >
            {ENTITY_TABS.map((tab) => {
              const active = entityType === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setEntityType(tab.value)}
                  className={`whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0284C7] ${
                    active
                      ? 'bg-white text-[#0B2239] shadow-sm'
                      : 'text-slate-600 hover:text-[#0B2239]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => void fetchLogs(entityType, actionFilter, searchTerm)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-[#0B2239] transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0284C7] disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Search & Action Filter Bar */}
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/40 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by code, summary, or actor..."
            aria-label="Search activity logs"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-[#0B2239] placeholder:text-slate-400 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-[#0284C7]/20"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <label htmlFor="audit-action-filter" className="text-xs font-medium text-slate-600 whitespace-nowrap">
            Operation
          </label>
          <select
            id="audit-action-filter"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as ActivityAction | 'All')}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-[#0B2239] focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-[#0284C7]/20"
          >
            {ACTION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === 'All' ? 'All Operations' : option}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="whitespace-nowrap shrink-0 text-xs font-semibold text-[#0284C7] hover:text-[#0369A1]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Audit Table States */}
      {errorMessage ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <p className="text-sm text-red-700">{errorMessage}</p>
          <button
            type="button"
            onClick={() => void fetchLogs(entityType, actionFilter, searchTerm)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#0B2239] hover:bg-slate-50"
          >
            Retry
          </button>
        </div>
      ) : loading && logs.length === 0 ? (
        <div className="space-y-3 px-6 py-5">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="h-9 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-medium text-[#0B2239]">No matching audit entries found</p>
          <p className="mt-1 text-xs text-slate-500">
            {hasActiveFilters
              ? 'Adjust your module filter or search query to inspect other recent events.'
              : 'Create, edit, or delete a patient, doctor, or appointment to record audit history.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#0284C7] hover:bg-slate-50"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="px-6 py-3 whitespace-nowrap">Timestamp</th>
                <th className="px-4 py-3 whitespace-nowrap">Operation</th>
                <th className="px-4 py-3 whitespace-nowrap">Record</th>
                <th className="px-4 py-3">Audit Summary</th>
                <th className="px-6 py-3 text-right whitespace-nowrap">Performed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((entry) => (
                <tr key={entry.id} className="transition-colors hover:bg-slate-50/70">
                  <td className="px-6 py-3 font-mono text-xs text-slate-500 whitespace-nowrap tabular-nums">
                    {formatAuditTimestamp(entry.createdAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <ActionIndicator action={entry.action} />
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    <span className="font-medium text-slate-600">{entry.entityType}</span>
                    <span className="mx-1.5 text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-mono font-medium text-[#0284C7] tabular-nums">
                      {entry.entityCode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#0B2239]">{entry.summary}</td>
                  <td className="px-6 py-3 text-right whitespace-nowrap">
                    <div className="text-xs font-medium text-[#0B2239]">{entry.actorName}</div>
                    <div className="font-mono text-[11px] text-slate-500">{entry.actorEmail}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
