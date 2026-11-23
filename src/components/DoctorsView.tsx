import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, Clock, Eye, MinusCircle, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { ApiError, hospitalApi } from '../lib/apiClient';
import type {
  Appointment,
  Doctor,
  DoctorAvailability,
  DoctorPayload,
  StorageMode,
} from '../types/hospital';
import { ConfirmModal } from './ConfirmModal';

interface DoctorsViewProps {
  openAddSignal: number;
  storageMode?: StorageMode;
  onNotify: (type: 'success' | 'error', message: string) => void;
  onDataChanged: () => void;
}

const SPECIALIZATIONS = [
  'Cardiology',
  'Neurology',
  'Pediatrics',
  'Orthopedics',
  'Internal Medicine',
  'Dermatology',
  'General Surgery',
  'Radiology',
  'Emergency Medicine',
];

const EMPTY_FORM: DoctorPayload = {
  fullName: '',
  specialization: 'Cardiology',
  phoneNumber: '',
  availability: 'Available',
};

function AvailabilityText({ availability }: { availability: DoctorAvailability }) {
  if (availability === 'Available') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        <span>Available</span>
      </span>
    );
  }
  if (availability === 'In Consultation') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span>In Consultation</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
      <MinusCircle className="h-3.5 w-3.5 shrink-0" />
      <span>On Leave</span>
    </span>
  );
}

