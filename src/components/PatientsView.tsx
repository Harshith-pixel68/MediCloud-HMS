import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Eye, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { ApiError, hospitalApi } from '../lib/apiClient';
import { getLocalTodayDate } from '../lib/dateUtils';
import type { Appointment, Gender, Patient, PatientPayload, StorageMode } from '../types/hospital';
import { ConfirmModal } from './ConfirmModal';

interface PatientsViewProps {
  openAddSignal: number;
  storageMode?: StorageMode;
  onNotify: (type: 'success' | 'error', message: string) => void;
  onDataChanged: () => void;
}

const EMPTY_FORM: PatientPayload = {
  fullName: '',
  age: 30,
  gender: 'Male',
  phoneNumber: '',
  address: '',
  registrationDate: getLocalTodayDate(),
};

export function PatientsView({
  openAddSignal,
  storageMode = 'demo',
  onNotify,
  onDataChanged,
}: PatientsViewProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<Gender | 'All'>('All');

  // Form Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [formState, setFormState] = useState<PatientPayload>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Detail Modal
  const [viewingPatient, setViewingPatient] = useState<Patient | null>(null);
  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Delete Modal
  const [deletingPatient, setDeletingPatient] = useState<Patient | null>(null);
  const [deleting, setDeleting] = useState(false);

  const requestSeqRef = useRef(0);
  const detailSeqRef = useRef(0);

  async function fetchPatients(currentSearch = search, currentGender = genderFilter) {
    const seq = ++requestSeqRef.current;
    setLoading(true);
    try {
      const { patients: list } = await hospitalApi.listPatients(currentSearch, currentGender);
      if (seq === requestSeqRef.current) {
        setPatients(list);
      }
    } catch (err) {
      if (seq === requestSeqRef.current) {
        onNotify(
          'error',
          err instanceof ApiError ? err.message : 'Unable to load patient records.'
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
      void fetchPatients(search, genderFilter);
    }, 180);
    return () => clearTimeout(timer);
  }, [search, genderFilter]);

  useEffect(() => {
    if (openAddSignal > 0) {
      openCreateModal();
    }
  }, [openAddSignal]);

  useEffect(() => {
    if (!formOpen && !viewingPatient) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (viewingPatient) {
        setViewingPatient(null);
      } else if (formOpen && !saving) {
        setFormOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [formOpen, saving, viewingPatient]);

  function openCreateModal() {
    setEditingPatient(null);
    setFormState({
      ...EMPTY_FORM,
      registrationDate: getLocalTodayDate(),
    });
    setFormError(null);
    setFormOpen(true);
  }

  function openEditModal(patient: Patient) {
    setEditingPatient(patient);
    setFormState({
      fullName: patient.fullName,
      age: patient.age,
      gender: patient.gender,
      phoneNumber: patient.phoneNumber,
      address: patient.address,
      registrationDate: patient.registrationDate,
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function openViewModal(patient: Patient) {
    const seq = ++detailSeqRef.current;
    setViewingPatient(patient);
    setPatientAppointments([]);
    setLoadingDetails(true);
    try {
      const { appointments } = await hospitalApi.listAppointments({
        patientId: patient.id,
      });
      if (seq === detailSeqRef.current) {
        setPatientAppointments(appointments);
      }
    } catch {
      if (seq === detailSeqRef.current) {
        setPatientAppointments([]);
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
      const payload: PatientPayload = {
        ...formState,
        fullName: formState.fullName.trim(),
        age: Number(formState.age),
        phoneNumber: formState.phoneNumber.trim(),
        address: formState.address.trim(),
      };

      if (editingPatient) {
        await hospitalApi.updatePatient(editingPatient.id, payload);
        onNotify('success', `Updated record for ${payload.fullName}.`);
      } else {
        await hospitalApi.createPatient(payload);
        onNotify('success', `Registered new patient ${payload.fullName}.`);
      }

      setFormOpen(false);
      await fetchPatients();
      onDataChanged();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to save patient record.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingPatient) return;
    setDeleting(true);
    try {
      await hospitalApi.deletePatient(deletingPatient.id);
      onNotify(
        'success',
        `Removed patient ${deletingPatient.fullName} (${deletingPatient.patientCode}).`
      );
      setDeletingPatient(null);
      await fetchPatients();
      onDataChanged();
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiError ? err.message : 'Unable to delete patient record.'
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
              placeholder="Search by patient name or ID..."
              aria-label="Search patients"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-[#0B2239] outline-none transition-colors focus:border-[#0284C7] focus:bg-white focus:ring-2 focus:ring-[#0284C7]/20"
            />
          </div>

          <div
            role="group"
            aria-label="Filter by gender"
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1"
          >
            {(['All', 'Male', 'Female', 'Other'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setGenderFilter(option)}
                className={`whitespace-nowrap shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  genderFilter === option
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
          <span>Register Patient</span>
        </button>
      </div>

      {/* Patients Data Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="h-10 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : patients.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-[#0B2239]">No matching patient records found</p>
            <p className="mt-1 text-xs text-slate-500">
              {search || genderFilter !== 'All'
                ? 'Try clearing your search query or switching the gender filter.'
                : 'Register your first patient to begin managing clinical records.'}
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0284C7] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0369A1]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Register Patient</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                  <th className="px-5 py-3.5">Patient ID</th>
                  <th className="px-4 py-3.5">Full Name</th>
                  <th className="px-4 py-3.5">Age / Gender</th>
                  <th className="px-4 py-3.5">Phone Number</th>
                  <th className="px-4 py-3.5">Address</th>
                  <th className="px-4 py-3.5">Registration Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patients.map((patient) => (
                  <tr key={patient.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-[#0284C7] whitespace-nowrap tabular-nums">
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
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-slate-600">
                      {patient.address}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap tabular-nums">
                      {patient.registrationDate}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void openViewModal(patient)}
                          title="View Details"
                          aria-label={`View ${patient.fullName}`}
                          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-sky-50 hover:text-[#0284C7]"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(patient)}
                          title="Edit Patient"
                          aria-label={`Edit ${patient.fullName}`}
                          className="rounded-md p-2 text-slate-500 transition-colors hover:bg-sky-50 hover:text-[#0284C7]"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingPatient(patient)}
                          title="Delete Patient"
                          aria-label={`Delete ${patient.fullName}`}
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

      {/* Add / Edit Patient Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B2239]/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="patient-form-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) {
              setFormOpen(false);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 id="patient-form-title" className="text-base font-semibold text-[#0B2239]">
                {editingPatient
                  ? `Edit Patient · ${editingPatient.patientCode}`
                  : 'Register New Patient'}
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
                <label htmlFor="patient-name" className="block text-xs font-semibold text-[#0B2239]">
                  Full Name
                </label>
                <input
                  id="patient-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  value={formState.fullName}
                  onChange={(e) => setFormState({ ...formState, fullName: e.target.value })}
                  placeholder="Enter patient's full name"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="patient-age" className="block text-xs font-semibold text-[#0B2239]">
                    Age
                  </label>
                  <input
                    id="patient-age"
                    type="number"
                    required
                    min={0}
                    max={130}
                    value={formState.age}
                    onChange={(e) => setFormState({ ...formState, age: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="patient-gender"
                    className="block text-xs font-semibold text-[#0B2239]"
                  >
                    Gender
                  </label>
                  <select
                    id="patient-gender"
                    value={formState.gender}
                    onChange={(e) =>
                      setFormState({ ...formState, gender: e.target.value as Gender })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="patient-reg-date"
                    className="block text-xs font-semibold text-[#0B2239]"
                  >
                    Registration Date
                  </label>
                  <input
                    id="patient-reg-date"
                    type="date"
                    required
                    value={formState.registrationDate}
                    onChange={(e) =>
                      setFormState({ ...formState, registrationDate: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="patient-phone" className="block text-xs font-semibold text-[#0B2239]">
                  Phone Number
                </label>
                <input
                  id="patient-phone"
                  type="tel"
                  required
                  minLength={7}
                  maxLength={30}
                  value={formState.phoneNumber}
                  onChange={(e) => setFormState({ ...formState, phoneNumber: e.target.value })}
                  placeholder="+1-555-234-5678"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#0284C7] focus:ring-2 focus:ring-[#0284C7]/20"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Include 7–15 digits (spaces, dashes, or parentheses allowed).
                </p>
              </div>

              <div>
                <label
                  htmlFor="patient-address"
                  className="block text-xs font-semibold text-[#0B2239]"
                >
                  Residential Address
                </label>
                <textarea
                  id="patient-address"
                  required
                  rows={2}
                  minLength={3}
                  maxLength={255}
                  value={formState.address}
                  onChange={(e) => setFormState({ ...formState, address: e.target.value })}
                  placeholder="Street, apartment, city"
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
                  disabled={saving}
                  className="rounded-lg bg-[#0284C7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0369A1] disabled:opacity-60"
                >
                  {saving
                    ? 'Saving...'
                    : editingPatient
                      ? 'Save Changes'
                      : 'Register Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Patient Details Modal */}
      {viewingPatient && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B2239]/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="patient-detail-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setViewingPatient(null);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <p className="font-mono text-xs font-semibold text-[#0284C7]">
                  {viewingPatient.patientCode}
                </p>
                <h3 id="patient-detail-title" className="text-base font-semibold text-[#0B2239]">
                  {viewingPatient.fullName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingPatient(null)}
                aria-label="Close patient details"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5 text-sm">
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs text-slate-500">Age &amp; Gender</dt>
                  <dd className="mt-0.5 font-medium text-[#0B2239]">
                    {viewingPatient.age} years · {viewingPatient.gender}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Phone Number</dt>
                  <dd className="mt-0.5 font-mono text-xs font-medium text-[#0B2239]">
                    {viewingPatient.phoneNumber}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Registration Date</dt>
                  <dd className="mt-0.5 font-mono text-xs font-medium text-[#0B2239]">
                    {viewingPatient.registrationDate}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Address</dt>
                  <dd className="mt-0.5 text-xs text-[#0B2239]">{viewingPatient.address}</dd>
                </div>
              </dl>

              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-semibold text-slate-500">Appointment History</h4>
                {loadingDetails ? (
                  <p className="py-4 text-xs text-slate-500">Loading appointments...</p>
                ) : patientAppointments.length === 0 ? (
                  <p className="py-4 text-xs text-slate-500">
                    No appointments recorded for this patient.
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-slate-100">
                    {patientAppointments.map((appt) => (
                      <li key={appt.id} className="flex items-center justify-between py-2 text-xs">
                        <div>
                          <span className="font-mono font-medium text-[#0B2239]">
                            {appt.appointmentDate} · {appt.appointmentTime}
                          </span>
                          <p className="text-slate-500">
                            {appt.doctorName} ({appt.doctorSpecialization})
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
                  const target = viewingPatient;
                  setViewingPatient(null);
                  openEditModal(target);
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#0B2239] hover:bg-slate-50"
              >
                Edit Patient
              </button>
              <button
                type="button"
                onClick={() => setViewingPatient(null)}
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
        open={Boolean(deletingPatient)}
        title="Delete Patient Record"
        description={
          deletingPatient
            ? storageMode === 'demo'
              ? `Remove ${deletingPatient.fullName} (${deletingPatient.patientCode})? In Demo Mode, any appointments linked to this patient will also be cascade-deleted in temporary memory.`
              : `Remove unlinked patient ${deletingPatient.fullName} (${deletingPatient.patientCode})? Cascading hard deletes are disabled in Azure SQL production mode—patients with existing appointments cannot be deleted, and this action is recorded permanently in the Audit Activity Log.`
            : ''
        }
        confirmLabel="Delete Patient"
        tone="danger"
        busy={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeletingPatient(null)}
      />
    </div>
  );
}
