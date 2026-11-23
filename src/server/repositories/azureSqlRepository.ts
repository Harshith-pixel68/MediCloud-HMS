import sql from 'mssql';
import type { AzureSqlConfig } from '../config.ts';
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

function toDateString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return new Date().toISOString();
}

function mapPatientRow(row: Record<string, unknown>): Patient {
  return {
    id: Number(row.Id),
    patientCode: String(row.PatientCode),
    fullName: String(row.FullName),
    age: Number(row.Age),
    gender: String(row.Gender) as Gender,
    phoneNumber: String(row.PhoneNumber),
    address: String(row.Address),
    registrationDate: toDateString(row.RegistrationDate),
    createdAt: toIsoString(row.CreatedAt),
  };
}

function mapDoctorRow(row: Record<string, unknown>): Doctor {
  return {
    id: Number(row.Id),
    doctorCode: String(row.DoctorCode),
    fullName: String(row.FullName),
    specialization: String(row.Specialization),
    phoneNumber: String(row.PhoneNumber),
    availability: String(row.Availability) as DoctorAvailability,
    createdAt: toIsoString(row.CreatedAt),
  };
}

function mapAppointmentRow(row: Record<string, unknown>): Appointment {
  return {
    id: Number(row.Id),
    appointmentCode: String(row.AppointmentCode),
    patientId: Number(row.PatientId),
    patientCode: String(row.PatientCode),
    patientName: String(row.PatientName),
    doctorId: Number(row.DoctorId),
    doctorCode: String(row.DoctorCode),
    doctorName: String(row.DoctorName),
    doctorSpecialization: String(row.DoctorSpecialization),
    appointmentDate: toDateString(row.AppointmentDate),
    appointmentTime: String(row.AppointmentTime),
    reason: row.Reason ? String(row.Reason) : '',
    status: String(row.Status) as AppointmentStatus,
    createdAt: toIsoString(row.CreatedAt),
  };
}

function mapActivityLogRow(row: Record<string, unknown>): ActivityLogEntry {
  return {
    id: Number(row.Id),
    entityType: String(row.EntityType) as ActivityEntityType,
    entityId: Number(row.EntityId),
    entityCode: String(row.EntityCode),
    action: String(row.Action) as ActivityAction,
    actorName: String(row.ActorName),
    actorEmail: String(row.ActorEmail),
    summary: String(row.Summary),
    createdAt: toIsoString(row.CreatedAt),
  };
}

export class AzureSqlHospitalRepository implements HospitalRepository {
  private readonly sqlConfig: AzureSqlConfig;
  private pool: sql.ConnectionPool | null = null;

  constructor(sqlConfig: AzureSqlConfig) {
    this.sqlConfig = sqlConfig;
  }

  getModeInfo(): StorageModeInfo {
    return {
      mode: 'azure_sql',
      label: 'Microsoft Azure SQL Database',
      persistent: true,
      databaseName: this.sqlConfig.database,
      serverHost: this.sqlConfig.server,
    };
  }

  private async insertActivityLog(
    executor: sql.ConnectionPool | sql.Transaction,
    entry: {
      entityType: ActivityEntityType;
      entityId: number;
      entityCode: string;
      action: ActivityAction;
      summary: string;
      actor?: AuditActor;
    }
  ): Promise<void> {
    const resolvedActor = entry.actor ?? DEFAULT_AUDIT_ACTOR;
    await executor
      .request()
      .input('EntityType', sql.NVarChar(24), entry.entityType)
      .input('EntityId', sql.Int, entry.entityId)
      .input('EntityCode', sql.NVarChar(24), entry.entityCode)
      .input('Action', sql.NVarChar(24), entry.action)
      .input('ActorName', sql.NVarChar(120), resolvedActor.fullName.slice(0, 120))
      .input('ActorEmail', sql.NVarChar(160), resolvedActor.email.slice(0, 160))
      .input('Summary', sql.NVarChar(300), entry.summary.slice(0, 300))
      .query(`
        INSERT INTO dbo.ActivityLogs (EntityType, EntityId, EntityCode, Action, ActorName, ActorEmail, Summary)
        VALUES (@EntityType, @EntityId, @EntityCode, @Action, @ActorName, @ActorEmail, @Summary);
      `);
  }

  private async getPool(): Promise<sql.ConnectionPool> {
    if (this.pool && this.pool.connected) {
      return this.pool;
    }

    const poolConfig: sql.config = {
      server: this.sqlConfig.server,
      database: this.sqlConfig.database,
      user: this.sqlConfig.user,
      password: this.sqlConfig.password,
      port: this.sqlConfig.port,
      options: {
        encrypt: this.sqlConfig.encrypt,
        trustServerCertificate: false,
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
      connectionTimeout: 15000,
      requestTimeout: 15000,
    };

    this.pool = await new sql.ConnectionPool(poolConfig).connect();
    return this.pool;
  }

  async initialize(): Promise<void> {
    const pool = await this.getPool();
    await pool.request().query('SELECT 1 AS HealthCheck');
  }

  async hasAnyAdminUser(): Promise<boolean> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .query('SELECT TOP 1 Id FROM dbo.Users WHERE IsActive = 1');
    return result.recordset.length > 0;
  }

