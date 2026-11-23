export type StorageMode = 'demo' | 'azure_sql';

export type Gender = 'Male' | 'Female' | 'Other';

export type DoctorAvailability = 'Available' | 'In Consultation' | 'On Leave';

export type AppointmentStatus = 'Scheduled' | 'Completed' | 'Cancelled';

export type ActiveSection = 'dashboard' | 'patients' | 'doctors' | 'appointments';

export interface StorageModeInfo {
  mode: StorageMode;
  label: string;
  persistent: boolean;
  databaseName: string | null;
  serverHost: string | null;
}

export interface AuthStatusResponse {
  modeInfo: StorageModeInfo;
  demoLoginAvailable: boolean;
  needsFirstRunSetup: boolean;
  hasConfiguredAdmin: boolean;
}

export interface AuthUserProfile {
  id: number;
  fullName: string;
  email: string;
  role: 'Administrator' | 'Staff';
}

export interface Patient {
  id: number;
  patientCode: string;
  fullName: string;
  age: number;
  gender: Gender;
  phoneNumber: string;
  address: string;
  registrationDate: string;
  createdAt: string;
}

export interface PatientPayload {
  fullName: string;
  age: number;
  gender: Gender;
  phoneNumber: string;
  address: string;
  registrationDate: string;
}

export interface Doctor {
  id: number;
  doctorCode: string;
  fullName: string;
  specialization: string;
  phoneNumber: string;
  availability: DoctorAvailability;
  createdAt: string;
}

export interface DoctorPayload {
  fullName: string;
  specialization: string;
  phoneNumber: string;
  availability: DoctorAvailability;
}

export interface Appointment {
  id: number;
  appointmentCode: string;
  patientId: number;
  patientCode: string;
  patientName: string;
  doctorId: number;
  doctorCode: string;
  doctorName: string;
  doctorSpecialization: string;
  appointmentDate: string;
  appointmentTime: string;
  reason: string;
  status: AppointmentStatus;
  createdAt: string;
}

export interface AppointmentPayload {
  patientId: number;
  doctorId: number;
  appointmentDate: string;
  appointmentTime: string;
  reason: string;
  status?: AppointmentStatus;
}

export type ActivityEntityType = 'Patient' | 'Doctor' | 'Appointment';

export type ActivityAction = 'Created' | 'Updated' | 'Status Changed' | 'Deleted';

export interface ActivityLogEntry {
  id: number;
  entityType: ActivityEntityType;
  entityId: number;
  entityCode: string;
  action: ActivityAction;
  actorName: string;
  actorEmail: string;
  summary: string;
  createdAt: string;
}

export interface DashboardSummary {
  totalPatients: number;
  totalDoctors: number;
  availableDoctors: number;
  totalAppointments: number;
  todayAppointments: number;
  todayScheduled: number;
  appointmentStats: {
    scheduled: number;
    completed: number;
    cancelled: number;
  };
  recentRegistrations: Patient[];
  todaysSchedule: Appointment[];
  recentActivity: ActivityLogEntry[];
}

