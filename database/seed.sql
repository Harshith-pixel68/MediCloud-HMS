-- ============================================================================
-- Cloud-Based Hospital Management System
-- Microsoft SQL Server / Azure SQL Database Seed Script (T-SQL)
-- ============================================================================
-- Note on Admin Credentials:
-- Do not store plaintext passwords in version control. On first startup in
-- Azure SQL mode, if no administrator exists in dbo.Users and ADMIN_PASSCODE
-- is unset, the application presents a one-time Administrator Setup form that
-- hashes your chosen password using scrypt and stores it in dbo.Users.
-- ============================================================================

SET NOCOUNT ON;
GO

-- Seed Patients
IF NOT EXISTS (SELECT 1 FROM dbo.Patients)
BEGIN
    INSERT INTO dbo.Patients (PatientCode, FullName, Age, Gender, PhoneNumber, Address, RegistrationDate)
    VALUES
        (N'PAT-1001', N'Aarav Sharma', 42, N'Male', N'+1-555-204-8812', N'412 Oakwood Avenue, North Wing', DATEADD(DAY, -14, CAST(GETUTCDATE() AS DATE))),
        (N'PAT-1002', N'Maya Lin', 29, N'Female', N'+1-555-309-4410', N'78 Harborview Lane, Apt 4B', DATEADD(DAY, -10, CAST(GETUTCDATE() AS DATE))),
        (N'PAT-1003', N'Robert Thornton', 64, N'Male', N'+1-555-418-9921', N'1902 Cedar Crest Road', DATEADD(DAY, -7, CAST(GETUTCDATE() AS DATE))),
        (N'PAT-1004', N'Priya Nair', 35, N'Female', N'+1-555-612-3305', N'885 Maple Grove Drive', DATEADD(DAY, -4, CAST(GETUTCDATE() AS DATE))),
        (N'PAT-1005', N'Daniel Okafor', 51, N'Male', N'+1-555-734-1290', N'230 Riverbend Parkway', DATEADD(DAY, -2, CAST(GETUTCDATE() AS DATE))),
        (N'PAT-1006', N'Sofia Alvarez', 19, N'Female', N'+1-555-845-6723', N'614 University Terrace', DATEADD(DAY, -1, CAST(GETUTCDATE() AS DATE))),
        (N'PAT-1007', N'Liam Henderson', 47, N'Male', N'+1-555-901-5540', N'1124 Willowbrook Court', CAST(GETUTCDATE() AS DATE)),
        (N'PAT-1008', N'Hannah Brooks', 33, N'Female', N'+1-555-962-1184', N'309 Meadowlark Street', CAST(GETUTCDATE() AS DATE));
END;
GO

-- Seed Doctors
IF NOT EXISTS (SELECT 1 FROM dbo.Doctors)
BEGIN
    INSERT INTO dbo.Doctors (DoctorCode, FullName, Specialization, PhoneNumber, Availability)
    VALUES
        (N'DOC-2001', N'Dr. Catherine Mercer', N'Cardiology', N'+1-555-110-2001', N'Available'),
        (N'DOC-2002', N'Dr. Vikram Patel', N'Neurology', N'+1-555-110-2002', N'Available'),
        (N'DOC-2003', N'Dr. Grace Kim', N'Pediatrics', N'+1-555-110-2003', N'In Consultation'),
        (N'DOC-2004', N'Dr. Marcus Bennett', N'Orthopedics', N'+1-555-110-2004', N'Available'),
        (N'DOC-2005', N'Dr. Nadia Al-Mansoor', N'Internal Medicine', N'+1-555-110-2005', N'Available'),
        (N'DOC-2006', N'Dr. Oliver Wright', N'Dermatology', N'+1-555-110-2006', N'On Leave');
END;
GO

