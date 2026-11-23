import type { HospitalRepository } from './hospitalRepository.ts';
import type {
  ActivityAction,
  ActivityEntityType,
  ActivityLogEntry,
  ActivityLogFilter,
  AdminUserRecord,
  Appointment,
  AppointmentFilter,
  AppointmentInput,
  AppointmentStatus,
  AuditActor,
  DashboardSummary,
  Doctor,
  DoctorAvailability,
  DoctorInput,
  Gender,
  Patient,
  PatientInput,
  StorageModeInfo,
} from '../types.ts';

const DEFAULT_AUDIT_ACTOR: AuditActor = {
  fullName: 'Hospital Administrator',
  email: 'system@medicloud.local',
};

function formatDateOffset(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

interface StoredAppointment {
  id: number;
  appointmentCode: string;
  patientId: number;
  doctorId: number;
  appointmentDate: string;
  appointmentTime: string;
  reason: string;
  status: AppointmentStatus;
  createdAt: string;
}

export class DemoHospitalRepository implements HospitalRepository {
  private users: AdminUserRecord[] = [];
  private patients: Patient[] = [];
  private doctors: Doctor[] = [];
  private appointments: StoredAppointment[] = [];
  private activityLogs: ActivityLogEntry[] = [];
  private nextUserId = 1;
  private nextPatientId = 1;
  private nextDoctorId = 1;
  private nextAppointmentId = 1;
  private nextActivityLogId = 1;

  constructor() {
    this.seedInitialData();
  }

  getModeInfo(): StorageModeInfo {
    return {
      mode: 'demo',
      label: 'Demo Mode (In-Memory Sample Data)',
      persistent: false,
      databaseName: null,
      serverHost: null,
    };
  }

  async initialize(): Promise<void> {
    // In-memory demo store is initialized synchronously in constructor.
  }

  async resetDemoData(): Promise<void> {
    this.seedInitialData();
  }

  private seedInitialData(): void {
    const nowIso = new Date().toISOString();

    this.patients = [
      {
        id: 1,
        patientCode: 'PAT-1001',
        fullName: 'Aarav Sharma',
        age: 42,
        gender: 'Male',
        phoneNumber: '+1-555-204-8812',
        address: '412 Oakwood Avenue, North Wing',
        registrationDate: formatDateOffset(-14),
        createdAt: nowIso,
      },
      {
        id: 2,
        patientCode: 'PAT-1002',
        fullName: 'Maya Lin',
        age: 29,
        gender: 'Female',
        phoneNumber: '+1-555-309-4410',
        address: '78 Harborview Lane, Apt 4B',
        registrationDate: formatDateOffset(-10),
        createdAt: nowIso,
      },
      {
        id: 3,
        patientCode: 'PAT-1003',
        fullName: 'Robert Thornton',
        age: 64,
        gender: 'Male',
        phoneNumber: '+1-555-418-9921',
        address: '1902 Cedar Crest Road',
        registrationDate: formatDateOffset(-7),
        createdAt: nowIso,
      },
      {
        id: 4,
        patientCode: 'PAT-1004',
        fullName: 'Priya Nair',
        age: 35,
        gender: 'Female',
        phoneNumber: '+1-555-612-3305',
        address: '885 Maple Grove Drive',
        registrationDate: formatDateOffset(-4),
        createdAt: nowIso,
      },
      {
        id: 5,
        patientCode: 'PAT-1005',
        fullName: 'Daniel Okafor',
        age: 51,
        gender: 'Male',
        phoneNumber: '+1-555-734-1290',
        address: '230 Riverbend Parkway',
        registrationDate: formatDateOffset(-2),
        createdAt: nowIso,
      },
      {
        id: 6,
        patientCode: 'PAT-1006',
        fullName: 'Sofia Alvarez',
        age: 19,
        gender: 'Female',
        phoneNumber: '+1-555-845-6723',
        address: '614 University Terrace',
        registrationDate: formatDateOffset(-1),
        createdAt: nowIso,
      },
      {
        id: 7,
        patientCode: 'PAT-1007',
        fullName: 'Liam Henderson',
        age: 47,
        gender: 'Male',
        phoneNumber: '+1-555-901-5540',
        address: '1124 Willowbrook Court',
        registrationDate: formatDateOffset(0),
        createdAt: nowIso,
      },
      {
        id: 8,
        patientCode: 'PAT-1008',
        fullName: 'Hannah Brooks',
        age: 33,
        gender: 'Female',
        phoneNumber: '+1-555-962-1184',
        address: '309 Meadowlark Street',
        registrationDate: formatDateOffset(0),
        createdAt: nowIso,
      },
    ];
    this.nextPatientId = 9;

    this.doctors = [
      {
        id: 1,
        doctorCode: 'DOC-2001',
        fullName: 'Dr. Catherine Mercer',
        specialization: 'Cardiology',
        phoneNumber: '+1-555-110-2001',
        availability: 'Available',
        createdAt: nowIso,
      },
      {
        id: 2,
        doctorCode: 'DOC-2002',
        fullName: 'Dr. Vikram Patel',
        specialization: 'Neurology',
        phoneNumber: '+1-555-110-2002',
        availability: 'Available',
        createdAt: nowIso,
      },
      {
        id: 3,
        doctorCode: 'DOC-2003',
        fullName: 'Dr. Grace Kim',
        specialization: 'Pediatrics',
        phoneNumber: '+1-555-110-2003',
        availability: 'In Consultation',
        createdAt: nowIso,
      },
      {
        id: 4,
        doctorCode: 'DOC-2004',
        fullName: 'Dr. Marcus Bennett',
        specialization: 'Orthopedics',
        phoneNumber: '+1-555-110-2004',
        availability: 'Available',
        createdAt: nowIso,
      },
      {
        id: 5,
        doctorCode: 'DOC-2005',
        fullName: 'Dr. Nadia Al-Mansoor',
        specialization: 'Internal Medicine',
        phoneNumber: '+1-555-110-2005',
        availability: 'Available',
        createdAt: nowIso,
      },
      {
        id: 6,
        doctorCode: 'DOC-2006',
        fullName: 'Dr. Oliver Wright',
        specialization: 'Dermatology',
        phoneNumber: '+1-555-110-2006',
        availability: 'On Leave',
        createdAt: nowIso,
      },
    ];
    this.nextDoctorId = 7;

    this.appointments = [
      {
        id: 1,
        appointmentCode: 'APT-3001',
        patientId: 1,
        doctorId: 1,
        appointmentDate: formatDateOffset(0),
        appointmentTime: '09:00',
        reason: 'Routine cardiac follow-up & ECG review',
        status: 'Completed',
        createdAt: nowIso,
      },
      {
        id: 2,
        appointmentCode: 'APT-3002',
        patientId: 2,
        doctorId: 2,
        appointmentDate: formatDateOffset(0),
        appointmentTime: '10:30',
        reason: 'Migraine evaluation and neurology consult',
        status: 'Scheduled',
        createdAt: nowIso,
      },
      {
        id: 3,
        appointmentCode: 'APT-3003',
        patientId: 3,
        doctorId: 4,
        appointmentDate: formatDateOffset(0),
        appointmentTime: '11:15',
        reason: 'Post-operative knee mobility check',
        status: 'Scheduled',
        createdAt: nowIso,
      },
      {
        id: 4,
        appointmentCode: 'APT-3004',
        patientId: 7,
        doctorId: 5,
        appointmentDate: formatDateOffset(0),
        appointmentTime: '14:00',
        reason: 'Annual physical and blood panel review',
        status: 'Scheduled',
        createdAt: nowIso,
      },
      {
        id: 5,
        appointmentCode: 'APT-3005',
        patientId: 5,
        doctorId: 1,
        appointmentDate: formatDateOffset(0),
        appointmentTime: '15:30',
        reason: 'Hypertension medication adjustment',
        status: 'Cancelled',
        createdAt: nowIso,
      },
      {
        id: 6,
        appointmentCode: 'APT-3006',
        patientId: 6,
        doctorId: 3,
        appointmentDate: formatDateOffset(1),
        appointmentTime: '09:30',
        reason: 'Adolescent wellness & immunization review',
        status: 'Scheduled',
        createdAt: nowIso,
      },
      {
        id: 7,
        appointmentCode: 'APT-3007',
        patientId: 4,
        doctorId: 5,
        appointmentDate: formatDateOffset(1),
        appointmentTime: '11:00',
        reason: 'Follow-up diagnostic consultation',
        status: 'Scheduled',
        createdAt: nowIso,
      },
      {
        id: 8,
        appointmentCode: 'APT-3008',
        patientId: 8,
        doctorId: 5,
        appointmentDate: formatDateOffset(-2),
        appointmentTime: '13:45',
        reason: 'Initial outpatient assessment',
        status: 'Completed',
        createdAt: nowIso,
      },
      {
        id: 9,
        appointmentCode: 'APT-3009',
        patientId: 3,
        doctorId: 1,
        appointmentDate: formatDateOffset(-3),
        appointmentTime: '16:00',
        reason: 'Echocardiogram results review',
        status: 'Completed',
        createdAt: nowIso,
      },
    ];
    this.nextAppointmentId = 10;

    const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
    this.activityLogs = [
      {
        id: 1,
        entityType: 'Appointment',
        entityId: 1,
        entityCode: 'APT-3001',
        action: 'Status Changed',
        actorName: 'System Seed',
        actorEmail: 'system@medicloud.local',
        summary: 'Marked appointment APT-3001 for Aarav Sharma as Completed',
        createdAt: ago(95),
      },
      {
        id: 2,
        entityType: 'Doctor',
        entityId: 5,
        entityCode: 'DOC-2005',
        action: 'Created',
        actorName: 'System Seed',
        actorEmail: 'system@medicloud.local',
        summary: 'Added Dr. Nadia Al-Mansoor · Internal Medicine (DOC-2005)',
        createdAt: ago(62),
      },
      {
        id: 3,
        entityType: 'Patient',
        entityId: 8,
        entityCode: 'PAT-1008',
        action: 'Created',
        actorName: 'System Seed',
        actorEmail: 'system@medicloud.local',
        summary: 'Registered patient Hannah Brooks (PAT-1008)',
        createdAt: ago(28),
      },
      {
        id: 4,
        entityType: 'Appointment',
        entityId: 2,
        entityCode: 'APT-3002',
        action: 'Created',
        actorName: 'System Seed',
        actorEmail: 'system@medicloud.local',
        summary: 'Booked appointment APT-3002 for Maya Lin with Dr. Vikram Patel',
        createdAt: ago(12),
      },
    ];
    this.nextActivityLogId = 5;
  }

  private recordActivity(
    entityType: ActivityEntityType,
    entityId: number,
    entityCode: string,
    action: ActivityAction,
    summary: string,
    actor?: AuditActor
  ): void {
    const resolvedActor = actor ?? DEFAULT_AUDIT_ACTOR;
    this.activityLogs.unshift({
      id: this.nextActivityLogId++,
      entityType,
      entityId,
      entityCode,
      action,
      actorName: resolvedActor.fullName,
      actorEmail: resolvedActor.email,
      summary,
      createdAt: new Date().toISOString(),
    });
    if (this.activityLogs.length > 500) {
      this.activityLogs.length = 500;
    }
  }

  private hydrateAppointment(item: StoredAppointment): Appointment {
    const patient = this.patients.find((p) => p.id === item.patientId);
    const doctor = this.doctors.find((d) => d.id === item.doctorId);

    return {
      id: item.id,
      appointmentCode: item.appointmentCode,
      patientId: item.patientId,
      patientCode: patient?.patientCode ?? `PAT-${1000 + item.patientId}`,
      patientName: patient?.fullName ?? 'Unknown Patient',
      doctorId: item.doctorId,
      doctorCode: doctor?.doctorCode ?? `DOC-${2000 + item.doctorId}`,
      doctorName: doctor?.fullName ?? 'Unknown Doctor',
      doctorSpecialization: doctor?.specialization ?? 'General',
      appointmentDate: item.appointmentDate,
      appointmentTime: item.appointmentTime,
      reason: item.reason,
      status: item.status,
      createdAt: item.createdAt,
    };
  }

  async hasAnyAdminUser(): Promise<boolean> {
    return this.users.some((u) => u.isActive);
  }

  async findUserByEmail(email: string): Promise<AdminUserRecord | null> {
    const normalized = email.trim().toLowerCase();
    return this.users.find((u) => u.email.toLowerCase() === normalized && u.isActive) ?? null;
  }

  async createAdminUser(input: {
    fullName: string;
    email: string;
    passwordHash: string;
    role?: 'Administrator' | 'Staff';
  }): Promise<AdminUserRecord> {
    const record: AdminUserRecord = {
      id: this.nextUserId++,
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      passwordHash: input.passwordHash,
      role: input.role ?? 'Administrator',
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    this.users.push(record);
    return record;
  }

  async getDashboardSummary(todayDate?: string): Promise<DashboardSummary> {
    const today = todayDate || formatDateOffset(0);
    const hydrated = this.appointments.map((a) => this.hydrateAppointment(a));
    const todaysSchedule = hydrated
      .filter((a) => a.appointmentDate === today)
      .sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime));

    const scheduled = hydrated.filter((a) => a.status === 'Scheduled').length;
    const completed = hydrated.filter((a) => a.status === 'Completed').length;
    const cancelled = hydrated.filter((a) => a.status === 'Cancelled').length;

    const recentRegistrations = [...this.patients]
      .sort((a, b) => {
        const dateCmp = b.registrationDate.localeCompare(a.registrationDate);
        return dateCmp !== 0 ? dateCmp : b.id - a.id;
      })
      .slice(0, 5);

    return {
      totalPatients: this.patients.length,
      totalDoctors: this.doctors.length,
      availableDoctors: this.doctors.filter((d) => d.availability === 'Available').length,
      totalAppointments: hydrated.length,
      todayAppointments: todaysSchedule.length,
      todayScheduled: todaysSchedule.filter((a) => a.status === 'Scheduled').length,
      appointmentStats: {
        scheduled,
        completed,
        cancelled,
      },
      recentRegistrations,
      todaysSchedule,
      recentActivity: this.activityLogs.slice(0, 8),
    };
  }

  async listActivityLogs(filter?: ActivityLogFilter): Promise<ActivityLogEntry[]> {
    const entityFilter = filter?.entityType || 'All';
    const actionFilter = filter?.action || 'All';
    const term = filter?.search?.trim().toLowerCase() || '';
    const limit = Math.min(Math.max(filter?.limit ?? 50, 1), 100);

    return this.activityLogs
      .filter((entry) => {
        if (entityFilter !== 'All' && entry.entityType !== entityFilter) {
          return false;
        }
        if (actionFilter !== 'All' && entry.action !== actionFilter) {
          return false;
        }
        if (!term) {
          return true;
        }
        return (
          entry.entityCode.toLowerCase().includes(term) ||
          entry.summary.toLowerCase().includes(term) ||
          entry.actorName.toLowerCase().includes(term) ||
          entry.actorEmail.toLowerCase().includes(term)
        );
      })
      .slice(0, limit);
  }

  async listPatients(search?: string, gender?: Gender | 'All'): Promise<Patient[]> {
    const term = search?.trim().toLowerCase() || '';
    return this.patients
      .filter((p) => {
        if (gender && gender !== 'All' && p.gender !== gender) {
          return false;
        }
        if (!term) {
          return true;
        }
        return (
          p.fullName.toLowerCase().includes(term) ||
          p.patientCode.toLowerCase().includes(term) ||
          p.phoneNumber.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => b.id - a.id);
  }

  async getPatientById(id: number): Promise<Patient | null> {
    return this.patients.find((p) => p.id === id) ?? null;
  }

  async createPatient(input: PatientInput, actor?: AuditActor): Promise<Patient> {
    const duplicate = this.patients.some(
      (p) =>
        p.fullName.trim().toLowerCase() === input.fullName.trim().toLowerCase() &&
        p.phoneNumber.trim() === input.phoneNumber.trim()
    );
    if (duplicate) {
      throw new Error('A patient with the same full name and phone number is already registered.');
    }

    const id = this.nextPatientId++;
    const patient: Patient = {
      id,
      patientCode: `PAT-${1000 + id}`,
      fullName: input.fullName,
      age: input.age,
      gender: input.gender,
      phoneNumber: input.phoneNumber,
      address: input.address,
      registrationDate: input.registrationDate,
      createdAt: new Date().toISOString(),
    };
    this.patients.push(patient);
    this.recordActivity(
      'Patient',
      patient.id,
      patient.patientCode,
      'Created',
      `Registered patient ${patient.fullName} (${patient.patientCode})`,
      actor
    );
    return patient;
  }

  async updatePatient(id: number, input: PatientInput, actor?: AuditActor): Promise<Patient | null> {
    const existing = this.patients.find((p) => p.id === id);
    if (!existing) {
      return null;
    }
    const duplicate = this.patients.some(
      (p) =>
        p.id !== id &&
        p.fullName.trim().toLowerCase() === input.fullName.trim().toLowerCase() &&
        p.phoneNumber.trim() === input.phoneNumber.trim()
    );
    if (duplicate) {
      throw new Error('A patient with the same full name and phone number is already registered.');
    }

    existing.fullName = input.fullName;
    existing.age = input.age;
    existing.gender = input.gender;
    existing.phoneNumber = input.phoneNumber;
    existing.address = input.address;
    existing.registrationDate = input.registrationDate;
    this.recordActivity(
      'Patient',
      existing.id,
      existing.patientCode,
      'Updated',
      `Updated patient record for ${existing.fullName} (${existing.patientCode})`,
      actor
    );
    return { ...existing };
  }

  async deletePatient(id: number, actor?: AuditActor): Promise<boolean> {
    const index = this.patients.findIndex((p) => p.id === id);
    if (index === -1) {
      return false;
    }
    const [removed] = this.patients.splice(index, 1);
    const beforeCount = this.appointments.length;
    this.appointments = this.appointments.filter((a) => a.patientId !== id);
    const cascadedCount = beforeCount - this.appointments.length;
    const cascadeNote =
      cascadedCount > 0
        ? ` (${cascadedCount} linked appointment${cascadedCount === 1 ? '' : 's'} removed)`
        : '';
    this.recordActivity(
      'Patient',
      removed.id,
      removed.patientCode,
      'Deleted',
      `Deleted patient ${removed.fullName} (${removed.patientCode})${cascadeNote}`,
      actor
    );
    return true;
  }

  async listDoctors(search?: string, availability?: DoctorAvailability | 'All'): Promise<Doctor[]> {
    const term = search?.trim().toLowerCase() || '';
    return this.doctors
      .filter((d) => {
        if (availability && availability !== 'All' && d.availability !== availability) {
          return false;
        }
        if (!term) {
          return true;
        }
        return (
          d.fullName.toLowerCase().includes(term) ||
          d.doctorCode.toLowerCase().includes(term) ||
          d.specialization.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => a.id - b.id);
  }

  async getDoctorById(id: number): Promise<Doctor | null> {
    return this.doctors.find((d) => d.id === id) ?? null;
  }

  async createDoctor(input: DoctorInput, actor?: AuditActor): Promise<Doctor> {
    const duplicate = this.doctors.some(
      (d) =>
        d.fullName.trim().toLowerCase() === input.fullName.trim().toLowerCase() &&
        d.phoneNumber.trim() === input.phoneNumber.trim()
    );
    if (duplicate) {
      throw new Error(
        'A doctor with the same full name and phone number already exists in the directory.'
      );
    }

    const id = this.nextDoctorId++;
    const doctor: Doctor = {
      id,
      doctorCode: `DOC-${2000 + id}`,
      fullName: input.fullName,
      specialization: input.specialization,
      phoneNumber: input.phoneNumber,
      availability: input.availability,
      createdAt: new Date().toISOString(),
    };
    this.doctors.push(doctor);
    this.recordActivity(
      'Doctor',
      doctor.id,
      doctor.doctorCode,
      'Created',
      `Added ${doctor.fullName} · ${doctor.specialization} (${doctor.doctorCode})`,
      actor
    );
    return doctor;
  }

  async updateDoctor(id: number, input: DoctorInput, actor?: AuditActor): Promise<Doctor | null> {
    const existing = this.doctors.find((d) => d.id === id);
    if (!existing) {
      return null;
    }
    const duplicate = this.doctors.some(
      (d) =>
        d.id !== id &&
        d.fullName.trim().toLowerCase() === input.fullName.trim().toLowerCase() &&
        d.phoneNumber.trim() === input.phoneNumber.trim()
    );
    if (duplicate) {
      throw new Error(
        'A doctor with the same full name and phone number already exists in the directory.'
      );
    }

    existing.fullName = input.fullName;
    existing.specialization = input.specialization;
    existing.phoneNumber = input.phoneNumber;
    existing.availability = input.availability;
    this.recordActivity(
      'Doctor',
      existing.id,
      existing.doctorCode,
      'Updated',
      `Updated profile for ${existing.fullName} · ${existing.availability} (${existing.doctorCode})`,
      actor
    );
    return { ...existing };
  }

  async deleteDoctor(id: number, actor?: AuditActor): Promise<boolean> {
    const index = this.doctors.findIndex((d) => d.id === id);
    if (index === -1) {
      return false;
    }
    const [removed] = this.doctors.splice(index, 1);
    const beforeCount = this.appointments.length;
    this.appointments = this.appointments.filter((a) => a.doctorId !== id);
    const cascadedCount = beforeCount - this.appointments.length;
    const cascadeNote =
      cascadedCount > 0
        ? ` (${cascadedCount} linked appointment${cascadedCount === 1 ? '' : 's'} removed)`
        : '';
    this.recordActivity(
      'Doctor',
      removed.id,
      removed.doctorCode,
      'Deleted',
      `Removed ${removed.fullName} (${removed.doctorCode}) from directory${cascadeNote}`,
      actor
    );
    return true;
  }

  async listAppointments(filter?: AppointmentFilter): Promise<Appointment[]> {
    const term = filter?.search?.trim().toLowerCase() || '';
    const dateFilter = filter?.date?.trim() || '';
    const statusFilter = filter?.status || 'All';
    const patientIdFilter = filter?.patientId;
    const doctorIdFilter = filter?.doctorId;

    return this.appointments
      .map((a) => this.hydrateAppointment(a))
      .filter((a) => {
        if (patientIdFilter && a.patientId !== patientIdFilter) {
          return false;
        }
        if (doctorIdFilter && a.doctorId !== doctorIdFilter) {
          return false;
        }
        if (dateFilter && a.appointmentDate !== dateFilter) {
          return false;
        }
        if (statusFilter !== 'All' && a.status !== statusFilter) {
          return false;
        }
        if (!term) {
          return true;
        }
        return (
          a.appointmentCode.toLowerCase().includes(term) ||
          a.patientName.toLowerCase().includes(term) ||
          a.patientCode.toLowerCase().includes(term) ||
          a.doctorName.toLowerCase().includes(term) ||
          a.doctorCode.toLowerCase().includes(term) ||
          a.doctorSpecialization.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        const dateCmp = b.appointmentDate.localeCompare(a.appointmentDate);
        return dateCmp !== 0 ? dateCmp : a.appointmentTime.localeCompare(b.appointmentTime);
      });
  }

  async getAppointmentById(id: number): Promise<Appointment | null> {
    const found = this.appointments.find((a) => a.id === id);
    return found ? this.hydrateAppointment(found) : null;
  }

  private validateAppointmentIntegrity(
    input: AppointmentInput,
    targetStatus: AppointmentStatus,
    excludeId?: number
  ): void {
    const patient = this.patients.find((p) => p.id === input.patientId);
    if (!patient) {
      throw new Error('Selected patient does not exist.');
    }
    const doctor = this.doctors.find((d) => d.id === input.doctorId);
    if (!doctor) {
      throw new Error('Selected doctor does not exist.');
    }

    if (targetStatus === 'Scheduled') {
      if (doctor.availability === 'On Leave') {
        throw new Error(
          'Cannot book a scheduled appointment with a doctor currently marked On Leave.'
        );
      }
      const doctorConflict = this.appointments.some(
        (a) =>
          a.id !== excludeId &&
          a.status === 'Scheduled' &&
          a.doctorId === input.doctorId &&
          a.appointmentDate === input.appointmentDate &&
          a.appointmentTime === input.appointmentTime
      );
      if (doctorConflict) {
        throw new Error('This doctor already has a scheduled appointment at that date and time.');
      }

      const patientConflict = this.appointments.some(
        (a) =>
          a.id !== excludeId &&
          a.status === 'Scheduled' &&
          a.patientId === input.patientId &&
          a.appointmentDate === input.appointmentDate &&
          a.appointmentTime === input.appointmentTime
      );
      if (patientConflict) {
        throw new Error('This patient already has a scheduled appointment at that date and time.');
      }
    }
  }

  async createAppointment(input: AppointmentInput, actor?: AuditActor): Promise<Appointment> {
    const targetStatus = input.status || 'Scheduled';
    this.validateAppointmentIntegrity(input, targetStatus);

    const id = this.nextAppointmentId++;
    const record: StoredAppointment = {
      id,
      appointmentCode: `APT-${3000 + id}`,
      patientId: input.patientId,
      doctorId: input.doctorId,
      appointmentDate: input.appointmentDate,
      appointmentTime: input.appointmentTime,
      reason: input.reason?.trim() || 'General outpatient consultation',
      status: targetStatus,
      createdAt: new Date().toISOString(),
    };
    this.appointments.push(record);
    const hydrated = this.hydrateAppointment(record);
    this.recordActivity(
      'Appointment',
      hydrated.id,
      hydrated.appointmentCode,
      'Created',
      `Booked ${hydrated.appointmentCode} for ${hydrated.patientName} with ${hydrated.doctorName} (${hydrated.appointmentDate} ${hydrated.appointmentTime})`,
      actor
    );
    return hydrated;
  }

  async updateAppointment(
    id: number,
    input: AppointmentInput,
    actor?: AuditActor
  ): Promise<Appointment | null> {
    const existing = this.appointments.find((a) => a.id === id);
    if (!existing) {
      return null;
    }

    const targetStatus = input.status || existing.status;
    this.validateAppointmentIntegrity(input, targetStatus, id);

    existing.patientId = input.patientId;
    existing.doctorId = input.doctorId;
    existing.appointmentDate = input.appointmentDate;
    existing.appointmentTime = input.appointmentTime;
    existing.reason = input.reason?.trim() || existing.reason;
    if (input.status) {
      existing.status = input.status;
    }
    const hydrated = this.hydrateAppointment(existing);
    this.recordActivity(
      'Appointment',
      hydrated.id,
      hydrated.appointmentCode,
      'Updated',
      `Updated appointment ${hydrated.appointmentCode} (${hydrated.patientName} · ${hydrated.appointmentDate} ${hydrated.appointmentTime})`,
      actor
    );
    return hydrated;
  }

  async updateAppointmentStatus(
    id: number,
    status: AppointmentStatus,
    actor?: AuditActor
  ): Promise<Appointment | null> {
    const existing = this.appointments.find((a) => a.id === id);
    if (!existing) {
      return null;
    }
    if (status === 'Scheduled' && existing.status !== 'Scheduled') {
      this.validateAppointmentIntegrity(
        {
          patientId: existing.patientId,
          doctorId: existing.doctorId,
          appointmentDate: existing.appointmentDate,
          appointmentTime: existing.appointmentTime,
          reason: existing.reason,
          status,
        },
        status,
        id
      );
    }
    const previousStatus = existing.status;
    existing.status = status;
    const hydrated = this.hydrateAppointment(existing);
    this.recordActivity(
      'Appointment',
      hydrated.id,
      hydrated.appointmentCode,
      'Status Changed',
      `Changed ${hydrated.appointmentCode} (${hydrated.patientName}) status from ${previousStatus} to ${status}`,
      actor
    );
    return hydrated;
  }

  async deleteAppointment(id: number, actor?: AuditActor): Promise<boolean> {
    const index = this.appointments.findIndex((a) => a.id === id);
    if (index === -1) {
      return false;
    }
    const hydrated = this.hydrateAppointment(this.appointments[index]);
    this.appointments.splice(index, 1);
    this.recordActivity(
      'Appointment',
      hydrated.id,
      hydrated.appointmentCode,
      'Deleted',
      `Deleted appointment ${hydrated.appointmentCode} for ${hydrated.patientName}`,
      actor
    );
    return true;
  }
}
