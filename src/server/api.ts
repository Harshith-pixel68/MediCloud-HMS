import express from 'express';
import type { Response } from 'express';
import type { AppConfig } from './config.ts';
import type { HospitalRepository } from './repositories/hospitalRepository.ts';
import {
  createRequireAuth,
  extractBearerToken,
  hashPassword,
  revokeSessionToken,
  signSessionToken,
  timingSafeStringMatch,
  verifyPassword,
} from './auth.ts';
import type { AuthenticatedRequest } from './auth.ts';
import type {
  ActivityAction,
  ActivityEntityType,
  AppointmentInput,
  AppointmentStatus,
  AuditActor,
  DoctorAvailability,
  DoctorInput,
  Gender,
  PatientInput,
} from './types.ts';

const VALID_GENDERS = new Set<Gender>(['Male', 'Female', 'Other']);
const VALID_AVAILABILITY = new Set<DoctorAvailability>(['Available', 'In Consultation', 'On Leave']);
const VALID_APPOINTMENT_STATUSES = new Set<AppointmentStatus>(['Scheduled', 'Completed', 'Cancelled']);
const VALID_ACTIVITY_ENTITIES = new Set<ActivityEntityType>(['Patient', 'Doctor', 'Appointment']);
const VALID_ACTIVITY_ACTIONS = new Set<ActivityAction>([
  'Created',
  'Updated',
  'Status Changed',
  'Deleted',
]);

function getAuditActor(req: AuthenticatedRequest): AuditActor | undefined {
  if (!req.authUser) {
    return undefined;
  }
  return {
    fullName: req.authUser.fullName,
    email: req.authUser.email,
  };
}

function parsePositiveId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  const num = Number(raw);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}