-- Seed Appointments (mapped dynamically by business codes)
IF NOT EXISTS (SELECT 1 FROM dbo.Appointments)
BEGIN
    INSERT INTO dbo.Appointments (AppointmentCode, PatientId, DoctorId, AppointmentDate, AppointmentTime, Reason, Status)
    SELECT N'APT-3001', p.Id, d.Id, CAST(GETUTCDATE() AS DATE), N'09:00', N'Routine cardiac follow-up & ECG review', N'Completed'
    FROM dbo.Patients p, dbo.Doctors d WHERE p.PatientCode = N'PAT-1001' AND d.DoctorCode = N'DOC-2001'
    UNION ALL
    SELECT N'APT-3002', p.Id, d.Id, CAST(GETUTCDATE() AS DATE), N'10:30', N'Migraine evaluation and neurology consult', N'Scheduled'
    FROM dbo.Patients p, dbo.Doctors d WHERE p.PatientCode = N'PAT-1002' AND d.DoctorCode = N'DOC-2002'
    UNION ALL
    SELECT N'APT-3003', p.Id, d.Id, CAST(GETUTCDATE() AS DATE), N'11:15', N'Post-operative knee mobility check', N'Scheduled'
    FROM dbo.Patients p, dbo.Doctors d WHERE p.PatientCode = N'PAT-1003' AND d.DoctorCode = N'DOC-2004'
    UNION ALL
    SELECT N'APT-3004', p.Id, d.Id, CAST(GETUTCDATE() AS DATE), N'14:00', N'Annual physical and blood panel review', N'Scheduled'
    FROM dbo.Patients p, dbo.Doctors d WHERE p.PatientCode = N'PAT-1007' AND d.DoctorCode = N'DOC-2005'
    UNION ALL
    SELECT N'APT-3005', p.Id, d.Id, CAST(GETUTCDATE() AS DATE), N'15:30', N'Hypertension medication adjustment', N'Cancelled'
    FROM dbo.Patients p, dbo.Doctors d WHERE p.PatientCode = N'PAT-1005' AND d.DoctorCode = N'DOC-2001'
    UNION ALL
    SELECT N'APT-3006', p.Id, d.Id, DATEADD(DAY, 1, CAST(GETUTCDATE() AS DATE)), N'09:30', N'Pediatric immunization & wellness check', N'Scheduled'
    FROM dbo.Patients p, dbo.Doctors d WHERE p.PatientCode = N'PAT-1006' AND d.DoctorCode = N'DOC-2003'
    UNION ALL
    SELECT N'APT-3007', p.Id, d.Id, DATEADD(DAY, 1, CAST(GETUTCDATE() AS DATE)), N'11:00', N'Follow-up diagnostic consultation', N'Scheduled'
    FROM dbo.Patients p, dbo.Doctors d WHERE p.PatientCode = N'PAT-1004' AND d.DoctorCode = N'DOC-2005'
    UNION ALL
    SELECT N'APT-3008', p.Id, d.Id, DATEADD(DAY, -2, CAST(GETUTCDATE() AS DATE)), N'13:45', N'Initial outpatient assessment', N'Completed'
    FROM dbo.Patients p, dbo.Doctors d WHERE p.PatientCode = N'PAT-1008' AND d.DoctorCode = N'DOC-2005';
END;
GO

-- Seed Initial Audit Activity Logs
IF NOT EXISTS (SELECT 1 FROM dbo.ActivityLogs)
BEGIN
    INSERT INTO dbo.ActivityLogs (EntityType, EntityId, EntityCode, Action, ActorName, ActorEmail, Summary)
    VALUES
        (N'Patient', 8, N'PAT-1008', N'Created', N'System Seed', N'system@medicloud.local', N'Registered patient Hannah Brooks (PAT-1008)'),
        (N'Doctor', 5, N'DOC-2005', N'Created', N'System Seed', N'system@medicloud.local', N'Added Dr. Nadia Al-Mansoor · Internal Medicine (DOC-2005)'),
        (N'Appointment', 2, N'APT-3002', N'Created', N'System Seed', N'system@medicloud.local', N'Booked appointment APT-3002 for Maya Lin with Dr. Vikram Patel'),
        (N'Appointment', 1, N'APT-3001', N'Status Changed', N'System Seed', N'system@medicloud.local', N'Marked appointment APT-3001 for Aarav Sharma as Completed');
END;
GO

