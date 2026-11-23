import crypto from 'node:crypto';
import type { StorageMode } from './types.ts';

export interface AzureSqlConfig {
  server: string;
  database: string;
  user: string;
  password: string;
  port: number;
  encrypt: boolean;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  storageMode: StorageMode;
  azureSql: AzureSqlConfig | null;
  sessionSecret: string;
  adminEmail: string;
  adminPasscode: string;
}

let fallbackSessionSecret: string | null = null;

function getSessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) {
    return configured;
  }
  if (!fallbackSessionSecret) {
    fallbackSessionSecret = crypto.randomBytes(32).toString('hex');
  }
  return fallbackSessionSecret;
}

export function loadConfig(): AppConfig {
  const port = Number(process.env.PORT) || 3000;
  const nodeEnv = process.env.NODE_ENV?.trim() || 'development';

  const sqlServer = process.env.AZURE_SQL_SERVER?.trim() || '';
  const sqlDatabase = process.env.AZURE_SQL_DATABASE?.trim() || '';
  const sqlUser = process.env.AZURE_SQL_USER?.trim() || '';
  const sqlPassword = process.env.AZURE_SQL_PASSWORD?.trim() || '';
  const sqlPort = Number(process.env.AZURE_SQL_PORT) || 1433;
  const sqlEncrypt = process.env.AZURE_SQL_ENCRYPT?.trim().toLowerCase() !== 'false';

  const hasAzureSqlCredentials = Boolean(
    sqlServer &&
      sqlDatabase &&
      sqlUser &&
      sqlPassword &&
      !sqlServer.includes('your-server-name')
  );

  const requestedMode = process.env.STORAGE_MODE?.trim().toLowerCase();
  let storageMode: StorageMode = 'demo';

  if (requestedMode === 'azure_sql') {
    if (!hasAzureSqlCredentials) {
      throw new Error(
        'STORAGE_MODE is set to "azure_sql", but required AZURE_SQL_SERVER, AZURE_SQL_DATABASE, AZURE_SQL_USER, or AZURE_SQL_PASSWORD environment variables are missing.'
      );
    }
    storageMode = 'azure_sql';
  } else if (requestedMode !== 'demo' && hasAzureSqlCredentials) {
    storageMode = 'azure_sql';
  }

  return {
    port,
    nodeEnv,
    storageMode,
    azureSql: hasAzureSqlCredentials
      ? {
          server: sqlServer,
          database: sqlDatabase,
          user: sqlUser,
          password: sqlPassword,
          port: sqlPort,
          encrypt: sqlEncrypt,
        }
      : null,
    sessionSecret: getSessionSecret(),
    adminEmail: (process.env.ADMIN_EMAIL?.trim() || 'admin@hospital.local').toLowerCase(),
    adminPasscode: process.env.ADMIN_PASSCODE?.trim() || '',
  };
}
