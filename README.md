# Cloud-Based Hospital Management System

An academic cloud engineering application designed for hospital administration, built with **React**, **TypeScript**, **Node.js / Express**, and **Microsoft Azure SQL Database** (`mssql`), with a standalone **Demo Mode** for testing without an Azure subscription.

## Architecture Overview

- **Frontend (`/src`)**: React 19 + TypeScript + Tailwind CSS medical administration dashboard featuring navy-blue and crisp-white clinical styling, responsive sidebar navigation, tabular numeric alignment, and full CRUD workflows.
- **Backend (`/server.ts`, `/src/server`)**: Express.js REST API server listening on `process.env.PORT || 3000`, using HMAC-SHA256 Bearer session tokens and `scrypt` password hashing.
- **Storage Separation (`/src/server/repositories`)**:
  - `demoRepository.ts`: In-memory sample dataset for offline/academic evaluation without an Azure subscription. Cascading deletes are enabled only in Demo Mode, and data resets on server restart or via **Reset Sample Data**.
  - `azureSqlRepository.ts`: Parameterized Microsoft SQL Server / Azure SQL Database implementation using the `mssql` driver (`ConnectionPool` with TLS encryption enabled and `sql.Transaction` atomic audit logging). Production mode blocks cascading hard deletes (`HTTP 409`) and protects `Scheduled`/`Completed` appointments to preserve clinical and audit history.
- **Database Scripts (`/database`)**:
  - `schema.sql`: T-SQL tables (`Users`, `Patients`, `Doctors`, `Appointments`, `ActivityLogs`), primary keys, foreign keys (`ON DELETE NO ACTION` to prevent cascading hard deletes), `CHECK` constraints, unique codes, and nonclustered indexes.
  - `seed.sql`: Idempotent T-SQL sample data for initial testing in Azure SQL Database.

## Functional Modules

1. **Admin Login & Protected Routes**:
   - Supports one-click **Demo Administrator** sign-in when running in Demo Mode.
   - Supports standard email/password authentication verified on the server (`scrypt` hash or `ADMIN_PASSCODE` environment variable) and first-run administrator creation in Azure SQL mode.
   - All `/api/dashboard`, `/api/activity-logs`, `/api/patients`, `/api/doctors`, and `/api/appointments` endpoints enforce Bearer token verification.
2. **Dashboard & Audit Activity Log**:
   - Real-time metrics: Total Patients, Total Doctors (with Available count), Total Appointments, and Today's Appointments (synchronized to client local calendar date via `?today=YYYY-MM-DD`).
   - Recent Patient Registrations table.
   - Appointment Status breakdown (Scheduled, Completed, Cancelled) and Today's Outpatient Queue.
   - Filterable **Audit Activity Log** tracking create, update, status-change, and delete operations across patients, doctors, and appointments with actor attribution.
3. **Patient Management**:
   - Register, view (with appointment history), edit, and delete patient records.
   - Search by name, Patient ID (`PAT-1001`), or phone number, plus gender filter.
4. **Doctor Management**:
   - Add, view (with assigned schedule), edit, and delete doctors.
   - Search by name, Doctor ID (`DOC-2001`), or specialization, plus availability filter (`Available`, `In Consultation`, `On Leave`).
5. **Appointment Management**:
   - Book appointments by selecting patient, doctor, date, time, and consultation reason.
   - View full appointment summaries, update appointment status (`Scheduled`, `Completed`, `Cancelled`), edit details, cancel, or delete appointments.
   - Filter by date, quick `"Today"` toggle, status, and search query.

## Local Development Setup

### Prerequisites
- Node.js 20 LTS or 22 LTS
- npm 10+

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (Optional for Demo Mode)
Copy `.env.example` to `.env` if you want to customize settings:
```bash
cp .env.example .env
```
By default (`STORAGE_MODE=demo` or when Azure SQL variables are left blank), the application starts in **Demo Mode** with sample data in memory—no database setup required.

### 3. Run in Development Mode
```bash
npm run dev
```
Open `http://localhost:3000` in your browser and click **Sign in as Demo Administrator**.

### 4. Verify Build & Run Automated API Tests
```bash
npm run lint
npm test
```

### 5. Production Build & Start
```bash
npm run build
NODE_ENV=production npm start
```

## Connecting to Microsoft Azure SQL Database Locally

1. Provision an Azure SQL Database (see `AZURE_DEPLOYMENT.md`).
2. Run `database/schema.sql` and optionally `database/seed.sql` against your database.
3. Set the following variables in `.env` (never commit `.env` to Git):
   - `STORAGE_MODE=azure_sql`
   - `AZURE_SQL_SERVER=<your-server>.database.windows.net`
   - `AZURE_SQL_DATABASE=<your-database>`
   - `AZURE_SQL_USER=<your-sql-username>`
   - `AZURE_SQL_PASSWORD=<your-sql-password>`
   - `AZURE_SQL_ENCRYPT=true`
4. Start the server (`npm run dev` or `npm start`). On first launch, use the **Initial Administrator Setup** form to create your administrator login in `dbo.Users` (or configure `ADMIN_EMAIL` + `ADMIN_PASSCODE` in environment variables).

## REST API Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Health check for Azure App Service probes |
| `GET` | `/api/auth/status` | Public | Returns active storage mode and setup status |
| `POST` | `/api/auth/demo-login` | Public | Demo Mode administrator sign-in (disabled in Azure SQL mode) |
| `POST` | `/api/auth/login` | Public | Email & password sign-in |
| `POST` | `/api/auth/setup-admin` | Public | One-time first-run administrator creation |
| `POST` | `/api/auth/logout` | Public | Revokes current session token |
| `GET` | `/api/dashboard` | Bearer | Dashboard KPIs, statistics, and recent activity (`?today=YYYY-MM-DD`) |
| `GET` | `/api/activity-logs` | Bearer | Filterable audit log (`entityType`, `action`, `search`, `limit`) |
| `GET/POST` | `/api/patients` | Bearer | List/search or register patients |
| `PUT/DELETE` | `/api/patients/:id` | Bearer | Update or delete a patient record |
| `GET/POST` | `/api/doctors` | Bearer | List/search or add doctors |
| `PUT/DELETE` | `/api/doctors/:id` | Bearer | Update or delete a doctor record |
| `GET/POST` | `/api/appointments` | Bearer | List/filter or book appointments |
| `PUT/PATCH/DELETE` | `/api/appointments/:id` | Bearer | Update, change status, or delete appointment |
| `POST` | `/api/system/reset-demo` | Bearer | Restores Demo Mode dataset and initial sample audit logs |
