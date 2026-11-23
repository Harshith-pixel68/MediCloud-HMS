import type {
  ActivityAction,
  ActivityEntityType,
  ActivityLogEntry,
  Appointment,
  AppointmentPayload,
  AppointmentStatus,
  AuthStatusResponse,
  AuthUserProfile,
  DashboardSummary,
  Doctor,
  DoctorAvailability,
  DoctorPayload,
  Gender,
  Patient,
  PatientPayload,
  StorageModeInfo,
} from '../types/hospital';
import { getLocalTodayDate } from './dateUtils';

let memoryAuthToken: string | null = null;
let onUnauthorizedCallback: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  memoryAuthToken = token;
}

export function getAuthToken(): string | null {
  return memoryAuthToken;
}

export function setOnUnauthorized(handler: (() => void) | null): void {
  onUnauthorizedCallback = handler;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (memoryAuthToken) {
    headers.set('Authorization', `Bearer ${memoryAuthToken}`);
  }

  const response = await fetch(`/api${path}`, {
    ...init,
    headers,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }
    const message =
      typeof payload?.error === 'string' ? payload.error : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export interface AuthResponse {
  token: string;
  user: AuthUserProfile;
  modeInfo: StorageModeInfo;
}

export const hospitalApi = {
  getAuthStatus: (): Promise<AuthStatusResponse> => request('/auth/status'),

  login: (email: string, password: string): Promise<AuthResponse> =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  demoLogin: (): Promise<AuthResponse> =>
    request('/auth/demo-login', {
      method: 'POST',
    }),

  setupAdmin: (fullName: string, email: string, password: string): Promise<AuthResponse> =>
    request('/auth/setup-admin', {
      method: 'POST',
      body: JSON.stringify({ fullName, email, password }),
    }),

  logout: (): Promise<{ success: boolean }> =>
    request('/auth/logout', {
      method: 'POST',
    }),

  getDashboard: (): Promise<{ summary: DashboardSummary; modeInfo: StorageModeInfo }> => {
    const params = new URLSearchParams({ today: getLocalTodayDate() });
    return request(`/dashboard?${params.toString()}`);
  },

  listActivityLogs: (filters?: {
    entityType?: ActivityEntityType | 'All';
    action?: ActivityAction | 'All';
    search?: string;
    limit?: number;
  }): Promise<{ logs: ActivityLogEntry[] }> => {
    const params = new URLSearchParams();
    if (filters?.entityType && filters.entityType !== 'All') {
      params.set('entityType', filters.entityType);
    }
    if (filters?.action && filters.action !== 'All') {
      params.set('action', filters.action);
    }
    if (filters?.search?.trim()) {
      params.set('search', filters.search.trim());
    }
    if (filters?.limit) {
      params.set('limit', String(filters.limit));
    }
    const qs = params.toString();
    return request(`/activity-logs${qs ? `?${qs}` : ''}`);
  },

  listPatients: (search = '', gender: Gender | 'All' = 'All'): Promise<{ patients: Patient[] }> => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (gender !== 'All') params.set('gender', gender);
    const qs = params.toString();
    return request(`/patients${qs ? `?${qs}` : ''}`);
  },

  createPatient: (data: PatientPayload): Promise<{ patient: Patient }> =>
    request('/patients', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updatePatient: (id: number, data: PatientPayload): Promise<{ patient: Patient }> =>
    request(`/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deletePatient: (id: number): Promise<{ success: boolean }> =>
    request(`/patients/${id}`, {
      method: 'DELETE',
    }),

  listDoctors: (
    search = '',
    availability: DoctorAvailability | 'All' = 'All'
  ): Promise<{ doctors: Doctor[] }> => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (availability !== 'All') params.set('availability', availability);
    const qs = params.toString();
    return request(`/doctors${qs ? `?${qs}` : ''}`);
  },

  createDoctor: (data: DoctorPayload): Promise<{ doctor: Doctor }> =>
    request('/doctors', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateDoctor: (id: number, data: DoctorPayload): Promise<{ doctor: Doctor }> =>
    request(`/doctors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteDoctor: (id: number): Promise<{ success: boolean }> =>
    request(`/doctors/${id}`, {
      method: 'DELETE',
    }),

  listAppointments: (filters?: {
    search?: string;
    date?: string;
    status?: AppointmentStatus | 'All';
    patientId?: number;
    doctorId?: number;
  }): Promise<{ appointments: Appointment[] }> => {
    const params = new URLSearchParams();
    if (filters?.search?.trim()) params.set('search', filters.search.trim());
    if (filters?.date?.trim()) params.set('date', filters.date.trim());
    if (filters?.status && filters.status !== 'All') params.set('status', filters.status);
    if (filters?.patientId) params.set('patientId', String(filters.patientId));
    if (filters?.doctorId) params.set('doctorId', String(filters.doctorId));
    const qs = params.toString();
    return request(`/appointments${qs ? `?${qs}` : ''}`);
  },

  createAppointment: (data: AppointmentPayload): Promise<{ appointment: Appointment }> =>
    request('/appointments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAppointment: (id: number, data: AppointmentPayload): Promise<{ appointment: Appointment }> =>
    request(`/appointments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  updateAppointmentStatus: (
    id: number,
    status: AppointmentStatus
  ): Promise<{ appointment: Appointment }> =>
    request(`/appointments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  deleteAppointment: (id: number): Promise<{ success: boolean }> =>
    request(`/appointments/${id}`, {
      method: 'DELETE',
    }),

  resetDemoData: (): Promise<{ success: boolean; message: string }> =>
    request('/system/reset-demo', {
      method: 'POST',
    }),
};
