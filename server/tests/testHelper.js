import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { dbConnection } from '../src/config/db.js';
import { createApp } from '../src/app.js';
import { seedDemoDatabase } from '../src/seed/seedData.js';

export const DEMO_PASSWORD = 'TestDemoPassword#2026';

export async function startIsolatedTestDb() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'isolated-test-suite-jwt-secret-key-2026';
  process.env.SEED_DEMO_PASSWORD = DEMO_PASSWORD;

  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    binary: { version: '8.2.6' },
  });
  const uri = replSet.getUri('hostel_booking_test');

  if (!uri.includes('127.0.0.1') && !uri.includes('localhost')) {
    throw new Error(`Safety guard: refusing non-local test DB URI ${uri}`);
  }

  await dbConnection.connect(uri, 'hostel_booking_test');
  return replSet;
}

export async function stopIsolatedTestDb(replSet) {
  await dbConnection.close();
  if (replSet) {
    await replSet.stop();
  }
}

export async function resetAndSeedTestDb() {
  if (mongoose.connection.name !== 'hostel_booking_test') {
    throw new Error(`Safety guard: refusing reset on non-test DB ${mongoose.connection.name}`);
  }
  return seedDemoDatabase({ demoPassword: DEMO_PASSWORD, reset: true });
}

export function buildTestAgent(appOptions = {}) {
  const app = createApp(appOptions);
  return request.agent(app);
}

export async function loginAgent(agent, identifier, password = DEMO_PASSWORD) {
  const res = await agent.post('/api/v1/auth/login').send({ identifier, password });
  if (res.status !== 200) {
    throw new Error(`Failed test login for ${identifier}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.user;
}