function isIsoDateString(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

function isTimeString(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

function isValidPhoneNumber(phone: string): boolean {
  if (phone.length < 7 || phone.length > 30) {
    return false;
  }
  if (!/^[+\d\s().-]+$/.test(phone)) {
    return false;
  }
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

function isNotPastBookingDate(dateStr: string): boolean {
  // Allow yesterday UTC as the earliest boundary to accommodate UTC-12..UTC+14 client timezones
  const yesterdayUtc = new Date();
  yesterdayUtc.setUTCDate(yesterdayUtc.getUTCDate() - 1);
  const minAllowed = yesterdayUtc.toISOString().slice(0, 10);
  return dateStr >= minAllowed;
}

function validatePatientPayload(body: Record<string, unknown>): { data?: PatientInput; error?: string } {
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const age = Number(body.age);
  const gender = typeof body.gender === 'string' ? (body.gender.trim() as Gender) : ('' as Gender);
  const phoneNumber = typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() : '';
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  const registrationDate =
    typeof body.registrationDate === 'string' && body.registrationDate.trim()
      ? body.registrationDate.trim()
      : new Date().toISOString().slice(0, 10);

  if (fullName.length < 2 || fullName.length > 120) {
    return { error: 'Full name must be between 2 and 120 characters.' };
  }
  if (!Number.isInteger(age) || age < 0 || age > 130) {
    return { error: 'Age must be a whole number between 0 and 130.' };
  }
  if (!VALID_GENDERS.has(gender)) {
    return { error: 'Gender must be Male, Female, or Other.' };
  }
  if (!isValidPhoneNumber(phoneNumber)) {
    return { error: 'Phone number must contain 7 to 15 digits (valid characters: +, -, spaces, parentheses).' };
  }
  if (address.length < 3 || address.length > 255) {
    return { error: 'Address must be between 3 and 255 characters.' };
  }
  if (!isIsoDateString(registrationDate)) {
    return { error: 'Registration date must be a valid calendar date (YYYY-MM-DD).' };
  }

  return {
    data: {
      fullName,
      age,
      gender,
      phoneNumber,
      address,
      registrationDate,
    },
  };
}

function validateDoctorPayload(body: Record<string, unknown>): { data?: DoctorInput; error?: string } {
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const specialization =
    typeof body.specialization === 'string' ? body.specialization.trim() : '';
  const phoneNumber = typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() : '';
  const availability =
    typeof body.availability === 'string'
      ? (body.availability.trim() as DoctorAvailability)
      : ('Available' as DoctorAvailability);

  if (fullName.length < 2 || fullName.length > 120) {
    return { error: 'Doctor name must be between 2 and 120 characters.' };
  }
  if (specialization.length < 2 || specialization.length > 100) {
    return { error: 'Specialization must be between 2 and 100 characters.' };
  }
  if (!isValidPhoneNumber(phoneNumber)) {
    return { error: 'Phone number must contain 7 to 15 digits (valid characters: +, -, spaces, parentheses).' };
  }
  if (!VALID_AVAILABILITY.has(availability)) {
    return { error: 'Availability must be Available, In Consultation, or On Leave.' };
  }

  return {
    data: {
      fullName,
      specialization,
      phoneNumber,
      availability,
    },
  };
}

function validateAppointmentPayload(
  body: Record<string, unknown>,
  options: { isCreate?: boolean } = {}
): { data?: AppointmentInput; error?: string } {
  const patientId = Number(body.patientId);
  const doctorId = Number(body.doctorId);
  const appointmentDate =
    typeof body.appointmentDate === 'string' ? body.appointmentDate.trim() : '';
  const appointmentTime =
    typeof body.appointmentTime === 'string' ? body.appointmentTime.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 255) : '';
  const status =
    typeof body.status === 'string' && body.status.trim()
      ? (body.status.trim() as AppointmentStatus)
      : ('Scheduled' as AppointmentStatus);

  if (!Number.isInteger(patientId) || patientId <= 0) {
    return { error: 'Please select a valid patient.' };
  }
  if (!Number.isInteger(doctorId) || doctorId <= 0) {
    return { error: 'Please select a valid doctor.' };
  }
  if (!isIsoDateString(appointmentDate)) {
    return { error: 'Appointment date must be a valid calendar date (YYYY-MM-DD).' };
  }
  if (options.isCreate && status === 'Scheduled' && !isNotPastBookingDate(appointmentDate)) {
    return { error: 'New scheduled appointments cannot be booked for past dates.' };
  }
  if (!isTimeString(appointmentTime)) {
    return { error: 'Appointment time must be formatted as HH:MM (24-hour).' };
  }
  if (!VALID_APPOINTMENT_STATUSES.has(status)) {
    return { error: 'Status must be Scheduled, Completed, or Cancelled.' };
  }

  return {
    data: {
      patientId,
      doctorId,
      appointmentDate,
      appointmentTime,
      reason,
      status,
    },
  };
}

function sendServerError(res: Response, err: unknown, fallbackMessage: string): void {
  const message = err instanceof Error ? err.message : fallbackMessage;
  if (
    message.includes('already registered') ||
    message.includes('already exists') ||
    message.includes('already has a scheduled appointment') ||
    message.includes('marked On Leave') ||
    message.includes('restricted to Demo Mode') ||
    message.includes('cannot be hard-deleted') ||
    message.includes('cannot be casually hard-deleted')
  ) {
    res.status(409).json({ error: message });
    return;
  }
  if (
    message.includes('does not exist') ||
    message.includes('Selected patient') ||
    message.includes('Selected doctor')
  ) {
    res.status(400).json({ error: message });
    return;
  }
  console.error('[API Error]', err);
  res.status(500).json({ error: fallbackMessage });
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

function createAuthRateLimiter(maxAttempts = 15, windowMs = 15 * 60 * 1000) {
  const buckets = new Map<string, RateLimitBucket>();

  return (req: express.Request, res: Response, next: express.NextFunction): void => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }

    const clientIp = req.ip || 'unknown';
    const current = buckets.get(clientIp);
    if (current && current.resetAt > now) {
      if (current.count >= maxAttempts) {
        res.status(429).json({
          error: 'Too many authentication attempts. Please wait a few minutes and try again.',
        });
        return;
      }
      current.count += 1;
    } else {
      buckets.set(clientIp, { count: 1, resetAt: now + windowMs });
    }
    next();
  };
}

export function createApiRouter(repository: HospitalRepository, config: AppConfig): express.Router {
  const router = express.Router();
  const requireAuth = createRequireAuth(config.sessionSecret);
  const authRateLimiter = createAuthRateLimiter();

  // Public Health Endpoint (for Azure App Service health check probes)
  router.get('/health', (_req, res) => {
    const modeInfo = repository.getModeInfo();
    res.json({
      status: 'ok',
      storageMode: modeInfo.mode,
      persistent: modeInfo.persistent,
      timestamp: new Date().toISOString(),
    });
  });

  // Public Auth Status Endpoint
  router.get('/auth/status', async (_req, res) => {
    try {
      const modeInfo = repository.getModeInfo();
      const hasAdminInStore = await repository.hasAnyAdminUser();
      const hasEnvPasscode = Boolean(config.adminPasscode);
      const needsFirstRunSetup = !hasEnvPasscode && !hasAdminInStore;

      res.json({
        modeInfo,
        demoLoginAvailable: modeInfo.mode === 'demo',
        needsFirstRunSetup,
        hasConfiguredAdmin: hasEnvPasscode,
      });
    } catch (err) {
      sendServerError(res, err, 'Failed to check authentication status.');
    }
  });

  // First-Run Administrator Bootstrap (when ADMIN_PASSCODE is unset and no admin exists in DB)
  router.post('/auth/setup-admin', authRateLimiter, async (req, res) => {
    try {
      if (config.adminPasscode) {
        res.status(403).json({
          error: 'Administrator passcode is managed via environment configuration.',
        });
        return;
      }
      const alreadyExists = await repository.hasAnyAdminUser();
      if (alreadyExists) {
        res.status(409).json({
          error: 'An administrator account has already been configured.',
        });
        return;
      }

      const fullName =
        typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : 'Hospital Administrator';
      const email =
        typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';

      if (fullName.length < 2 || fullName.length > 120) {
        res.status(400).json({ error: 'Full name must be between 2 and 120 characters.' });
        return;
      }
      if (!email || !email.includes('@') || email.length > 160) {
        res.status(400).json({ error: 'Please provide a valid administrator email address.' });
        return;
      }
      if (password.length < 8 || password.length > 128) {
        res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
        return;
      }

      const passwordHash = hashPassword(password);
      const created = await repository.createAdminUser({
        fullName,
        email,
        passwordHash,
        role: 'Administrator',
      });

      const userProfile = {
        id: created.id,
        fullName: created.fullName,
        email: created.email,
        role: created.role,
      };
      const token = signSessionToken(userProfile, config.sessionSecret);
      res.status(201).json({
        token,
        user: userProfile,
        modeInfo: repository.getModeInfo(),
      });
    } catch (err) {
      sendServerError(res, err, 'Failed to configure administrator account.');
    }
  });

  // Standard Admin Login (Email + Password)
  router.post('/auth/login', authRateLimiter, async (req, res) => {
    try {
      const email =
        typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required.' });
        return;
      }

      // 1. Check configured environment passcode first (takes precedence if set)
      if (config.adminPasscode) {
        if (
          email === config.adminEmail &&
          timingSafeStringMatch(password, config.adminPasscode)
        ) {
          const userProfile = {
            id: 1,
            fullName: 'Hospital Administrator',
            email: config.adminEmail,
            role: 'Administrator' as const,
          };
          const token = signSessionToken(userProfile, config.sessionSecret);
          res.json({
            token,
            user: userProfile,
            modeInfo: repository.getModeInfo(),
          });
          return;
        }
      }

      // 2. Check Users table in active repository
      const storedUser = await repository.findUserByEmail(email);
      if (!storedUser || !verifyPassword(password, storedUser.passwordHash)) {
        res.status(401).json({ error: 'Invalid administrator email or password.' });
        return;
      }

      const userProfile = {
        id: storedUser.id,
        fullName: storedUser.fullName,
        email: storedUser.email,
        role: storedUser.role,
      };
      const token = signSessionToken(userProfile, config.sessionSecret);
      res.json({
        token,
        user: userProfile,
        modeInfo: repository.getModeInfo(),
      });
    } catch (err) {
      sendServerError(res, err, 'Unable to verify credentials.');
    }
  });

  // One-click Demo Administrator Sign-In (strictly restricted to Demo Mode)
  router.post('/auth/demo-login', (_req, res) => {
    const modeInfo = repository.getModeInfo();
    if (modeInfo.mode !== 'demo') {
      res.status(403).json({
        error: 'Demo sign-in is disabled when connected to Azure SQL Database.',
      });
      return;
    }

    const demoUser = {
      id: 0,
      fullName: 'Dr. Elena Vance (Demo Admin)',
      email: 'demo.admin@medicloud.edu',
      role: 'Administrator' as const,
    };
    const token = signSessionToken(demoUser, config.sessionSecret);
    res.json({
      token,
      user: demoUser,
      modeInfo,
    });
  });

  // Logout (revokes current Bearer token)
  router.post('/auth/logout', (req, res) => {
    const token = extractBearerToken(req);
    if (token) {
      revokeSessionToken(token, config.sessionSecret);
    }
    res.json({ success: true });
  });

  // Verify Current Session
  router.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({
      user: req.authUser,
      modeInfo: repository.getModeInfo(),
    });
  });

  // Protected Dashboard Summary
  router.get('/dashboard', requireAuth, async (req, res) => {
    try {
      const today =
        typeof req.query.today === 'string' && isIsoDateString(req.query.today)
          ? req.query.today.trim()
          : undefined;
      const summary = await repository.getDashboardSummary(today);
      res.json({
        summary,
        modeInfo: repository.getModeInfo(),
      });
    } catch (err) {
      sendServerError(res, err, 'Failed to load dashboard summary.');
    }
  });

  // Protected Activity Log Audit Endpoint
  router.get('/activity-logs', requireAuth, async (req, res) => {
    try {
      const rawEntity = typeof req.query.entityType === 'string' ? req.query.entityType : 'All';
      const entityType =
        rawEntity === 'All' || VALID_ACTIVITY_ENTITIES.has(rawEntity as ActivityEntityType)
          ? (rawEntity as ActivityEntityType | 'All')
          : 'All';

      const rawAction = typeof req.query.action === 'string' ? req.query.action : 'All';
      const action =
        rawAction === 'All' || VALID_ACTIVITY_ACTIONS.has(rawAction as ActivityAction)
          ? (rawAction as ActivityAction | 'All')
          : 'All';

      const search = typeof req.query.search === 'string' ? req.query.search.slice(0, 120) : '';
      const rawLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 50;
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100) : 50;

      const logs = await repository.listActivityLogs({
        entityType,
        action,
        search,
        limit,
      });
      res.json({ logs });
    } catch (err) {
      sendServerError(res, err, 'Failed to load activity logs.');
    }
  });

  // Protected Patient Routes
  router.get('/patients', requireAuth, async (req, res) => {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : '';
      const rawGender = typeof req.query.gender === 'string' ? req.query.gender : 'All';
      const gender =
        rawGender === 'All' || VALID_GENDERS.has(rawGender as Gender)
          ? (rawGender as Gender | 'All')
          : 'All';

      const patients = await repository.listPatients(search, gender);
      res.json({ patients });
    } catch (err) {
      sendServerError(res, err, 'Failed to fetch patient records.');
    }
  });

  router.get('/patients/:id', requireAuth, async (req, res) => {
    try {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid patient ID.' });
        return;
      }
      const patient = await repository.getPatientById(id);
      if (!patient) {
        res.status(404).json({ error: 'Patient record not found.' });
        return;
      }
      res.json({ patient });
    } catch (err) {
      sendServerError(res, err, 'Failed to fetch patient record.');
    }
  });

  router.post('/patients', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const validated = validatePatientPayload(req.body || {});
      if (validated.error || !validated.data) {
        res.status(400).json({ error: validated.error || 'Invalid patient data.' });
        return;
      }
      const patient = await repository.createPatient(validated.data, getAuditActor(req));
      res.status(201).json({ patient });
    } catch (err) {
      sendServerError(res, err, 'Failed to register patient.');
    }
  });

  router.put('/patients/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid patient ID.' });
        return;
      }
      const validated = validatePatientPayload(req.body || {});
      if (validated.error || !validated.data) {
        res.status(400).json({ error: validated.error || 'Invalid patient data.' });
        return;
      }
      const patient = await repository.updatePatient(id, validated.data, getAuditActor(req));
      if (!patient) {
        res.status(404).json({ error: 'Patient record not found.' });
        return;
      }
      res.json({ patient });
    } catch (err) {
      sendServerError(res, err, 'Failed to update patient record.');
    }
  });

  router.delete('/patients/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid patient ID.' });
        return;
      }
      const deleted = await repository.deletePatient(id, getAuditActor(req));
      if (!deleted) {
        res.status(404).json({ error: 'Patient record not found.' });
        return;
      }
      res.json({ success: true });
    } catch (err) {
      sendServerError(res, err, 'Failed to delete patient record.');
    }
  });

  // Protected Doctor Routes
  router.get('/doctors', requireAuth, async (req, res) => {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : '';
      const rawAvailability =
        typeof req.query.availability === 'string' ? req.query.availability : 'All';
      const availability =
        rawAvailability === 'All' || VALID_AVAILABILITY.has(rawAvailability as DoctorAvailability)
          ? (rawAvailability as DoctorAvailability | 'All')
          : 'All';

      const doctors = await repository.listDoctors(search, availability);
      res.json({ doctors });
    } catch (err) {
      sendServerError(res, err, 'Failed to fetch doctor records.');
    }
  });

  router.get('/doctors/:id', requireAuth, async (req, res) => {
    try {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid doctor ID.' });
        return;
      }
      const doctor = await repository.getDoctorById(id);
      if (!doctor) {
        res.status(404).json({ error: 'Doctor record not found.' });
        return;
      }
      res.json({ doctor });
    } catch (err) {
      sendServerError(res, err, 'Failed to fetch doctor record.');
    }
  });

  router.post('/doctors', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const validated = validateDoctorPayload(req.body || {});
      if (validated.error || !validated.data) {
        res.status(400).json({ error: validated.error || 'Invalid doctor data.' });
        return;
      }
      const doctor = await repository.createDoctor(validated.data, getAuditActor(req));
      res.status(201).json({ doctor });
    } catch (err) {
      sendServerError(res, err, 'Failed to add doctor.');
    }
  });

  router.put('/doctors/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid doctor ID.' });
        return;
      }
      const validated = validateDoctorPayload(req.body || {});
      if (validated.error || !validated.data) {
        res.status(400).json({ error: validated.error || 'Invalid doctor data.' });
        return;
      }
      const doctor = await repository.updateDoctor(id, validated.data, getAuditActor(req));
      if (!doctor) {
        res.status(404).json({ error: 'Doctor record not found.' });
        return;
      }
      res.json({ doctor });
    } catch (err) {
      sendServerError(res, err, 'Failed to update doctor record.');
    }
  });

  router.delete('/doctors/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid doctor ID.' });
        return;
      }
      const deleted = await repository.deleteDoctor(id, getAuditActor(req));
      if (!deleted) {
        res.status(404).json({ error: 'Doctor record not found.' });
        return;
      }
      res.json({ success: true });
    } catch (err) {
      sendServerError(res, err, 'Failed to delete doctor record.');
    }
  });

  // Protected Appointment Routes
  router.get('/appointments', requireAuth, async (req, res) => {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : '';
      const date = typeof req.query.date === 'string' && isIsoDateString(req.query.date)
        ? req.query.date.trim()
        : '';
      const rawStatus = typeof req.query.status === 'string' ? req.query.status : 'All';
      const status =
        rawStatus === 'All' || VALID_APPOINTMENT_STATUSES.has(rawStatus as AppointmentStatus)
          ? (rawStatus as AppointmentStatus | 'All')
          : 'All';
      const patientId =
        typeof req.query.patientId === 'string' ? parsePositiveId(req.query.patientId) ?? undefined : undefined;
      const doctorId =
        typeof req.query.doctorId === 'string' ? parsePositiveId(req.query.doctorId) ?? undefined : undefined;

      const appointments = await repository.listAppointments({
        search,
        date,
        status,
        patientId,
        doctorId,
      });
      res.json({ appointments });
    } catch (err) {
      sendServerError(res, err, 'Failed to fetch appointments.');
    }
  });

  router.post('/appointments', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const validated = validateAppointmentPayload(req.body || {}, { isCreate: true });
      if (validated.error || !validated.data) {
        res.status(400).json({ error: validated.error || 'Invalid appointment details.' });
        return;
      }
      const appointment = await repository.createAppointment(validated.data, getAuditActor(req));
      res.status(201).json({ appointment });
    } catch (err) {
      sendServerError(res, err, 'Failed to book appointment.');
    }
  });

  router.put('/appointments/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid appointment ID.' });
        return;
      }
      const validated = validateAppointmentPayload(req.body || {});
      if (validated.error || !validated.data) {
        res.status(400).json({ error: validated.error || 'Invalid appointment details.' });
        return;
      }
      const appointment = await repository.updateAppointment(id, validated.data, getAuditActor(req));
      if (!appointment) {
        res.status(404).json({ error: 'Appointment not found.' });
        return;
      }
      res.json({ appointment });
    } catch (err) {
      sendServerError(res, err, 'Failed to update appointment.');
    }
  });

  router.patch('/appointments/:id/status', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid appointment ID.' });
        return;
      }
      const status =
        typeof req.body?.status === 'string'
          ? (req.body.status.trim() as AppointmentStatus)
          : ('' as AppointmentStatus);
      if (!VALID_APPOINTMENT_STATUSES.has(status)) {
        res.status(400).json({ error: 'Status must be Scheduled, Completed, or Cancelled.' });
        return;
      }
      const appointment = await repository.updateAppointmentStatus(id, status, getAuditActor(req));
      if (!appointment) {
        res.status(404).json({ error: 'Appointment not found.' });
        return;
      }
      res.json({ appointment });
    } catch (err) {
      sendServerError(res, err, 'Failed to update appointment status.');
    }
  });

  router.delete('/appointments/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parsePositiveId(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid appointment ID.' });
        return;
      }
      const deleted = await repository.deleteAppointment(id, getAuditActor(req));
      if (!deleted) {
        res.status(404).json({ error: 'Appointment not found.' });
        return;
      }
      res.json({ success: true });
    } catch (err) {
      sendServerError(res, err, 'Failed to delete appointment.');
    }
  });

  // Demo Mode Reset Route (strictly blocked in Azure SQL mode)
  router.post('/system/reset-demo', requireAuth, async (_req, res) => {
    try {
      const modeInfo = repository.getModeInfo();
      if (modeInfo.mode !== 'demo' || !repository.resetDemoData) {
        res.status(403).json({
          error: 'Sample data reset is only available in Demo Mode.',
        });
        return;
      }
      await repository.resetDemoData();
      res.json({ success: true, message: 'Demo sample data has been restored.' });
    } catch (err) {
      sendServerError(res, err, 'Failed to reset demo data.');
    }
  });

  // JSON 404 for unknown API paths (prevents SPA HTML fallback from hiding broken API URLs)
  router.use((_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  return router;
}
