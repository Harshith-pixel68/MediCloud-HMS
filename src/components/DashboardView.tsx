import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  Info,
  Stethoscope,
  Users,
  XCircle,
} from 'lucide-react';
import { ActivityLogPanel } from './ActivityLogPanel';
import type { ActiveSection, AppointmentStatus, DashboardSummary, StorageModeInfo } from '../types/hospital';

interface DashboardViewProps {
  summary: DashboardSummary | null;
  loading: boolean;
  modeInfo: StorageModeInfo;
  refreshSignal?: number;
  onNavigate: (section: ActiveSection) => void;
  onBookAppointment: () => void;
}

function StatusText({ status }: { status: AppointmentStatus }) {
  if (status === 'Completed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        <span>Completed</span>
      </span>
    );
  }
  if (status === 'Cancelled') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
        <XCircle className="h-3.5 w-3.5 shrink-0" />
        <span>Cancelled</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0284C7]">
      <Clock className="h-3.5 w-3.5 shrink-0" />
      <span>Scheduled</span>
    </span>
  );
}

export function DashboardView({
  summary,
  loading,
  modeInfo,
  refreshSignal = 0,
  onNavigate,
  onBookAppointment,
}: DashboardViewProps) {
  if (loading || !summary) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white p-5"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white lg:col-span-7" />
          <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white lg:col-span-5" />
        </div>
        <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  const totalStats =
    summary.appointmentStats.scheduled +
    summary.appointmentStats.completed +
    summary.appointmentStats.cancelled;

  const pct = (value: number) => (totalStats > 0 ? Math.round((value / totalStats) * 100) : 0);

  return (
    <div className="space-y-6">
      {/* Demo Mode / Storage Transparency Banner */}
      {modeInfo.mode === 'demo' && (
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-5 py-3.5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0284C7]" />
            <div className="text-sm text-[#0B2239]">
              <span className="font-semibold">Demo Mode Active:</span> Sample records are stored in
              temporary server memory for testing without an Azure subscription. Connect Azure SQL
              environment variables for persistent production storage.
            </div>
          </div>
          <button
            type="button"
            onClick={onBookAppointment}
            className="whitespace-nowrap shrink-0 rounded-lg border border-sky-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#0284C7] transition-colors hover:bg-sky-100"
          >
            Quick Book Appointment
          </button>
        </div>
      )}

      {/* 4-Column KPI Strip */}
      <section aria-label="Hospital key metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Total Patients</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E0F2FE] text-[#0284C7]">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 font-mono text-3xl font-semibold text-[#0B2239] tabular-nums">
            {summary.totalPatients}
          </p>
          <p className="mt-1 text-xs text-slate-500">Registered inpatient &amp; outpatient profiles</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Total Doctors</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E0F2FE] text-[#0284C7]">
              <Stethoscope className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 font-mono text-3xl font-semibold text-[#0B2239] tabular-nums">
            {summary.totalDoctors}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {summary.availableDoctors} currently available for consults
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Total Appointments</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E0F2FE] text-[#0284C7]">
              <CalendarClock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 font-mono text-3xl font-semibold text-[#0B2239] tabular-nums">
            {summary.totalAppointments}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {summary.appointmentStats.completed} completed · {summary.appointmentStats.cancelled}{' '}
            cancelled
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Today&apos;s Appointments</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0B2239] text-white">
              <CalendarCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 font-mono text-3xl font-semibold text-[#0B2239] tabular-nums">
            {summary.todayAppointments}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {summary.todayScheduled} pending consultation today
          </p>
        </div>
      </section>

      {/* Main Content Split: Recent Registrations & Appointment Statistics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Recent Registrations Table */}
        <section className="rounded-xl border border-slate-200 bg-white lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-[#0B2239]">Recent Patient Registrations</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Latest patients added to the hospital registry
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('patients')}
              className="flex items-center gap-1 whitespace-nowrap shrink-0 text-xs font-semibold text-[#0284C7] hover:text-[#0369A1]"
            >
              <span>Manage Patients</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {summary.recentRegistrations.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              No patients registered yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="px-6 py-3">Patient ID</th>
                    <th className="px-4 py-3">Full Name</th>
                    <th className="px-4 py-3">Demographics</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-6 py-3 text-right">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.recentRegistrations.map((patient) => (
                    <tr key={patient.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-6 py-3 font-mono text-xs font-medium text-[#0284C7] tabular-nums whitespace-nowrap">
                        {patient.patientCode}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#0B2239] whitespace-nowrap">
                        {patient.fullName}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap tabular-nums">
                        <span>{patient.age} yrs</span>
                        <span className="mx-1.5 text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span>{patient.gender}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap tabular-nums">
                        {patient.phoneNumber}
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-xs text-slate-500 whitespace-nowrap tabular-nums">
                        {patient.registrationDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Appointment Statistics & Today's Schedule */}
        <section className="flex flex-col rounded-xl border border-slate-200 bg-white lg:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-[#0B2239]">Appointment Statistics</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Status breakdown &amp; today&apos;s outpatient queue
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('appointments')}
              className="flex items-center gap-1 whitespace-nowrap shrink-0 text-xs font-semibold text-[#0284C7] hover:text-[#0369A1]"
            >
              <span>View Schedule</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Status Distribution Bars */}
          <div className="space-y-4 border-b border-slate-100 px-6 py-5">
            <div>
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-[#0B2239]">Scheduled</span>
                <span className="font-mono text-slate-600 tabular-nums">
                  {summary.appointmentStats.scheduled} ({pct(summary.appointmentStats.scheduled)}%)
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[#0284C7]"
                  style={{ width: `${pct(summary.appointmentStats.scheduled)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-[#0B2239]">Completed</span>
                <span className="font-mono text-slate-600 tabular-nums">
                  {summary.appointmentStats.completed} ({pct(summary.appointmentStats.completed)}%)
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-600"
                  style={{ width: `${pct(summary.appointmentStats.completed)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-[#0B2239]">Cancelled</span>
                <span className="font-mono text-slate-600 tabular-nums">
                  {summary.appointmentStats.cancelled} ({pct(summary.appointmentStats.cancelled)}%)
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-red-600"
                  style={{ width: `${pct(summary.appointmentStats.cancelled)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Today's Appointments List */}
          <div className="flex-1 px-6 py-4">
            <h3 className="text-xs font-semibold text-slate-500">Today&apos;s Outpatient Queue</h3>
            {summary.todaysSchedule.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                No appointments scheduled for today.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {summary.todaysSchedule.slice(0, 5).map((appt) => (
                  <li key={appt.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-[#0B2239] tabular-nums">
                          {appt.appointmentTime}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span className="truncate text-sm font-medium text-[#0B2239]">
                          {appt.patientName}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {appt.doctorName} · {appt.doctorSpecialization}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <StatusText status={appt.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Audit Activity Log across Patients, Doctors, and Appointments */}
      <ActivityLogPanel initialLogs={summary.recentActivity ?? []} refreshSignal={refreshSignal} />
    </div>
  );
}