  async findUserByEmail(email: string): Promise<AdminUserRecord | null> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('Email', sql.NVarChar(160), email.trim().toLowerCase())
      .query(
        'SELECT TOP 1 Id, FullName, Email, PasswordHash, Role, IsActive, CreatedAt FROM dbo.Users WHERE LOWER(Email) = @Email AND IsActive = 1'
      );

    if (result.recordset.length === 0) {
      return null;
    }
    const row = result.recordset[0];
    return {
      id: Number(row.Id),
      fullName: String(row.FullName),
      email: String(row.Email),
      passwordHash: String(row.PasswordHash),
      role: String(row.Role) as 'Administrator' | 'Staff',
      isActive: Boolean(row.IsActive),
      createdAt: toIsoString(row.CreatedAt),
    };
  }

  async createAdminUser(input: {
    fullName: string;
    email: string;
    passwordHash: string;
    role?: 'Administrator' | 'Staff';
  }): Promise<AdminUserRecord> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('FullName', sql.NVarChar(120), input.fullName.trim())
      .input('Email', sql.NVarChar(160), input.email.trim().toLowerCase())
      .input('PasswordHash', sql.NVarChar(255), input.passwordHash)
      .input('Role', sql.NVarChar(40), input.role ?? 'Administrator')
      .query(`
        INSERT INTO dbo.Users (FullName, Email, PasswordHash, Role)
        OUTPUT INSERTED.Id, INSERTED.FullName, INSERTED.Email, INSERTED.PasswordHash, INSERTED.Role, INSERTED.IsActive, INSERTED.CreatedAt
        VALUES (@FullName, @Email, @PasswordHash, @Role);
      `);

    const row = result.recordset[0];
    return {
      id: Number(row.Id),
      fullName: String(row.FullName),
      email: String(row.Email),
      passwordHash: String(row.PasswordHash),
      role: String(row.Role) as 'Administrator' | 'Staff',
      isActive: Boolean(row.IsActive),
      createdAt: toIsoString(row.CreatedAt),
    };
  }

  async getDashboardSummary(todayDate?: string): Promise<DashboardSummary> {
    const pool = await this.getPool();
    const today = todayDate || new Date().toISOString().slice(0, 10);

    const [countsResult, recentResult, todayResult, activityResult] = await Promise.all([
      pool
        .request()
        .input('TodayDate', sql.Date, today)
        .query(`
          SELECT
            (SELECT COUNT(*) FROM dbo.Patients) AS TotalPatients,
            (SELECT COUNT(*) FROM dbo.Doctors) AS TotalDoctors,
            (SELECT COUNT(*) FROM dbo.Doctors WHERE Availability = N'Available') AS AvailableDoctors,
            (SELECT COUNT(*) FROM dbo.Appointments) AS TotalAppointments,
            (SELECT COUNT(*) FROM dbo.Appointments WHERE AppointmentDate = @TodayDate) AS TodayAppointments,
            (SELECT COUNT(*) FROM dbo.Appointments WHERE AppointmentDate = @TodayDate AND Status = N'Scheduled') AS TodayScheduled,
            (SELECT COUNT(*) FROM dbo.Appointments WHERE Status = N'Scheduled') AS ScheduledCount,
            (SELECT COUNT(*) FROM dbo.Appointments WHERE Status = N'Completed') AS CompletedCount,
            (SELECT COUNT(*) FROM dbo.Appointments WHERE Status = N'Cancelled') AS CancelledCount;
        `),
      pool.request().query(`
        SELECT TOP 5 Id, PatientCode, FullName, Age, Gender, PhoneNumber, Address, RegistrationDate, CreatedAt
        FROM dbo.Patients
        ORDER BY RegistrationDate DESC, Id DESC;
      `),
      pool
        .request()
        .input('TodayDate', sql.Date, today)
        .query(`
          SELECT
            a.Id, a.AppointmentCode, a.PatientId, p.PatientCode, p.FullName AS PatientName,
            a.DoctorId, d.DoctorCode, d.FullName AS DoctorName, d.Specialization AS DoctorSpecialization,
            a.AppointmentDate, a.AppointmentTime, a.Reason, a.Status, a.CreatedAt
          FROM dbo.Appointments a
          INNER JOIN dbo.Patients p ON p.Id = a.PatientId
          INNER JOIN dbo.Doctors d ON d.Id = a.DoctorId
          WHERE a.AppointmentDate = @TodayDate
          ORDER BY a.AppointmentTime ASC, a.Id ASC;
        `),
      pool.request().query(`
        SELECT TOP 8 Id, EntityType, EntityId, EntityCode, Action, ActorName, ActorEmail, Summary, CreatedAt
        FROM dbo.ActivityLogs
        ORDER BY CreatedAt DESC, Id DESC;
      `),
    ]);

    const counts = countsResult.recordset[0];
    return {
      totalPatients: Number(counts.TotalPatients),
      totalDoctors: Number(counts.TotalDoctors),
      availableDoctors: Number(counts.AvailableDoctors),
      totalAppointments: Number(counts.TotalAppointments),
      todayAppointments: Number(counts.TodayAppointments),
      todayScheduled: Number(counts.TodayScheduled),
      appointmentStats: {
        scheduled: Number(counts.ScheduledCount),
        completed: Number(counts.CompletedCount),
        cancelled: Number(counts.CancelledCount),
      },
      recentRegistrations: recentResult.recordset.map(mapPatientRow),
      todaysSchedule: todayResult.recordset.map(mapAppointmentRow),
      recentActivity: activityResult.recordset.map(mapActivityLogRow),
    };
  }

  async listActivityLogs(filter?: ActivityLogFilter): Promise<ActivityLogEntry[]> {
    const pool = await this.getPool();
    const entityFilter = filter?.entityType && filter.entityType !== 'All' ? filter.entityType : null;
    const actionFilter = filter?.action && filter.action !== 'All' ? filter.action : null;
    const term = filter?.search?.trim() || '';
    const limit = Math.min(Math.max(filter?.limit ?? 50, 1), 100);

    const result = await pool
      .request()
      .input('EntityType', sql.NVarChar(24), entityFilter)
      .input('Action', sql.NVarChar(24), actionFilter)
      .input('SearchTerm', sql.NVarChar(160), term ? `%${term}%` : null)
      .input('Limit', sql.Int, limit)
      .query(`
        SELECT TOP (@Limit)
          Id, EntityType, EntityId, EntityCode, Action, ActorName, ActorEmail, Summary, CreatedAt
        FROM dbo.ActivityLogs
        WHERE (@EntityType IS NULL OR EntityType = @EntityType)
          AND (@Action IS NULL OR Action = @Action)
          AND (
            @SearchTerm IS NULL
            OR EntityCode LIKE @SearchTerm
            OR Summary LIKE @SearchTerm
            OR ActorName LIKE @SearchTerm
            OR ActorEmail LIKE @SearchTerm
          )
        ORDER BY CreatedAt DESC, Id DESC;
      `);

    return result.recordset.map(mapActivityLogRow);
  }

  async listPatients(search?: string, gender?: Gender | 'All'): Promise<Patient[]> {
    const pool = await this.getPool();
    const term = search?.trim() || '';
    const genderFilter = gender && gender !== 'All' ? gender : null;

    const result = await pool
      .request()
      .input('SearchTerm', sql.NVarChar(120), term ? `%${term}%` : null)
      .input('Gender', sql.NVarChar(20), genderFilter)
      .query(`
        SELECT Id, PatientCode, FullName, Age, Gender, PhoneNumber, Address, RegistrationDate, CreatedAt
        FROM dbo.Patients
        WHERE (@Gender IS NULL OR Gender = @Gender)
          AND (
            @SearchTerm IS NULL
            OR FullName LIKE @SearchTerm
            OR PatientCode LIKE @SearchTerm
            OR PhoneNumber LIKE @SearchTerm
          )
        ORDER BY Id DESC;
      `);

    return result.recordset.map(mapPatientRow);
  }

  async getPatientById(id: number): Promise<Patient | null> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('Id', sql.Int, id)
      .query(
        'SELECT Id, PatientCode, FullName, Age, Gender, PhoneNumber, Address, RegistrationDate, CreatedAt FROM dbo.Patients WHERE Id = @Id;'
      );
    return result.recordset.length > 0 ? mapPatientRow(result.recordset[0]) : null;
  }

  async createPatient(input: PatientInput, actor?: AuditActor): Promise<Patient> {
    const pool = await this.getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const dupCheck = await new sql.Request(tx)
        .input('FullName', sql.NVarChar(120), input.fullName.trim())
        .input('PhoneNumber', sql.NVarChar(30), input.phoneNumber.trim())
        .query(`
          SELECT TOP 1 Id FROM dbo.Patients
          WHERE LOWER(FullName) = LOWER(@FullName) AND PhoneNumber = @PhoneNumber;
        `);
      if (dupCheck.recordset.length > 0) {
        throw new Error('A patient with the same full name and phone number is already registered.');
      }

      const nextCodeResult = await new sql.Request(tx).query(
        'SELECT ISNULL(MAX(Id), 0) + 1001 AS NextCodeNumber FROM dbo.Patients WITH (UPDLOCK, HOLDLOCK);'
      );
      const codeNumber = Number(nextCodeResult.recordset[0].NextCodeNumber);
      const patientCode = `PAT-${codeNumber}`;

      const result = await new sql.Request(tx)
        .input('PatientCode', sql.NVarChar(24), patientCode)
        .input('FullName', sql.NVarChar(120), input.fullName)
        .input('Age', sql.Int, input.age)
        .input('Gender', sql.NVarChar(20), input.gender)
        .input('PhoneNumber', sql.NVarChar(30), input.phoneNumber)
        .input('Address', sql.NVarChar(255), input.address)
        .input('RegistrationDate', sql.Date, input.registrationDate)
        .query(`
          INSERT INTO dbo.Patients (PatientCode, FullName, Age, Gender, PhoneNumber, Address, RegistrationDate)
          OUTPUT INSERTED.Id, INSERTED.PatientCode, INSERTED.FullName, INSERTED.Age, INSERTED.Gender, INSERTED.PhoneNumber, INSERTED.Address, INSERTED.RegistrationDate, INSERTED.CreatedAt
          VALUES (@PatientCode, @FullName, @Age, @Gender, @PhoneNumber, @Address, @RegistrationDate);
        `);

      const created = mapPatientRow(result.recordset[0]);
      await this.insertActivityLog(tx, {
        entityType: 'Patient',
        entityId: created.id,
        entityCode: created.patientCode,
        action: 'Created',
        summary: `Registered patient ${created.fullName} (${created.patientCode})`,
        actor,
      });

      await tx.commit();
      return created;
    } catch (err) {
      await tx.rollback().catch(() => {});
      throw err;
    }
  }

  async updatePatient(id: number, input: PatientInput, actor?: AuditActor): Promise<Patient | null> {
    const pool = await this.getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const dupCheck = await new sql.Request(tx)
        .input('Id', sql.Int, id)
        .input('FullName', sql.NVarChar(120), input.fullName.trim())
        .input('PhoneNumber', sql.NVarChar(30), input.phoneNumber.trim())
        .query(`
          SELECT TOP 1 Id FROM dbo.Patients
          WHERE Id <> @Id AND LOWER(FullName) = LOWER(@FullName) AND PhoneNumber = @PhoneNumber;
        `);
      if (dupCheck.recordset.length > 0) {
        throw new Error('A patient with the same full name and phone number is already registered.');
      }

      const result = await new sql.Request(tx)
        .input('Id', sql.Int, id)
        .input('FullName', sql.NVarChar(120), input.fullName)
        .input('Age', sql.Int, input.age)
        .input('Gender', sql.NVarChar(20), input.gender)
        .input('PhoneNumber', sql.NVarChar(30), input.phoneNumber)
        .input('Address', sql.NVarChar(255), input.address)
        .input('RegistrationDate', sql.Date, input.registrationDate)
        .query(`
          UPDATE dbo.Patients
          SET FullName = @FullName,
              Age = @Age,
              Gender = @Gender,
              PhoneNumber = @PhoneNumber,
              Address = @Address,
              RegistrationDate = @RegistrationDate
          OUTPUT INSERTED.Id, INSERTED.PatientCode, INSERTED.FullName, INSERTED.Age, INSERTED.Gender, INSERTED.PhoneNumber, INSERTED.Address, INSERTED.RegistrationDate, INSERTED.CreatedAt
          WHERE Id = @Id;
        `);

      if (result.recordset.length === 0) {
        await tx.rollback();
        return null;
      }
      const updated = mapPatientRow(result.recordset[0]);
      await this.insertActivityLog(tx, {
        entityType: 'Patient',
        entityId: updated.id,
        entityCode: updated.patientCode,
        action: 'Updated',
        summary: `Updated patient record for ${updated.fullName} (${updated.patientCode})`,
        actor,
      });
      await tx.commit();
      return updated;
    } catch (err) {
      await tx.rollback().catch(() => {});
      throw err;
    }
  }

  async deletePatient(id: number, actor?: AuditActor): Promise<boolean> {
    const pool = await this.getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const existingRes = await new sql.Request(tx)
        .input('Id', sql.Int, id)
        .query(`
          SELECT
            p.Id,
            p.PatientCode,
            p.FullName,
            (SELECT COUNT(*) FROM dbo.Appointments WHERE PatientId = p.Id) AS LinkedAppointments
          FROM dbo.Patients p
          WHERE p.Id = @Id;
        `);
      if (existingRes.recordset.length === 0) {
        await tx.rollback();
        return false;
      }

      const row = existingRes.recordset[0];
      const patientCode = String(row.PatientCode);
      const fullName = String(row.FullName);
      const linkedCount = Number(row.LinkedAppointments);

      if (linkedCount > 0) {
        throw new Error(
          `Cascading hard deletes are restricted to Demo Mode. Patient ${patientCode} has ${linkedCount} linked appointment${linkedCount === 1 ? '' : 's'}; preserve the clinical record or resolve linked appointments first.`
        );
      }

      await new sql.Request(tx)
        .input('Id', sql.Int, id)
        .query('DELETE FROM dbo.Patients WHERE Id = @Id;');

      await this.insertActivityLog(tx, {
        entityType: 'Patient',
        entityId: id,
        entityCode: patientCode,
        action: 'Deleted',
        summary: `Deleted unlinked patient ${fullName} (${patientCode})`,
        actor,
      });

      await tx.commit();
      return true;
    } catch (err) {
      await tx.rollback().catch(() => {});
      throw err;
    }
  }

  async listDoctors(search?: string, availability?: DoctorAvailability | 'All'): Promise<Doctor[]> {
    const pool = await this.getPool();
    const term = search?.trim() || '';
    const availabilityFilter = availability && availability !== 'All' ? availability : null;

    const result = await pool
      .request()
      .input('SearchTerm', sql.NVarChar(120), term ? `%${term}%` : null)
      .input('Availability', sql.NVarChar(30), availabilityFilter)
      .query(`
        SELECT Id, DoctorCode, FullName, Specialization, PhoneNumber, Availability, CreatedAt
        FROM dbo.Doctors
        WHERE (@Availability IS NULL OR Availability = @Availability)
          AND (
            @SearchTerm IS NULL
            OR FullName LIKE @SearchTerm
            OR DoctorCode LIKE @SearchTerm
            OR Specialization LIKE @SearchTerm
          )
        ORDER BY Id ASC;
      `);

    return result.recordset.map(mapDoctorRow);
  }

  async getDoctorById(id: number): Promise<Doctor | null> {
    const pool = await this.getPool();
    const result = await pool
      .request()
      .input('Id', sql.Int, id)
      .query(
        'SELECT Id, DoctorCode, FullName, Specialization, PhoneNumber, Availability, CreatedAt FROM dbo.Doctors WHERE Id = @Id;'
      );
    return result.recordset.length > 0 ? mapDoctorRow(result.recordset[0]) : null;
  }

  async createDoctor(input: DoctorInput, actor?: AuditActor): Promise<Doctor> {
    const pool = await this.getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const dupCheck = await new sql.Request(tx)
        .input('FullName', sql.NVarChar(120), input.fullName.trim())
        .input('PhoneNumber', sql.NVarChar(30), input.phoneNumber.trim())
        .query(`
          SELECT TOP 1 Id FROM dbo.Doctors
          WHERE LOWER(FullName) = LOWER(@FullName) AND PhoneNumber = @PhoneNumber;
        `);
      if (dupCheck.recordset.length > 0) {
        throw new Error(
          'A doctor with the same full name and phone number already exists in the directory.'
        );
      }

      const nextCodeResult = await new sql.Request(tx).query(
        'SELECT ISNULL(MAX(Id), 0) + 2001 AS NextCodeNumber FROM dbo.Doctors WITH (UPDLOCK, HOLDLOCK);'
      );
      const codeNumber = Number(nextCodeResult.recordset[0].NextCodeNumber);
      const doctorCode = `DOC-${codeNumber}`;

      const result = await new sql.Request(tx)
        .input('DoctorCode', sql.NVarChar(24), doctorCode)
        .input('FullName', sql.NVarChar(120), input.fullName)
        .input('Specialization', sql.NVarChar(100), input.specialization)
        .input('PhoneNumber', sql.NVarChar(30), input.phoneNumber)
        .input('Availability', sql.NVarChar(30), input.availability)
        .query(`
          INSERT INTO dbo.Doctors (DoctorCode, FullName, Specialization, PhoneNumber, Availability)
          OUTPUT INSERTED.Id, INSERTED.DoctorCode, INSERTED.FullName, INSERTED.Specialization, INSERTED.PhoneNumber, INSERTED.Availability, INSERTED.CreatedAt
          VALUES (@DoctorCode, @FullName, @Specialization, @PhoneNumber, @Availability);
        `);

      const created = mapDoctorRow(result.recordset[0]);
      await this.insertActivityLog(tx, {
        entityType: 'Doctor',
        entityId: created.id,
        entityCode: created.doctorCode,
        action: 'Created',
        summary: `Added ${created.fullName} · ${created.specialization} (${created.doctorCode})`,
        actor,
      });

      await tx.commit();
      return created;
    } catch (err) {
      await tx.rollback().catch(() => {});
      throw err;
    }
  }

  async updateDoctor(id: number, input: DoctorInput, actor?: AuditActor): Promise<Doctor | null> {
    const pool = await this.getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const dupCheck = await new sql.Request(tx)
        .input('Id', sql.Int, id)
        .input('FullName', sql.NVarChar(120), input.fullName.trim())
        .input('PhoneNumber', sql.NVarChar(30), input.phoneNumber.trim())
        .query(`
          SELECT TOP 1 Id FROM dbo.Doctors
          WHERE Id <> @Id AND LOWER(FullName) = LOWER(@FullName) AND PhoneNumber = @PhoneNumber;
        `);
      if (dupCheck.recordset.length > 0) {
        throw new Error(
          'A doctor with the same full name and phone number already exists in the directory.'
        );
      }

      const result = await new sql.Request(tx)
        .input('Id', sql.Int, id)
        .input('FullName', sql.NVarChar(120), input.fullName)
        .input('Specialization', sql.NVarChar(100), input.specialization)
        .input('PhoneNumber', sql.NVarChar(30), input.phoneNumber)
        .input('Availability', sql.NVarChar(30), input.availability)
        .query(`
          UPDATE dbo.Doctors
          SET FullName = @FullName,
              Specialization = @Specialization,
              PhoneNumber = @PhoneNumber,
              Availability = @Availability
          OUTPUT INSERTED.Id, INSERTED.DoctorCode, INSERTED.FullName, INSERTED.Specialization, INSERTED.PhoneNumber, INSERTED.Availability, INSERTED.CreatedAt
          WHERE Id = @Id;
        `);

      if (result.recordset.length === 0) {
        await tx.rollback();
        return null;
      }
      const updated = mapDoctorRow(result.recordset[0]);
      await this.insertActivityLog(tx, {
        entityType: 'Doctor',
        entityId: updated.id,
        entityCode: updated.doctorCode,
        action: 'Updated',
        summary: `Updated profile for ${updated.fullName} · ${updated.availability} (${updated.doctorCode})`,
        actor,
      });
      await tx.commit();
      return updated;
    } catch (err) {
      await tx.rollback().catch(() => {});
      throw err;
    }
  }

  async deleteDoctor(id: number, actor?: AuditActor): Promise<boolean> {
    const pool = await this.getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const existingRes = await new sql.Request(tx)
        .input('Id', sql.Int, id)
        .query(`
          SELECT
            d.Id,
            d.DoctorCode,
            d.FullName,
            (SELECT COUNT(*) FROM dbo.Appointments WHERE DoctorId = d.Id) AS LinkedAppointments
          FROM dbo.Doctors d
          WHERE d.Id = @Id;
        `);
      if (existingRes.recordset.length === 0) {
        await tx.rollback();
        return false;
      }

      const row = existingRes.recordset[0];
      const doctorCode = String(row.DoctorCode);
      const fullName = String(row.FullName);
      const linkedCount = Number(row.LinkedAppointments);

      if (linkedCount > 0) {
        throw new Error(
          `Cascading hard deletes are restricted to Demo Mode. Doctor ${doctorCode} has ${linkedCount} linked appointment${linkedCount === 1 ? '' : 's'}; reassign or resolve linked appointments before removing this physician.`
        );
      }

      await new sql.Request(tx)
        .input('Id', sql.Int, id)
        .query('DELETE FROM dbo.Doctors WHERE Id = @Id;');

      await this.insertActivityLog(tx, {
        entityType: 'Doctor',
        entityId: id,
        entityCode: doctorCode,
        action: 'Deleted',
        summary: `Removed unlinked physician ${fullName} (${doctorCode}) from directory`,
        actor,
      });

      await tx.commit();
      return true;
    } catch (err) {
      await tx.rollback().catch(() => {});
      throw err;
    }
  }

  async listAppointments(filter?: AppointmentFilter): Promise<Appointment[]> {
    const pool = await this.getPool();
    const term = filter?.search?.trim() || '';
    const dateFilter = filter?.date?.trim() || null;
    const statusFilter = filter?.status && filter.status !== 'All' ? filter.status : null;
    const patientIdFilter = filter?.patientId || null;
    const doctorIdFilter = filter?.doctorId || null;

    const result = await pool
      .request()
      .input('DateFilter', sql.Date, dateFilter)
      .input('StatusFilter', sql.NVarChar(24), statusFilter)
      .input('PatientIdFilter', sql.Int, patientIdFilter)
      .input('DoctorIdFilter', sql.Int, doctorIdFilter)
      .input('SearchTerm', sql.NVarChar(120), term ? `%${term}%` : null)
      .query(`
        SELECT
          a.Id, a.AppointmentCode, a.PatientId, p.PatientCode, p.FullName AS PatientName,
          a.DoctorId, d.DoctorCode, d.FullName AS DoctorName, d.Specialization AS DoctorSpecialization,
          a.AppointmentDate, a.AppointmentTime, a.Reason, a.Status, a.CreatedAt
        FROM dbo.Appointments a
        INNER JOIN dbo.Patients p ON p.Id = a.PatientId
        INNER JOIN dbo.Doctors d ON d.Id = a.DoctorId
        WHERE (@DateFilter IS NULL OR a.AppointmentDate = @DateFilter)
          AND (@StatusFilter IS NULL OR a.Status = @StatusFilter)
          AND (@PatientIdFilter IS NULL OR a.PatientId = @PatientIdFilter)
          AND (@DoctorIdFilter IS NULL OR a.DoctorId = @DoctorIdFilter)
          AND (
            @SearchTerm IS NULL
            OR a.AppointmentCode LIKE @SearchTerm
            OR p.FullName LIKE @SearchTerm
            OR p.PatientCode LIKE @SearchTerm
            OR d.FullName LIKE @SearchTerm
            OR d.DoctorCode LIKE @SearchTerm
            OR d.Specialization LIKE @SearchTerm
          )
        ORDER BY a.AppointmentDate DESC, a.AppointmentTime ASC;
      `);

    return result.recordset.map(mapAppointmentRow);
  }

  private async fetchAppointmentRow(
    executor: sql.ConnectionPool | sql.Transaction,
    id: number
  ): Promise<Appointment | null> {
    const result = await executor
      .request()
      .input('Id', sql.Int, id)
      .query(`
        SELECT
          a.Id, a.AppointmentCode, a.PatientId, p.PatientCode, p.FullName AS PatientName,
          a.DoctorId, d.DoctorCode, d.FullName AS DoctorName, d.Specialization AS DoctorSpecialization,
          a.AppointmentDate, a.AppointmentTime, a.Reason, a.Status, a.CreatedAt
        FROM dbo.Appointments a
        INNER JOIN dbo.Patients p ON p.Id = a.PatientId
        INNER JOIN dbo.Doctors d ON d.Id = a.DoctorId
        WHERE a.Id = @Id;
      `);

    return result.recordset.length > 0 ? mapAppointmentRow(result.recordset[0]) : null;
  }

  async getAppointmentById(id: number): Promise<Appointment | null> {
    const pool = await this.getPool();
    return this.fetchAppointmentRow(pool, id);
  }

  private async validateAppointmentIntegrity(
    executor: sql.ConnectionPool | sql.Transaction,
    input: AppointmentInput,
    targetStatus: AppointmentStatus,
    excludeId?: number
  ): Promise<void> {
    const patientRes = await executor.request()
      .input('PatientId', sql.Int, input.patientId)
      .query('SELECT TOP 1 Id FROM dbo.Patients WHERE Id = @PatientId;');
    if (patientRes.recordset.length === 0) {
      throw new Error('Selected patient does not exist.');
    }

    const doctorRes = await executor.request()
      .input('DoctorId', sql.Int, input.doctorId)
      .query('SELECT TOP 1 Id, Availability FROM dbo.Doctors WHERE Id = @DoctorId;');
    if (doctorRes.recordset.length === 0) {
      throw new Error('Selected doctor does not exist.');
    }

    if (targetStatus === 'Scheduled') {
      if (String(doctorRes.recordset[0].Availability) === 'On Leave') {
        throw new Error(
          'Cannot book a scheduled appointment with a doctor currently marked On Leave.'
        );
      }

      const doctorConflict = await executor.request()
        .input('ExcludeId', sql.Int, excludeId ?? 0)
        .input('DoctorId', sql.Int, input.doctorId)
        .input('AppointmentDate', sql.Date, input.appointmentDate)
        .input('AppointmentTime', sql.NVarChar(16), input.appointmentTime)
        .query(`
          SELECT TOP 1 Id FROM dbo.Appointments
          WHERE Id <> @ExcludeId
            AND Status = N'Scheduled'
            AND DoctorId = @DoctorId
            AND AppointmentDate = @AppointmentDate
            AND AppointmentTime = @AppointmentTime;
        `);
      if (doctorConflict.recordset.length > 0) {
        throw new Error('This doctor already has a scheduled appointment at that date and time.');
      }

      const patientConflict = await executor.request()
        .input('ExcludeId', sql.Int, excludeId ?? 0)
        .input('PatientId', sql.Int, input.patientId)
        .input('AppointmentDate', sql.Date, input.appointmentDate)
        .input('AppointmentTime', sql.NVarChar(16), input.appointmentTime)
        .query(`
          SELECT TOP 1 Id FROM dbo.Appointments
          WHERE Id <> @ExcludeId
            AND Status = N'Scheduled'
            AND PatientId = @PatientId
            AND AppointmentDate = @AppointmentDate
            AND AppointmentTime = @AppointmentTime;
        `);
      if (patientConflict.recordset.length > 0) {
        throw new Error('This patient already has a scheduled appointment at that date and time.');
      }
    }
  }

  async createAppointment(input: AppointmentInput, actor?: AuditActor): Promise<Appointment> {
    const targetStatus = input.status || 'Scheduled';
    const pool = await this.getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      await this.validateAppointmentIntegrity(tx, input, targetStatus);

      const nextCodeResult = await new sql.Request(tx).query(
        'SELECT ISNULL(MAX(Id), 0) + 3001 AS NextCodeNumber FROM dbo.Appointments WITH (UPDLOCK, HOLDLOCK);'
      );
      const codeNumber = Number(nextCodeResult.recordset[0].NextCodeNumber);
      const appointmentCode = `APT-${codeNumber}`;

      const insertResult = await new sql.Request(tx)
        .input('AppointmentCode', sql.NVarChar(24), appointmentCode)
        .input('PatientId', sql.Int, input.patientId)
        .input('DoctorId', sql.Int, input.doctorId)
        .input('AppointmentDate', sql.Date, input.appointmentDate)
        .input('AppointmentTime', sql.NVarChar(16), input.appointmentTime)
        .input('Reason', sql.NVarChar(255), input.reason?.trim() || 'General outpatient consultation')
        .input('Status', sql.NVarChar(24), targetStatus)
        .query(`
          INSERT INTO dbo.Appointments (AppointmentCode, PatientId, DoctorId, AppointmentDate, AppointmentTime, Reason, Status)
          OUTPUT INSERTED.Id
          VALUES (@AppointmentCode, @PatientId, @DoctorId, @AppointmentDate, @AppointmentTime, @Reason, @Status);
        `);

      const insertedId = Number(insertResult.recordset[0].Id);
      const created = await this.fetchAppointmentRow(tx, insertedId);
      if (!created) {
        throw new Error('Failed to retrieve newly created appointment.');
      }

      await this.insertActivityLog(tx, {
        entityType: 'Appointment',
        entityId: created.id,
        entityCode: created.appointmentCode,
        action: 'Created',
        summary: `Booked ${created.appointmentCode} for ${created.patientName} with ${created.doctorName} (${created.appointmentDate} ${created.appointmentTime})`,
        actor,
      });

      await tx.commit();
      return created;
    } catch (err) {
      await tx.rollback().catch(() => {});
      throw err;
    }
  }

  async updateAppointment(
    id: number,
    input: AppointmentInput,
    actor?: AuditActor
  ): Promise<Appointment | null> {
    const pool = await this.getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const existing = await this.fetchAppointmentRow(tx, id);
      if (!existing) {
        await tx.rollback();
        return null;
      }

      const targetStatus = input.status || existing.status;
      await this.validateAppointmentIntegrity(tx, input, targetStatus, id);

      const updateResult = await new sql.Request(tx)
        .input('Id', sql.Int, id)
        .input('PatientId', sql.Int, input.patientId)
        .input('DoctorId', sql.Int, input.doctorId)
        .input('AppointmentDate', sql.Date, input.appointmentDate)
        .input('AppointmentTime', sql.NVarChar(16), input.appointmentTime)
        .input('Reason', sql.NVarChar(255), input.reason?.trim() || existing.reason)
        .input('Status', sql.NVarChar(24), targetStatus)
        .query(`
          UPDATE dbo.Appointments
          SET PatientId = @PatientId,
              DoctorId = @DoctorId,
              AppointmentDate = @AppointmentDate,
              AppointmentTime = @AppointmentTime,
              Reason = @Reason,
              Status = @Status
          WHERE Id = @Id;
          SELECT @@ROWCOUNT AS UpdatedCount;
        `);

      if (Number(updateResult.recordset[0].UpdatedCount) === 0) {
        await tx.rollback();
        return null;
      }

      const updated = await this.fetchAppointmentRow(tx, id);
      if (!updated) {
        await tx.rollback();
        return null;
      }

      await this.insertActivityLog(tx, {
        entityType: 'Appointment',
        entityId: updated.id,
        entityCode: updated.appointmentCode,
        action: 'Updated',
        summary: `Updated appointment ${updated.appointmentCode} (${updated.patientName} · ${updated.appointmentDate} ${updated.appointmentTime})`,
        actor,
      });

      await tx.commit();
      return updated;
    } catch (err) {
      await tx.rollback().catch(() => {});
      throw err;
    }
  }

  async updateAppointmentStatus(
    id: number,
    status: AppointmentStatus,
    actor?: AuditActor
  ): Promise<Appointment | null> {
    const pool = await this.getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const existing = await this.fetchAppointmentRow(tx, id);
      if (!existing) {
        await tx.rollback();
        return null;
      }

      if (status === 'Scheduled' && existing.status !== 'Scheduled') {
        await this.validateAppointmentIntegrity(
          tx,
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

      const result = await new sql.Request(tx)
        .input('Id', sql.Int, id)
        .input('Status', sql.NVarChar(24), status)
        .query(`
          UPDATE dbo.Appointments
          SET Status = @Status
          WHERE Id = @Id;
          SELECT @@ROWCOUNT AS UpdatedCount;
        `);

      if (Number(result.recordset[0].UpdatedCount) === 0) {
        await tx.rollback();
        return null;
      }

      const updated = await this.fetchAppointmentRow(tx, id);
      if (!updated) {
        await tx.rollback();
        return null;
      }

      await this.insertActivityLog(tx, {
        entityType: 'Appointment',
        entityId: updated.id,
        entityCode: updated.appointmentCode,
        action: 'Status Changed',
        summary: `Changed ${updated.appointmentCode} (${updated.patientName}) status from ${existing.status} to ${status}`,
        actor,
      });

      await tx.commit();
      return updated;
    } catch (err) {
      await tx.rollback().catch(() => {});
      throw err;
    }
  }

  async deleteAppointment(id: number, actor?: AuditActor): Promise<boolean> {
    const pool = await this.getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const existing = await this.fetchAppointmentRow(tx, id);
      if (!existing) {
        await tx.rollback();
        return false;
      }

      if (existing.status === 'Completed') {
        throw new Error(
          `Completed appointment ${existing.appointmentCode} cannot be hard-deleted in Azure SQL production mode to preserve clinical audit history.`
        );
      }
      if (existing.status === 'Scheduled') {
        throw new Error(
          `Active scheduled appointment ${existing.appointmentCode} cannot be casually hard-deleted in Azure SQL production mode. Cancel the appointment first so status history is preserved.`
        );
      }

      const result = await new sql.Request(tx)
        .input('Id', sql.Int, id)
        .query('DELETE FROM dbo.Appointments WHERE Id = @Id; SELECT @@ROWCOUNT AS DeletedCount;');
      const deleted = Number(result.recordset[0].DeletedCount) > 0;
      if (!deleted) {
        await tx.rollback();
        return false;
      }

      await this.insertActivityLog(tx, {
        entityType: 'Appointment',
        entityId: existing.id,
        entityCode: existing.appointmentCode,
        action: 'Deleted',
        summary: `Deleted cancelled appointment ${existing.appointmentCode} for ${existing.patientName}`,
        actor,
      });

      await tx.commit();
      return true;
    } catch (err) {
      await tx.rollback().catch(() => {});
      throw err;
    }
  }
}