export function DoctorsView({
  openAddSignal,
  storageMode = 'demo',
  onNotify,
  onDataChanged,
}: DoctorsViewProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<DoctorAvailability | 'All'>('All');

  const [formOpen, setFormOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [formState, setFormState] = useState<DoctorPayload>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [viewingDoctor, setViewingDoctor] = useState<Doctor | null>(null);
  const [doctorAppointments, setDoctorAppointments] = useState<Appointment[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [deletingDoctor, setDeletingDoctor] = useState<Doctor | null>(null);
  const [deleting, setDeleting] = useState(false);

  const requestSeqRef = useRef(0);
  const detailSeqRef = useRef(0);

  async function fetchDoctors(currentSearch = search, currentFilter = availabilityFilter) {
    const seq = ++requestSeqRef.current;
    setLoading(true);
    try {
      const { doctors: list } = await hospitalApi.listDoctors(currentSearch, currentFilter);
      if (seq === requestSeqRef.current) {
        setDoctors(list);
      }
    } catch (err) {
      if (seq === requestSeqRef.current) {
        onNotify(
          'error',
          err instanceof ApiError ? err.message : 'Unable to load doctor directory.'
        );
      }
    } finally {
      if (seq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchDoctors(search, availabilityFilter);
    }, 180);
    return () => clearTimeout(timer);
  }, [search, availabilityFilter]);

  useEffect(() => {
    if (openAddSignal > 0) {
      openCreateModal();
    }
  }, [openAddSignal]);

  useEffect(() => {
    if (!formOpen && !viewingDoctor) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (viewingDoctor) {
        setViewingDoctor(null);
      } else if (formOpen && !saving) {
        setFormOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [formOpen, saving, viewingDoctor]);

  function openCreateModal() {
    setEditingDoctor(null);
    setFormState(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  }

  function openEditModal(doctor: Doctor) {
    setEditingDoctor(doctor);
    setFormState({
      fullName: doctor.fullName,
      specialization: doctor.specialization,
      phoneNumber: doctor.phoneNumber,
      availability: doctor.availability,
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function openViewModal(doctor: Doctor) {
    const seq = ++detailSeqRef.current;
    setViewingDoctor(doctor);
    setDoctorAppointments([]);
    setLoadingDetails(true);
    try {
      const { appointments } = await hospitalApi.listAppointments({ doctorId: doctor.id });
      if (seq === detailSeqRef.current) {
        setDoctorAppointments(appointments);
      }
    } catch {
      if (seq === detailSeqRef.current) {
        setDoctorAppointments([]);
      }
    } finally {
      if (seq === detailSeqRef.current) {
        setLoadingDetails(false);
      }
    }
  }

  async function handleFormSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      const payload: DoctorPayload = {
        fullName: formState.fullName.trim(),
        specialization: formState.specialization.trim(),
        phoneNumber: formState.phoneNumber.trim(),
        availability: formState.availability,
      };

      if (editingDoctor) {
        await hospitalApi.updateDoctor(editingDoctor.id, payload);
        onNotify('success', `Updated profile for ${payload.fullName}.`);
      } else {
        await hospitalApi.createDoctor(payload);
        onNotify('success', `Added ${payload.fullName} to the doctor directory.`);
      }

      setFormOpen(false);
      await fetchDoctors();
      onDataChanged();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to save doctor record.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingDoctor) return;
    setDeleting(true);
    try {
      await hospitalApi.deleteDoctor(deletingDoctor.id);
      onNotify(
        'success',
        `Removed ${deletingDoctor.fullName} (${deletingDoctor.doctorCode}) from directory.`
      );
      setDeletingDoctor(null);
      await fetchDoctors();
      onDataChanged();
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiError ? err.message : 'Unable to delete doctor record.'
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-center">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search doctor, ID, or specialty..."
              aria-label="Search doctors"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-[#0B2239] outline-none transition-colors focus:border-[#0284C7] focus:bg-white focus:ring-2 focus:ring-[#0284C7]/20"
            />
          </div>

          <div
            role="group"
            aria-label="Filter by availability"
            className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1"
          >
            {(['All', 'Available', 'In Consultation', 'On Leave'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setAvailabilityFilter(option)}
                className={`whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  availabilityFilter === option
                    ? 'bg-white text-[#0B2239] shadow-sm'
                    : 'text-slate-600 hover:text-[#0B2239]'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0369A1]"
        >
          <Plus className="h-4 w-4" />
          <span>Add Doctor</span>
        </button>
      </div>

      {/* Doctors Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="h-10 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : doctors.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-[#0B2239]">No matching physicians found</p>
            <p className="mt-1 text-xs text-slate-500">
              {search || availabilityFilter !== 'All'
                ? 'Try clearing your search input or changing the availability filter.'
                : 'Add a doctor to populate the hospital medical directory.'}
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0284C7] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0369A1]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Doctor</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                  <th className="px-5 py-3.5">Doctor ID</th>
                  <th className="px-4 py-3.5">Doctor Name</th>
                  <th className="px-4 py-3.5">Specialization</th>
                  <th className="px-4 py-3.5">Phone Number</th>
                  <th className="px-4 py-3.5">Availability</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {doctors.map((doctor) => (
                  <tr key={doctor.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-[#0284C7] whitespace-nowrap tabular-nums">
                      {doctor.doctorCode}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#0B2239] whitespace-nowrap">
                      {doctor.fullName}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                      {doctor.specialization}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap tabular-nums">
                      {doctor.phoneNumber}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <AvailabilityText availability={doctor.availability} />
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void openViewModal(doctor)}
                          title="View Details"
                          aria-label={`View ${doctor.fullName}`}
                          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-sky-50 hover:text-[#0284C7]"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(doctor)}
                          title="Edit Doctor"
                          aria-label={`Edit ${doctor.fullName}`}
                          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-sky-50 hover:text-[#0284C7]"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingDoctor(doctor)}
                          title="Delete Doctor"
                          aria-label={`Delete ${doctor.fullName}`}
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

      {/* Add / Edit Doctor Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B2239]/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="doctor-form-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) {
              setFormOpen(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 id="doctor-form-title" className="text-base font-semibold text-[#0B2239]">
                {editingDoctor ? `Edit Doctor · ${editingDoctor.doctorCode}` : 'Add New Doctor'}
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
                <label htmlFor="doctor-name" className="block text-xs font-semibold text-[#0B2239]">
                  Doctor Name
                </label>
                <input
                  id="doctor-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  value={formState.fullName}
                  onChange={(e) => setFormState({ ...formState, fullName: e.target.value })}
                  placeholder="Dr. Sarah Jenkins"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20"
                />
              </div>

              <div>
                <label
                  htmlFor="doctor-specialty"
                  className="block text-xs font-semibold text-[#0B2239]"
                >
                  Specialization
                </label>
                <input
                  id="doctor-specialty"
                  type="text"
                  list="medical-specializations"
                  required
                  minLength={2}
                  maxLength={100}
                  value={formState.specialization}
                  onChange={(e) => setFormState({ ...formState, specialization: e.target.value })}
                  placeholder="Cardiology"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20"
                />
                <datalist id="medical-specializations">
                  {SPECIALIZATIONS.map((spec) => (
                    <option key={spec} value={spec} />
                  ))}
                </datalist>
              </div>

              <div>
                <label htmlFor="doctor-phone" className="block text-xs font-semibold text-[#0B2239]">
                  Phone Number
                </label>
                <input
                  id="doctor-phone"
                  type="tel"
                  required
                  minLength={7}
                  maxLength={30}
                  value={formState.phoneNumber}
                  onChange={(e) => setFormState({ ...formState, phoneNumber: e.target.value })}
                  placeholder="+1-555-110-2007"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Include 7–15 digits (spaces, dashes, or parentheses allowed).
                </p>
              </div>

              <div>
                <label
                  htmlFor="doctor-availability"
                  className="block text-xs font-semibold text-[#0B2239]"
                >
                  Availability Status
                </label>
                <select
                  id="doctor-availability"
                  value={formState.availability}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      availability: e.target.value as DoctorAvailability,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20"
                >
                  <option value="Available">Available</option>
                  <option value="In Consultation">In Consultation</option>
                  <option value="On Leave">On Leave</option>
                </select>
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
                  disabled={saving}
                  className="rounded-lg bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0369A1] disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editingDoctor ? 'Save Changes' : 'Add Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Doctor Details Modal */}
      {viewingDoctor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B2239]/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="doctor-detail-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setViewingDoctor(null);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <p className="font-mono text-xs font-semibold text-[#0284C7]">
                  {viewingDoctor.doctorCode}
                </p>
                <h3 id="doctor-detail-title" className="text-base font-semibold text-[#0B2239]">
                  {viewingDoctor.fullName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingDoctor(null)}
                aria-label="Close doctor details"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5 text-sm">
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs text-slate-500">Specialization</dt>
                  <dd className="mt-0.5 font-medium text-[#0B2239]">
                    {viewingDoctor.specialization}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Availability</dt>
                  <dd className="mt-0.5">
                    <AvailabilityText availability={viewingDoctor.availability} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Phone Number</dt>
                  <dd className="mt-0.5 font-mono text-xs font-medium text-[#0B2239]">
                    {viewingDoctor.phoneNumber}
                  </dd>
                </div>
              </dl>

              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-semibold text-slate-500">Assigned Appointments</h4>
                {loadingDetails ? (
                  <p className="py-4 text-xs text-slate-500">Loading schedule...</p>
                ) : doctorAppointments.length === 0 ? (
                  <p className="py-4 text-xs text-slate-500">
                    No appointments currently assigned to this doctor.
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-slate-100">
                    {doctorAppointments.map((appt) => (
                      <li key={appt.id} className="flex items-center justify-between py-2 text-xs">
                        <div>
                          <span className="font-mono font-medium text-[#0B2239]">
                            {appt.appointmentDate} · {appt.appointmentTime}
                          </span>
                          <p className="text-slate-500">
                            {appt.patientName} ({appt.patientCode})
                          </p>
                        </div>
                        <span className="font-medium text-[#0284C7]">{appt.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  const target = viewingDoctor;
                  setViewingDoctor(null);
                  openEditModal(target);
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#0B2239] hover:bg-slate-50"
              >
                Edit Doctor
              </button>
              <button
                type="button"
                onClick={() => setViewingDoctor(null)}
                className="rounded-lg bg-[#0B2239] px-4 py-2 text-xs font-semibold text-white hover:bg-[#133150]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={Boolean(deletingDoctor)}
        title="Remove Doctor from Directory"
        description={
          deletingDoctor
            ? storageMode === 'demo'
              ? `Remove ${deletingDoctor.fullName} (${deletingDoctor.doctorCode})? In Demo Mode, any appointments assigned to this doctor will also be cascade-deleted in temporary memory.`
              : `Remove unlinked physician ${deletingDoctor.fullName} (${deletingDoctor.doctorCode})? Cascading hard deletes are disabled in Azure SQL production mode—doctors with assigned appointments cannot be removed, and this action is recorded permanently in the Audit Activity Log.`
            : ''
        }
        confirmLabel="Delete Doctor"
        tone="danger"
        busy={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeletingDoctor(null)}
      />
    </div>
  );
}
