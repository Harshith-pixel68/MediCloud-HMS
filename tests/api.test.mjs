import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, test } from 'node:test';
import express from 'express';
import { createApiRouter } from '../src/server/api.ts';
import { DemoHospitalRepository } from '../src/server/repositories/demoRepository.ts';

let server;
let baseUrl = '';
let authToken = '';

const TEST_CONFIG = {
  port: 0,
  nodeEnv: 'test',
  storageMode: 'demo',
  azureSql: null,
  sessionSecret: 'test-suite-ephemeral-session-secret-key',
  adminEmail: 'admin@hospital.local',
  adminPasscode: '',
};

async function apiJson(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}

function futureDateString(daysAhead = 5) {
  const dt = new Date();
  dt.setUTCDate(dt.getUTCDate() + daysAhead);
  return dt.toISOString().slice(0, 10);
}

before(async () => {
  const repository = new DemoHospitalRepository();
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', createApiRouter(repository, TEST_CONFIG));

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

test('Public health and auth status endpoints respond with demo mode metadata', async () => {
  const health = await apiJson('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.payload.status, 'ok');
  assert.equal(health.payload.storageMode, 'demo');
  assert.equal(health.payload.persistent, false);

  const authStatus = await apiJson('/api/auth/status');
  assert.equal(authStatus.status, 200);
  assert.equal(authStatus.payload.demoLoginAvailable, true);
  assert.equal(authStatus.payload.modeInfo.mode, 'demo');
});

test('Protected endpoints reject unauthenticated requests with 401', async () => {
  for (const path of ['/api/dashboard', '/api/patients', '/api/doctors', '/api/appointments', '/api/activity-logs']) {
    const res = await apiJson(path);
    assert.equal(res.status, 401, `Expected 401 for unauthenticated ${path}`);
  }
});

test('Demo administrator login issues Bearer token and logout revokes it', async () => {
  const login = await apiJson('/api/auth/demo-login', { method: 'POST' });
  assert.equal(login.status, 200);
  assert.ok(login.payload.token);
  assert.equal(login.payload.user.role, 'Administrator');

  const tempToken = login.payload.token;
  const me = await apiJson('/api/auth/me', { token: tempToken });
  assert.equal(me.status, 200);
  assert.equal(me.payload.user.email, login.payload.user.email);

  const logout = await apiJson('/api/auth/logout', { method: 'POST', token: tempToken });
  assert.equal(logout.status, 200);

  const afterLogout = await apiJson('/api/auth/me', { token: tempToken });
  assert.equal(afterLogout.status, 401);

  // Re-authenticate for subsequent CRUD & workflow tests
  const freshLogin = await apiJson('/api/auth/demo-login', { method: 'POST' });
  assert.equal(freshLogin.status, 200);
  authToken = freshLogin.payload.token;
});

test('Patient CRUD, input validation, duplicate guard, and audit log tracking', async () => {
  const invalidPhone = await apiJson('/api/patients', {
    method: 'POST',
    token: authToken,
    body: {
      fullName: 'Invalid Phone Patient',
      age: 30,
      gender: 'Female',
      phoneNumber: '12345',
      address: '100 Main St',
      registrationDate: futureDateString(0),
    },
  });
  assert.equal(invalidPhone.status, 400);

  const created = await apiJson('/api/patients', {
    method: 'POST',
    token: authToken,
    body: {
      fullName: 'Claire Gallagher',
      age: 38,
      gender: 'Female',
      phoneNumber: '+1-555-880-1122',
      address: '420 Meridian Ave',
      registrationDate: futureDateString(0),
    },
  });
  assert.equal(created.status, 201);
  const patient = created.payload.patient;
  assert.ok(patient.patientCode.startsWith('PAT-'));

  const duplicate = await apiJson('/api/patients', {
    method: 'POST',
    token: authToken,
    body: {
      fullName: 'Claire Gallagher',
      age: 38,
      gender: 'Female',
      phoneNumber: '+1-555-880-1122',
      address: '420 Meridian Ave',
      registrationDate: futureDateString(0),
    },
  });
  assert.equal(duplicate.status, 409);

  const updated = await apiJson(`/api/patients/${patient.id}`, {
    method: 'PUT',
    token: authToken,
    body: {
      fullName: 'Claire Gallagher-Reed',
      age: 39,
      gender: 'Female',
      phoneNumber: '+1-555-880-1122',
      address: '425 Meridian Ave',
      registrationDate: futureDateString(0),
    },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.payload.patient.age, 39);

  const logs = await apiJson(`/api/activity-logs?entityType=Patient&search=${encodeURIComponent(patient.patientCode)}`, {
    token: authToken,
  });
  assert.equal(logs.status, 200);
  assert.ok(logs.payload.logs.some((entry) => entry.action === 'Created' && entry.entityCode === patient.patientCode));
  assert.ok(logs.payload.logs.some((entry) => entry.action === 'Updated' && entry.entityCode === patient.patientCode));

  const deleted = await apiJson(`/api/patients/${patient.id}`, {
    method: 'DELETE',
    token: authToken,
  });
  assert.equal(deleted.status, 200);
  assert.equal(deleted.payload.success, true);
});

test('Doctor CRUD and availability filtering', async () => {
  const created = await apiJson('/api/doctors', {
    method: 'POST',
    token: authToken,
    body: {
      fullName: 'Dr. Samuel Osei',
      specialization: 'Radiology',
      phoneNumber: '+1-555-310-7744',
      availability: 'Available',
    },
  });
  assert.equal(created.status, 201);
  const doctor = created.payload.doctor;

  const filtered = await apiJson('/api/doctors?availability=Available&search=Osei', {
    token: authToken,
  });
  assert.equal(filtered.status, 200);
  assert.equal(filtered.payload.doctors.length, 1);

  const updated = await apiJson(`/api/doctors/${doctor.id}`, {
    method: 'PUT',
    token: authToken,
    body: {
      fullName: 'Dr. Samuel Osei',
      specialization: 'Radiology',
      phoneNumber: '+1-555-310-7744',
      availability: 'In Consultation',
    },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.payload.doctor.availability, 'In Consultation');

  const deleted = await apiJson(`/api/doctors/${doctor.id}`, {
    method: 'DELETE',
    token: authToken,
  });
  assert.equal(deleted.status, 200);
});

test('Appointment booking conflicts, On Leave guard, status transitions, and dashboard today sync', async () => {
  const bookingDate = futureDateString(3);

  // Past date rejection
  const pastBooking = await apiJson('/api/appointments', {
    method: 'POST',
    token: authToken,
    body: {
      patientId: 1,
      doctorId: 1,
      appointmentDate: '2020-01-15',
      appointmentTime: '09:30',
      reason: 'Past date check',
    },
  });
  assert.equal(pastBooking.status, 400);

  // Doctor on leave guard (DOC-2006 / id=6 is seeded On Leave)
  const onLeaveBooking = await apiJson('/api/appointments', {
    method: 'POST',
    token: authToken,
    body: {
      patientId: 1,
      doctorId: 6,
      appointmentDate: bookingDate,
      appointmentTime: '11:00',
      reason: 'Dermatology consult',
    },
  });
  assert.equal(onLeaveBooking.status, 409);

  // Valid appointment booking
  const booked = await apiJson('/api/appointments', {
    method: 'POST',
    token: authToken,
    body: {
      patientId: 1,
      doctorId: 1,
      appointmentDate: bookingDate,
      appointmentTime: '10:15',
      reason: 'Cardiac follow-up',
    },
  });
  assert.equal(booked.status, 201);
  const appt = booked.payload.appointment;

  // Double-booking same doctor at same date/time
  const conflict = await apiJson('/api/appointments', {
    method: 'POST',
    token: authToken,
    body: {
      patientId: 2,
      doctorId: 1,
      appointmentDate: bookingDate,
      appointmentTime: '10:15',
      reason: 'Double booking conflict',
    },
  });
  assert.equal(conflict.status, 409);

  // Dashboard summary respecting ?today=YYYY-MM-DD query param
  const dashboard = await apiJson(`/api/dashboard?today=${bookingDate}`, {
    token: authToken,
  });
  assert.equal(dashboard.status, 200);
  assert.ok(dashboard.payload.summary.todayAppointments >= 1);
  assert.ok(
    dashboard.payload.summary.todaysSchedule.some((row) => row.appointmentCode === appt.appointmentCode)
  );

  // Status update + edit + cancel + delete verification
  const edited = await apiJson(`/api/appointments/${appt.id}`, {
    method: 'PUT',
    token: authToken,
    body: {
      patientId: 1,
      doctorId: 1,
      appointmentDate: bookingDate,
      appointmentTime: '10:45',
      reason: 'Updated cardiac follow-up',
      status: 'Scheduled',
    },
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.payload.appointment.appointmentTime, '10:45');

  const completed = await apiJson(`/api/appointments/${appt.id}/status`, {
    method: 'PATCH',
    token: authToken,
    body: { status: 'Completed' },
  });
  assert.equal(completed.status, 200);
  assert.equal(completed.payload.appointment.status, 'Completed');

  const logs = await apiJson('/api/activity-logs?entityType=Appointment&action=Status%20Changed', {
    token: authToken,
  });
  assert.equal(logs.status, 200);
  assert.ok(logs.payload.logs.some((entry) => entry.entityCode === appt.appointmentCode));

  const deletedAppt = await apiJson(`/api/appointments/${appt.id}`, {
    method: 'DELETE',
    token: authToken,
  });
  assert.equal(deletedAppt.status, 200);
  assert.equal(deletedAppt.payload.success, true);
});

test('Demo Mode allows cascading deletes in temporary memory and Reset restores sample data + 4 initial audit logs', async () => {
  // PAT-1001 (id=1) has linked appointments in Demo Mode; deleting cascades in Demo Mode only
  const cascadeDel = await apiJson('/api/patients/1', {
    method: 'DELETE',
    token: authToken,
  });
  assert.equal(cascadeDel.status, 200);
  assert.equal(cascadeDel.payload.success, true);

  const reset = await apiJson('/api/system/reset-demo', {
    method: 'POST',
    token: authToken,
  });
  assert.equal(reset.status, 200);
  assert.equal(reset.payload.success, true);

  const dashboard = await apiJson('/api/dashboard', { token: authToken });
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.payload.summary.totalPatients, 8);
  assert.equal(dashboard.payload.summary.totalDoctors, 6);
  assert.equal(dashboard.payload.summary.totalAppointments, 9);

  const logs = await apiJson('/api/activity-logs', { token: authToken });
  assert.equal(logs.status, 200);
  assert.equal(logs.payload.logs.length, 4);
  assert.ok(logs.payload.logs.every((entry) => entry.actorName === 'System Seed'));

  const unknown = await apiJson('/api/does-not-exist', { token: authToken });
  assert.equal(unknown.status, 404);
});

test('Production Azure SQL schema and repository block cascading hard deletes and preserve clinical/audit records', async () => {
  const fs = await import('node:fs/promises');
  const schemaSql = await fs.readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
  assert.equal(/ON\s+DELETE\s+CASCADE/i.test(schemaSql), false);
  assert.equal(/ON\s+DELETE\s+NO\s+ACTION/i.test(schemaSql), true);

  const { AzureSqlHospitalRepository } = await import('../src/server/repositories/azureSqlRepository.ts');
  const { signSessionToken } = await import('../src/server/auth.ts');

  const prodRepo = new AzureSqlHospitalRepository({
    server: 'example.database.windows.net',
    database: 'hospital_management_db',
    user: 'sqladmin',
    password: 'placeholder-not-used-in-mock',
    port: 1433,
    encrypt: true,
  });

  const executedQueries = [];
  let scenario = 'linked-patient';

  const makeRequest = () => ({
    input() {
      return this;
    },
    async query(sqlText) {
      executedQueries.push(sqlText);
      if (sqlText.includes('FROM dbo.Patients p')) {
        return {
          recordset: [{ Id: 1, PatientCode: 'PAT-1001', FullName: 'Aarav Sharma', LinkedAppointments: 2 }],
        };
      }
      if (sqlText.includes('FROM dbo.Doctors d')) {
        return {
          recordset: [{ Id: 1, DoctorCode: 'DOC-2001', FullName: 'Dr. Catherine Mercer', LinkedAppointments: 3 }],
        };
      }
      if (sqlText.includes('FROM dbo.Appointments a')) {
        return {
          recordset: [
            {
              Id: 10,
              AppointmentCode: 'APT-3010',
              PatientId: 1,
              PatientCode: 'PAT-1001',
              PatientName: 'Aarav Sharma',
              DoctorId: 1,
              DoctorCode: 'DOC-2001',
              DoctorName: 'Dr. Catherine Mercer',
              DoctorSpecialization: 'Cardiology',
              AppointmentDate: '2026-12-01',
              AppointmentTime: '10:00',
              Reason: 'Consult',
              Status: scenario === 'completed-appt' ? 'Completed' : scenario === 'scheduled-appt' ? 'Scheduled' : 'Cancelled',
              CreatedAt: new Date().toISOString(),
            },
          ],
        };
      }
      if (sqlText.includes('DELETE FROM dbo.Appointments')) {
        return { recordset: [{ DeletedCount: 1 }] };
      }
      return { recordset: [] };
    },
  });

  // Override internal pool accessor via fake pool & mssql Transaction shim by mocking getPool
  // Note: AzureSqlHospitalRepository constructs `new sql.Transaction(pool)` which uses pool.acquire/release.
  // Instead, test the exact guard behavior cleanly via pool.request + Transaction stub on the prototype:
  const sqlModule = (await import('mssql')).default;
  const origTransaction = sqlModule.Transaction;
  const origRequest = sqlModule.Request;

  class MockTransaction {
    constructor(pool) {
      this.pool = pool;
      this.rolledBack = false;
      this.committed = false;
    }
    async begin() {}
    async commit() {
      this.committed = true;
    }
    async rollback() {
      this.rolledBack = true;
    }
    request() {
      return makeRequest();
    }
  }
  class MockRequest {
    constructor() {
      return makeRequest();
    }
  }

  sqlModule.Transaction = MockTransaction;
  sqlModule.Request = MockRequest;
  prodRepo.getPool = async () => ({ connected: true, request: makeRequest });

  const prodApp = express();
  prodApp.use(express.json());
  const prodConfig = { ...TEST_CONFIG, storageMode: 'azure_sql' };
  prodApp.use('/api', createApiRouter(prodRepo, prodConfig));
  const prodServer = http.createServer(prodApp);
  await new Promise((resolve) => prodServer.listen(0, '127.0.0.1', () => resolve()));

  try {
    const addr = prodServer.address();
    const prodUrl = `http://127.0.0.1:${addr.port}`;
    const prodToken = signSessionToken(
      { id: 1, fullName: 'Prod Admin', email: 'admin@hospital.org', role: 'Administrator' },
      prodConfig.sessionSecret
    );

    const callProd = async (path, method = 'DELETE') => {
      const res = await fetch(`${prodUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${prodToken}` },
      });
      return { status: res.status, payload: await res.json().catch(() => ({})) };
    };

    const patientDel = await callProd('/api/patients/1');
    assert.equal(patientDel.status, 409);
    assert.match(patientDel.payload.error, /Cascading hard deletes are restricted to Demo Mode/i);

    const doctorDel = await callProd('/api/doctors/1');
    assert.equal(doctorDel.status, 409);
    assert.match(doctorDel.payload.error, /Cascading hard deletes are restricted to Demo Mode/i);

    scenario = 'completed-appt';
    const completedDel = await callProd('/api/appointments/10');
    assert.equal(completedDel.status, 409);
    assert.match(completedDel.payload.error, /cannot be hard-deleted/i);

    scenario = 'scheduled-appt';
    const scheduledDel = await callProd('/api/appointments/10');
    assert.equal(scheduledDel.status, 409);
    assert.match(scheduledDel.payload.error, /cannot be casually hard-deleted/i);

    // Ensure zero DELETE SQL statements ran during blocked checks
    assert.equal(executedQueries.some((q) => q.includes('DELETE FROM')), false);

    scenario = 'cancelled-appt';
    const cancelledDel = await callProd('/api/appointments/10');
    assert.equal(cancelledDel.status, 200);
    assert.equal(cancelledDel.payload.success, true);
    assert.equal(
      executedQueries.some((q) => q.includes('INSERT INTO dbo.ActivityLogs')),
      true
    );
  } finally {
    sqlModule.Transaction = origTransaction;
    sqlModule.Request = origRequest;
    await new Promise((resolve, reject) => prodServer.close((e) => (e ? reject(e) : resolve())));
  }
});
