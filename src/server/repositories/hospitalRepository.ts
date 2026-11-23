import type {
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

export interface HospitalRepository {
  getModeInfo(): StorageModeInfo;
  initialize(): Promise<void>;

  // Admin & Users
  hasAnyAdminUser(): Promise<boolean>;
  findUserByEmail(email: string): Promise<AdminUserRecord | null>;
  createAdminUser(input: {
    fullName: string;
    email: string;
    passwordHash: string;
    role?: 'Administrator' | 'Staff';
  }): Promise<AdminUserRecord>;

  // Dashboard & Activity Logs
  getDashboardSummary(todayDate?: string): Promise<DashboardSummary>;
  listActivityLogs(filter?: ActivityLogFilter): Promise<ActivityLogEntry[]>;

  // Patients
  listPatients(search?: string, gender?: Gender | 'All'): Promise<Patient[]>;
  getPatientById(id: number): Promise<Patient | null>;
  createPatient(input: PatientInput, actor?: AuditActor): Promise<Patient>;
  updatePatient(id: number, input: PatientInput, actor?: AuditActor): Promise<Patient | null>;
  deletePatient(id: number, actor?: AuditActor): Promise<boolean>;

  // Doctors
  listDoctors(search?: string, availability?: DoctorAvailability | 'All'): Promise<Doctor[]>;
  getDoctorById(id: number): Promise<Doctor | null>;
  createDoctor(input: DoctorInput, actor?: AuditActor): Promise<Doctor>;
  updateDoctor(id: number, input: DoctorInput, actor?: AuditActor): Promise<Doctor | null>;
  deleteDoctor(id: number, actor?: AuditActor): Promise<boolean>;

  // Appointments
  listAppointments(filter?: AppointmentFilter): Promise<Appointment[]>;
  getAppointmentById(id: number): Promise<Appointment | null>;
  createAppointment(input: AppointmentInput, actor?: AuditActor): Promise<Appointment>;
  updateAppointment(
    id: number,
    input: AppointmentInput,
    actor?: AuditActor
  ): Promise<Appointment | null>;
  updateAppointmentStatus(
    id: number,
    status: AppointmentStatus,
    actor?: AuditActor
  ): Promise<Appointment | null>;
  deleteAppointment(id: number, actor?: AuditActor): Promise<boolean>;

  // Demo-only helper
  resetDemoData?(): Promise<void>;
}

