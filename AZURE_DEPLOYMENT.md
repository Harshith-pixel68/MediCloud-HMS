# Microsoft Azure Deployment Guide

This guide explains how to deploy the **Cloud-Based Hospital Management System** to **Microsoft Azure App Service** and **Azure SQL Database** without hardcoding credentials in source code.

---

## Architecture on Microsoft Azure

- **Compute**: Azure App Service (Linux, Node.js 22 LTS) serves both the compiled React frontend (`dist/`) and the Express.js REST API (`/api/*`) on the port injected via `process.env.PORT`.
- **Database**: Azure SQL Database stores `dbo.Users`, `dbo.Patients`, `dbo.Doctors`, `dbo.Appointments`, and `dbo.ActivityLogs` over TLS (`encrypt: true`). Foreign keys use `ON DELETE NO ACTION`, and the repository blocks cascading hard deletes as well as hard deletion of `Scheduled` or `Completed` appointments (`HTTP 409`) so clinical and audit records remain intact.

---

## Step 1: Provision Azure SQL Database

1. Sign in to the [Azure Portal](https://portal.azure.com).
2. Create a **Resource Group** (e.g., `rg-hospital-mgmt`).
3. Search for **Azure SQL** -> **Create** -> **SQL Database** (Single database).
   - Select your Resource Group.
   - Enter a Database name (e.g., `hospital_management_db`).
   - Create a new **SQL Server** (e.g., `hospital-sql-server.database.windows.net`) using SQL authentication.
   - Choose a cost-effective tier suitable for academic/dev workloads (e.g., **Basic** or **General Purpose - Serverless**).
4. Under **Networking** -> **Firewall rules**:
   - Enable **"Allow Azure services and resources to access this server"** so Azure App Service can connect.
   - Temporarily add your local client IP if you want to run SQL scripts from your workstation or Azure Data Studio.

---

## Step 2: Initialize Database Schema & Seed Data

Using **Azure Portal Query Editor**, **Azure Data Studio**, or `sqlcmd`:

1. Connect to `hospital_management_db`.
2. Execute `/database/schema.sql` to create `Users`, `Patients`, `Doctors`, `Appointments`, and `ActivityLogs` with constraints and indexes.
3. *(Optional)* Execute `/database/seed.sql` to populate initial sample patients, doctors, appointments, and audit activity records.

---

## Step 3: Create Azure App Service (Linux Node.js)

Using the Azure Portal or Azure CLI:

```bash
# 1. Create an App Service Plan (Linux, Free F1 or Basic B1)
az appservice plan create \
  --name plan-hospital-mgmt \
  --resource-group rg-hospital-mgmt \
  --sku B1 \
  --is-linux

# 2. Create the Web App with Node.js 22 LTS
az webapp create \
  --resource-group rg-hospital-mgmt \
  --plan plan-hospital-mgmt \
  --name hospital-mgmt-app \
  --runtime "NODE:22-lts"
```

---

## Step 4: Configure Application Settings (Environment Variables)

In the Azure Portal, go to your **App Service -> Settings -> Environment variables** (App settings) and add:

| Name | Value | Notes |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Serves the compiled Vite SPA from `dist/` |
| `STORAGE_MODE` | `azure_sql` | Switches backend from Demo Mode to Azure SQL |
| `AZURE_SQL_SERVER` | `<your-server>.database.windows.net` | Azure SQL logical server FQDN |
| `AZURE_SQL_DATABASE` | `hospital_management_db` | Target database name |
| `AZURE_SQL_USER` | `<your-sql-admin>` | SQL Server login username |
| `AZURE_SQL_PASSWORD` | `<your-strong-password>` | Stored securely in Azure App Settings |
| `AZURE_SQL_PORT` | `1433` | Default SQL Server port |
| `AZURE_SQL_ENCRYPT` | `true` | Required TLS encryption for Azure SQL |
| `SESSION_SECRET` | `<random-64-char-hex-string>` | Signs administrator session tokens |
| `ADMIN_EMAIL` | `admin@hospital.org` | *(Optional)* Env-managed admin login email |
| `ADMIN_PASSCODE` | `<strong-admin-passcode>` | *(Optional)* Overrides DB-stored admin login |

> **Security Note**: Never commit `.env` files, SQL passwords, or `SESSION_SECRET` values into Git. If `ADMIN_PASSCODE` is omitted, the app will prompt you once on first visit to create an administrator account whose password is hashed with `scrypt` and stored in `dbo.Users`.

---

## Step 5: Build & Deploy the Application

### Option A: Build & Deploy via ZIP Deploy (Azure CLI)
```bash
# Install dependencies and build production frontend
npm ci
npm run build

# Create deployment archive (excluding .env and node_modules if Oryx builds remotely, or deploy full bundle)
zip -r deploy.zip package.json package-lock.json server.ts src database dist

# Configure startup command
az webapp config set \
  --resource-group rg-hospital-mgmt \
  --name hospital-mgmt-app \
  --startup-file "npm start"

# Deploy ZIP package
az webapp deploy \
  --resource-group rg-hospital-mgmt \
  --name hospital-mgmt-app \
  --src-path deploy.zip \
  --type zip
```

### Option B: GitHub Actions CI/CD
In Azure Portal -> **Deployment Center**, connect your GitHub repository. Ensure the workflow runs:
1. `npm ci`
2. `npm run build`
3. Deploy artifact to Azure Web App with startup command `npm start` (`node server.ts`).

---

## Step 6: Verify Production Deployment

1. Check the health probe endpoint:
   `GET https://<your-app-name>.azurewebsites.net/api/health`
   Expected response:
   ```json
   {
     "status": "ok",
     "storageMode": "azure_sql",
     "persistent": true
   }
   ```
2. Open `https://<your-app-name>.azurewebsites.net/` in a browser.
3. Verify the login screen displays **Active Environment: Microsoft Azure SQL Database**.
4. Create/sign in with your administrator account and test registering a patient, adding a doctor, and booking an appointment.
5. Refresh or restart the App Service and confirm records remain persisted in Azure SQL Database.
