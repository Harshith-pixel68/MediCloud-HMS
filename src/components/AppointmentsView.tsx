import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Ban,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { ApiError, hospitalApi } from '../lib/apiClient';
import { getLocalTodayDate } from '../lib/dateUtils';
import type {
  Appointment,
  AppointmentPayload,
  AppointmentStatus,
  Doctor,
  Patient,
  StorageMode,
} from '../types/hospital';
import { ConfirmModal } from './ConfirmModal';

interface AppointmentsViewProps {
  openAddSignal: number;
  storageMode?: StorageMode;
  onNotify: (type: 'success' | 'error', message: string) => void;
  onDataChanged: () => void;
}

function AppointmentStatusLabel({ status }: { status: AppointmentStatus }) {
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

export function AppointmentsView({
  openAddSignal,
  storageMode = 'demo',
  onNotify,
  onDataChanged,
}: AppointmentsViewProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | 'All'>('All');

  // Booking / Editing Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [formState, setFormState] = useState<AppointmentPayload>({
    patientId: 0,
    doctorId: 0,
    appointmentDate: getLocalTodayDate(),
    appointmentTime: '09:30',
    reason: '',
    status: 'Scheduled',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Detail Modal
  const [viewingAppointment, setViewingAppointment] = useState<Appointment | null>(null);

  // Cancel / Delete Confirmations
  const [cancellingAppointment, setCancellingAppointment] = useState<Appointment | null>(null);
  const [deletingAppointment, setDeletingAppointment] = useState<Appointment | null>(null);
  const [mutatingId, setMutatingId] = useState<number | null>(null);

  const requestSeqRef = useRef(0);

  async function loadOptions() {
    try {
      const [patientRes, doctorRes] = await Promise.all([
        hospitalApi.listPatients(),
        hospitalApi.listDoctors(),
      ]);
      setPatients(patientRes.patients);
      setDoctors(doctorRes.doctors);
      return { patients: patientRes.patients, doctors: doctorRes.doctors };
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiError
          ? err.message
          : 'Unable to load patients or doctors directory.'
      );
      return { patients, doctors };
    }
  }

  async function fetchAppointments(
    currentSearch = search,
    currentDate = dateFilter,
    currentStatus = statusFilter
  ) {
    const seq = ++requestSeqRef.current;
    setLoading(true);
    try {
      const { appointments: list } = await hospitalApi.listAppointments({
        search: currentSearch,
        date: currentDate,
        status: currentStatus,
      });
      if (seq === requestSeqRef.current) {
        setAppointments(list);
      }
    } catch (err) {
      if (seq === requestSeqRef.current) {
        onNotify(
          'error',
          err instanceof ApiError ? err.message : 'Unable to load appointments.'
        );
      }
    } finally {
      if (seq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (openAddSignal === 0) {
      void loadOptions();
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchAppointments(search, dateFilter, statusFilter);
    }, 180);
    return () => clearTimeout(timer);
  }, [search, dateFilter, statusFilter]);

  useEffect(() => {
    if (openAddSignal > 0) {
      void openBookModal();
    }
  }, [openAddSignal]);

  useEffect(() => {
    if (!formOpen && !viewingAppointment) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (viewingAppointment) {
        setViewingAppointment(null);
      } else if (formOpen && !saving) {
        setFormOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [formOpen, saving, viewingAppointment]);

  async function openBookModal() {
    const latest = await loadOptions();
    const firstAvailableDoctor =
      latest.doctors.find((d) => d.availability !== 'On Leave') ?? latest.doctors[0];
    setEditingAppointment(null);
    setFormState({
      patientId: latest.patients[0]?.id ?? 0,
      doctorId: firstAvailableDoctor?.id ?? 0,
      appointmentDate: getLocalTodayDate(),
      appointmentTime: '10:00',
      reason: '',
      status: 'Scheduled',
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function openEditModal(appt: Appointment) {
    await loadOptions();
    setEditingAppointment(appt);
    setFormState({
      patientId: appt.patientId,
      doctorId: appt.doctorId,
      appointmentDate: appt.appointmentDate,
      appointmentTime: appt.appointmentTime,
      reason: appt.reason,
      status: appt.status,
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function handleFormSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      const payload: AppointmentPayload = {
        patientId: Number(formState.patientId),
        doctorId: Number(formState.doctorId),
        appointmentDate: formState.appointmentDate,
        appointmentTime: formState.appointmentTime,
        reason: formState.reason.trim(),
        status: formState.status || 'Scheduled',
      };

      if (editingAppointment) {
        await hospitalApi.updateAppointment(editingAppointment.id, payload);
        onNotify('success', `Updated appointment ${editingAppointment.appointmentCode}.`);
      } else {
        const res = await hospitalApi.createAppointment(payload);
        onNotify('success', `Booked appointment ${res.appointment.appointmentCode}.`);
      }

      setFormOpen(false);
      await fetchAppointments();
      onDataChanged();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to save appointment.');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(appt: Appointment, nextStatus: AppointmentStatus) {
    setMutatingId(appt.id);
    try {
      await hospitalApi.updateAppointmentStatus(appt.id, nextStatus);
      onNotify('success', `Appointment ${appt.appointmentCode} marked as ${nextStatus}.`);
      await fetchAppointments();
      onDataChanged();
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiError ? err.message : 'Unable to update appointment status.'
      );
    } finally {
      setMutatingId(null);
    }
  }

  async function handleConfirmCancel() {
    if (!cancellingAppointment) return;
    setMutatingId(cancellingAppointment.id);
    try {
      await hospitalApi.updateAppointmentStatus(cancellingAppointment.id, 'Cancelled');
      onNotify(
        'success',
        `Cancelled appointment ${cancellingAppointment.appointmentCode}.`
      );
      setCancellingAppointment(null);
      await fetchAppointments();
      onDataChanged();
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiError ? err.message : 'Unable to cancel appointment.'
      );
    } finally {
      setMutatingId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingAppointment) return;
    setMutatingId(deletingAppointment.id);
    try {
      await hospitalApi.deleteAppointment(deletingAppointment.id);
      onNotify('success', `Deleted appointment ${deletingAppointment.appointmentCode}.`);
      setDeletingAppointment(null);
      await fetchAppointments();
      onDataChanged();
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiError ? err.message : 'Unable to delete appointment.'
      );
    } finally {
      setMutatingId(null);
    }
  }

  const todayStr = getLocalTodayDate();

  return (
    <div className="space-y-5">
      {/* Search, Date & Status Filter Toolbar */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 xl:flex-row xl:items-center">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient, doctor, or ID..."
              aria-label="Search appointments"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-[#0B2239] outline-none transition-colors focus:border-[#0284C7] focus:bg-white focus:ring-2 focus:ring-[#0284C7]/20"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                aria-label="Filter appointments by date"
                className="rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 font-mono text-xs text-[#0B2239] outline-none focus:border-[#0284C7] focus:bg-white"
              />
            </div>
            <button
              type="button"
              onClick={() => setDateFilter(dateFilter === todayStr ? '' : todayStr)}
              className={`whitespace-nowrap shrink-0 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                dateFilter === todayStr
                  ? 'border-[#0284C7] bg-sky-50 text-[#0284C7]'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Today
            </button>
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                className="whitespace-nowrap shrink-0 rounded-lg px-2 py-2 text-xs font-medium text-slate-500 hover:text-[#0B2239]"
              >
                Clear
              </button>
            )}
          </div>

          <div
            role="group"
            aria-label="Filter appointments by status"
            className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1"
          >
            {(['All', 'Scheduled', 'Completed', 'Cancelled'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-white text-[#0B2239] shadow-sm'
                    : 'text-slate-600 hover:text-[#0B2239]'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void openBookModal()}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0369A1]"
        >
          <Plus className="h-4 w-4" />
          <span>Book Appointment</span>
        </button>
      </div>

      {/* Appointments Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="h-10 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-[#0B2239]">No appointments match your filters</p>
            <p className="mt-1 text-xs text-slate-500">
              {search || dateFilter || statusFilter !== 'All'
                ? 'Adjust the date, status, or search filter to view other appointments.'
                : 'Schedule your first patient-doctor consultation.'}
            </p>
            <button
              type="button"
              onClick={() => void openBookModal()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0284C7] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0369A1]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Book Appointment</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                  <th className="px-5 py-3.5">Appt ID</th>
                  <th className="px-4 py-3.5">Date &amp; Time</th>
                  <th className="px-4 py-3.5">Patient</th>
                  <th className="px-4 py-3.5">Doctor</th>
                  <th className="px-4 py-3.5">Reason</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.map((appt) => (
                  <tr key={appt.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-[#0284C7] whitespace-nowrap tabular-nums">
                      {appt.appointmentCode}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#0B2239] whitespace-nowrap tabular-nums">
                      <span>{appt.appointmentDate}</span>
                      <span className="mx-1.5 text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-semibold">{appt.appointmentTime}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-[#0B2239]">{appt.patientName}</div>
                      <div className="font-mono text-xs text-slate-500">{appt.patientCode}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-[#0B2239]">{appt.doctorName}</div>
                      <div className="text-xs text-slate-500">{appt.doctorSpecialization}</div>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-slate-600">
                      {appt.reason || 'General consultation'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <AppointmentStatusLabel status={appt.status} />
                        <select
                          aria-label={`Change status for ${appt.appointmentCode}`}
                          value={appt.status}
                          disabled={mutatingId === appt.id}
                          onChange={(e) =>
                            void handleStatusChange(appt, e.target.value as AppointmentStatus)
                          }
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 outline-none focus:border-[#0284C7]"
                        >
                          <option value="Scheduled">Scheduled</option>
                          <option value="Completed">Completed</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewingAppointment(appt)}
                          title="View Details"
                          aria-label={`View ${appt.appointmentCode}`}
                          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-sky-50 hover:text-[#0284C7]"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {appt.status === 'Scheduled' && (
                          <button
                            type="button"
                            onClick={() => setCancellingAppointment(appt)}
                            title="Cancel Appointment"
                            aria-label={`Cancel ${appt.appointmentCode}`}
                            className="rounded-md p-2 text-slate-500 transition-colors hover:bg-amber-50 hover:text-amber-700"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void openEditModal(appt)}
                          title="Edit Appointment"
                          aria-label={`Edit ${appt.appointmentCode}`}
                          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-sky-50 hover:text-[#0284C7]"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingAppointment(appt)}
                          title="Delete Appointment"
                          aria-label={`Delete ${appt.appointmentCode}`}
                          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Book / Edit Appointment Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B2239]/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="appointment-form-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) {
              setFormOpen(false);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 id="appointment-form-title" className="text-base font-semibold text-[#0B2239]">
                {editingAppointment
                  ? `Edit Appointment · ${editingAppointment.appointmentCode}`
                  : 'Book Clinical Appointment'}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                aria-label="Close modal"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 px-6 py-5">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                  {formError}
                </div>
              )}

              <div>
                <label
                  htmlFor="appt-patient"
                  className="block text-xs font-semibold text-[#0B2239]"
                >
                  Select Patient
                </label>
                <select
                  id="appt-patient"
                  required
                  value={formState.patientId}
                  onChange={(e) =>
                    setFormState({ ...formState, patientId: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20"
                >
                  {patients.length === 0 ? (
                    <option value={0}>No registered patients available</option>
                  ) : (
                    patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.patientCode} — {p.fullName} ({p.age} yrs, {p.gender})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="appt-doctor" className="block text-xs font-semibold text-[#0B2239]">
                  Select Doctor
                </label>
                <select
                  id="appt-doctor"
                  required
                  value={formState.doctorId}
                  onChange={(e) =>
                    setFormState({ ...formState, doctorId: Number(e.target.value) })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20"
                >
                  {doctors.length === 0 ? (
                    <option value={0}>No doctors available</option>
                  ) : (
                    doctors.map((d) => {
                      const onLeaveDisabled = !editingAppointment && d.availability === 'On Leave';
                      return (
                        <option key={d.id} value={d.id} disabled={onLeaveDisabled}>
                          {d.doctorCode} — {d.fullName} ({d.specialization} · {d.availability})
                        </option>
                      );
                    })
                  )}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="appt-date" className="block text-xs font-semibold text-[#0B2239]">
                    Appointment Date
                  </label>
                  <input
                    id="appt-date"
                    type="date"
                    required
                    min={!editingAppointment ? todayStr : undefined}
                    value={formState.appointmentDate}
                    onChange={(e) =>
                      setFormState({ ...formState, appointmentDate: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20"
                  />
                </div>

                <div>
                  <label htmlFor="appt-time" className="block text-xs font-semibold text-[#0B2239]">
                    Appointment Time
                  </label>
                  <input
                    id="appt-time"
                    type="time"
                    required
                    value={formState.appointmentTime}
                    onChange={(e) =>
                      setFormState({ ...formState, appointmentTime: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20"
                  />
                </div>
              </div>

              {editingAppointment && (
                <div>
                  <label
                    htmlFor="appt-status"
                    className="block text-xs font-semibold text-[#0B2239]"
                  >
                    Appointment Status
                  </label>
                  <select
                    id="appt-status"
                    value={formState.status || 'Scheduled'}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        status: e.target.value as AppointmentStatus,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20"
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="appt-reason" className="block text-xs font-semibold text-[#0B2239]">
                  Consultation Reason / Notes
                </label>
                <textarea
                  id="appt-reason"
                  rows={2}
                  maxLength={255}
                  value={formState.reason}
                  onChange={(e) => setFormState({ ...formState, reason: e.target.value })}
                  placeholder="Routine follow-up, diagnostic review, symptoms..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || patients.length === 0 || doctors.length === 0}
                  className="rounded-lg bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0369A1] disabled:opacity-60"
                >
                  {saving
                    ? 'Saving...'
                    : editingAppointment
                      ? 'Save Changes'
                      : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Appointment Details Modal */}
      {viewingAppointment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B2239]/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="appointment-detail-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setViewingAppointment(null);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <p className="font-mono text-xs font-semibold text-[#0284C7]">
                  {viewingAppointment.appointmentCode}
                </p>
                <h3 id="appointment-detail-title" className="text-base font-semibold text-[#0B2239]">
                  Appointment Summary
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingAppointment(null)}
                aria-label="Close appointment details"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5 text-sm">
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs text-slate-500">Scheduled Date &amp; Time</dt>
                  <dd className="mt-0.5 font-mono text-xs font-semibold text-[#0B2239] tabular-nums">
                    {viewingAppointment.appointmentDate} · {viewingAppointment.appointmentTime}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Status</dt>
                  <dd className="mt-0.5">
                    <AppointmentStatusLabel status={viewingAppointment.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Patient</dt>
                  <dd className="mt-0.5 font-medium text-[#0B2239]">
                    {viewingAppointment.patientName}
                  </dd>
                  <dd className="font-mono text-xs text-slate-500">
                    {viewingAppointment.patientCode}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Attending Physician</dt>
                  <dd className="mt-0.5 font-medium text-[#0B2239]">
                    {viewingAppointment.doctorName}
                  </dd>
                  <dd className="text-xs text-slate-500">
                    {viewingAppointment.doctorSpecialization} ·{' '}
                    <span className="font-mono">{viewingAppointment.doctorCode}</span>
                  </dd>
                </div>
              </dl>

              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-semibold text-slate-500">Consultation Reason / Notes</h4>
                <p className="mt-1.5 rounded-lg border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-[#0B2239]">
                  {viewingAppointment.reason || 'General outpatient consultation'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  const target = viewingAppointment;
                  setViewingAppointment(null);
                  void openEditModal(target);
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#0B2239] hover:bg-slate-50"
              >
                Edit Appointment
              </button>
              <button
                type="button"
                onClick={() => setViewingAppointment(null)}
                className="rounded-lg bg-[#0B2239] px-4 py-2 text-xs font-semibold text-white hover:bg-[#133150]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Appointment Confirmation */}
      <ConfirmModal
        open={Boolean(cancellingAppointment)}
        title="Cancel Appointment"
        description={
          cancellingAppointment
            ? `Cancel appointment ${cancellingAppointment.appointmentCode} for ${cancellingAppointment.patientName} with ${cancellingAppointment.doctorName} on ${cancellingAppointment.appointmentDate} at ${cancellingAppointment.appointmentTime}?`
            : ''
        }
        confirmLabel="Cancel Appointment"
        cancelLabel="Keep Scheduled"
        tone="primary"
        busy={Boolean(mutatingId)}
        onConfirm={() => void handleConfirmCancel()}
        onCancel={() => setCancellingAppointment(null)}
      />

      {/* Delete Appointment Confirmation */}
      <ConfirmModal
        open={Boolean(deletingAppointment)}
        title="Delete Appointment Record"
        description={
          deletingAppointment
            ? storageMode === 'demo'
              ? `Permanently delete appointment ${deletingAppointment.appointmentCode} (${deletingAppointment.patientName} · ${deletingAppointment.appointmentDate}) from temporary Demo Mode memory?`
              : `Delete appointment ${deletingAppointment.appointmentCode} (${deletingAppointment.patientName} · ${deletingAppointment.appointmentDate})? In Azure SQL production mode, only Cancelled appointments may be deleted—Scheduled or Completed clinical encounters are protected, and all audit history in dbo.ActivityLogs is preserved.`
            : ''
        }
        confirmLabel="Delete Record"
        tone="danger"
        busy={Boolean(mutatingId)}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeletingAppointment(null)}
      />
    </div>
  );
}
