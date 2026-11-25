import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: rootEnvPath });
dotenv.config();

const DEFAULT_DEV_SECRET = process.env.NODE_ENV === 'test' ? 'test-only-jwt-secret-change-me-32chars' : undefined;

export function getEnv() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const jwtSecret = process.env.JWT_SECRET || DEFAULT_DEV_SECRET;

  if (!jwtSecret || jwtSecret.length < 16) {
    throw new Error('JWT_SECRET must be set in environment and be at least 16 characters.');
  }

  const mongodbUri = process.env.MONGODB_URI;
  if (!mongodbUri && nodeEnv !== 'test') {
    throw new Error('MONGODB_URI must be configured in environment (.env).');
  }

  return {
    nodeEnv,
    port: Number(process.env.PORT || 5000),
    mongodbUri: mongodbUri || '',
    mongodbDbName: process.env.MONGODB_DB_NAME || 'hostel_booking',
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
    cookieName: process.env.COOKIE_NAME || 'hostel_session',
    clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    seedDemoPassword: process.env.SEED_DEMO_PASSWORD || 'HostelDemo#2026',
  };
}
