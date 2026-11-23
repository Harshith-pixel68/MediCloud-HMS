-- ============================================================================
-- Cloud-Based Hospital Management System
-- Microsoft SQL Server / Azure SQL Database Schema (T-SQL)
-- ============================================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- 1. Users Table (Administrators & Staff Accounts)
IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users (
        Id INT IDENTITY(1,1) NOT NULL,
        FullName NVARCHAR(120) NOT NULL,
        Email NVARCHAR(160) NOT NULL,
        PasswordHash NVARCHAR(255) NOT NULL,
        Role NVARCHAR(40) NOT NULL CONSTRAINT DF_Users_Role DEFAULT ('Administrator'),
        IsActive BIT NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT (1),
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_Users PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_Users_Email UNIQUE (Email),
        CONSTRAINT CK_Users_Role CHECK (Role IN ('Administrator', 'Staff'))
    );
END;
GO

-- 2. Patients Table
IF OBJECT_ID(N'dbo.Patients', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Patients (
        Id INT IDENTITY(1,1) NOT NULL,
        PatientCode NVARCHAR(24) NOT NULL,
        FullName NVARCHAR(120) NOT NULL,
        Age INT NOT NULL,
        Gender NVARCHAR(20) NOT NULL,
        PhoneNumber NVARCHAR(30) NOT NULL,
        Address NVARCHAR(255) NOT NULL,
        RegistrationDate DATE NOT NULL CONSTRAINT DF_Patients_RegistrationDate DEFAULT (CAST(GETUTCDATE() AS DATE)),
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Patients_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_Patients PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_Patients_PatientCode UNIQUE (PatientCode),
        CONSTRAINT CK_Patients_Age CHECK (Age >= 0 AND Age <= 130),
        CONSTRAINT CK_Patients_Gender CHECK (Gender IN ('Male', 'Female', 'Other'))
    );

    CREATE NONCLUSTERED INDEX IX_Patients_FullName ON dbo.Patients (FullName);
    CREATE NONCLUSTERED INDEX IX_Patients_RegistrationDate ON dbo.Patients (RegistrationDate DESC);
END;
GO

-- 3. Doctors Table
IF OBJECT_ID(N'dbo.Doctors', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Doctors (
        Id INT IDENTITY(1,1) NOT NULL,
        DoctorCode NVARCHAR(24) NOT NULL,
        FullName NVARCHAR(120) NOT NULL,
        Specialization NVARCHAR(100) NOT NULL,
        PhoneNumber NVARCHAR(30) NOT NULL,
        Availability NVARCHAR(30) NOT NULL CONSTRAINT DF_Doctors_Availability DEFAULT ('Available'),
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Doctors_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_Doctors PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_Doctors_DoctorCode UNIQUE (DoctorCode),
        CONSTRAINT CK_Doctors_Availability CHECK (Availability IN ('Available', 'In Consultation', 'On Leave'))
    );

    CREATE NONCLUSTERED INDEX IX_Doctors_Specialization ON dbo.Doctors (Specialization);
END;
GO

-- 4. Appointments Table
IF OBJECT_ID(N'dbo.Appointments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Appointments (
        Id INT IDENTITY(1,1) NOT NULL,
        AppointmentCode NVARCHAR(24) NOT NULL,
        PatientId INT NOT NULL,
        DoctorId INT NOT NULL,
        AppointmentDate DATE NOT NULL,
        AppointmentTime NVARCHAR(16) NOT NULL,
        Reason NVARCHAR(255) NULL,
        Status NVARCHAR(24) NOT NULL CONSTRAINT DF_Appointments_Status DEFAULT ('Scheduled'),
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Appointments_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_Appointments PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_Appointments_AppointmentCode UNIQUE (AppointmentCode),
        -- Restrict cascading hard deletes in production Azure SQL to preserve clinical records
        CONSTRAINT FK_Appointments_Patients FOREIGN KEY (PatientId)
            REFERENCES dbo.Patients (Id)
            ON DELETE NO ACTION,
        CONSTRAINT FK_Appointments_Doctors FOREIGN KEY (DoctorId)
            REFERENCES dbo.Doctors (Id)
            ON DELETE NO ACTION,
        CONSTRAINT CK_Appointments_Status CHECK (Status IN ('Scheduled', 'Completed', 'Cancelled'))
    );

    CREATE NONCLUSTERED INDEX IX_Appointments_Date_Status ON dbo.Appointments (AppointmentDate, Status);
    CREATE NONCLUSTERED INDEX IX_Appointments_PatientId ON dbo.Appointments (PatientId);
    CREATE NONCLUSTERED INDEX IX_Appointments_DoctorId ON dbo.Appointments (DoctorId);
END;
GO

-- 5. ActivityLogs Table (Audit Trail across Patients, Doctors, and Appointments)
IF OBJECT_ID(N'dbo.ActivityLogs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ActivityLogs (
        Id INT IDENTITY(1,1) NOT NULL,
        EntityType NVARCHAR(24) NOT NULL,
        EntityId INT NOT NULL,
        EntityCode NVARCHAR(24) NOT NULL,
        Action NVARCHAR(24) NOT NULL,
        ActorName NVARCHAR(120) NOT NULL,
        ActorEmail NVARCHAR(160) NOT NULL,
        Summary NVARCHAR(300) NOT NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ActivityLogs_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_ActivityLogs PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT CK_ActivityLogs_EntityType CHECK (EntityType IN ('Patient', 'Doctor', 'Appointment')),
        CONSTRAINT CK_ActivityLogs_Action CHECK (Action IN ('Created', 'Updated', 'Status Changed', 'Deleted'))
    );

    CREATE NONCLUSTERED INDEX IX_ActivityLogs_CreatedAt ON dbo.ActivityLogs (CreatedAt DESC, Id DESC);
    CREATE NONCLUSTERED INDEX IX_ActivityLogs_EntityType ON dbo.ActivityLogs (EntityType, Id DESC);
END;
GO

