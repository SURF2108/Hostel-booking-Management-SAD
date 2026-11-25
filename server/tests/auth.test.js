import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { User } from '../src/models/User.js';
import { createApp } from '../src/app.js';
import {
  buildTestAgent,
  DEMO_PASSWORD,
  loginAgent,
  resetAndSeedTestDb,
  startIsolatedTestDb,
  stopIsolatedTestDb,
} from './testHelper.js';

let replSet;

before(async () => {
  replSet = await startIsolatedTestDb();
});

after(async () => {
  await stopIsolatedTestDb(replSet);
});

beforeEach(async () => {
  await resetAndSeedTestDb();
});

test('health and readiness probes reflect live database state', async () => {
  const agent = buildTestAgent();
  const health = await agent.get('/api/v1/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.status, 'ok');

  const ready = await agent.get('/api/v1/ready');
  assert.equal(ready.status, 200);
  assert.equal(ready.body.status, 'ready');
  assert.equal(ready.body.database, 'connected');
  assert.equal(ready.body.transactionsSupported, true);
});

test('auth login, passwordHash omission, wrong password, suspended account, and logout', async () => {
  const agent = buildTestAgent();

  const badLogin = await agent
    .post('/api/v1/auth/login')
    .send({ identifier: 'aarav.student', password: 'WrongPassword123' });
  assert.equal(badLogin.status, 401);
  assert.equal(badLogin.body.code, 'INVALID_CREDENTIALS');

  const user = await loginAgent(agent, 'aarav.student');
  assert.equal(user.role, 'Student');
  assert.equal(user.passwordHash, undefined);

  const meRes = await agent.get('/api/v1/auth/me');
  assert.equal(meRes.status, 200);
  assert.equal(meRes.body.user.username, 'aarav.student');
  assert.equal(meRes.body.user.passwordHash, undefined);

  await agent.post('/api/v1/auth/logout').expect(200);
  await agent.get('/api/v1/auth/me').expect(401);

  await User.updateOne({ username: 'rohan.student' }, { $set: { accountStatus: 'Suspended' } });
  const suspendedRes = await agent
    .post('/api/v1/auth/login')
    .send({ identifier: 'rohan.student', password: DEMO_PASSWORD });
  assert.equal(suspendedRes.status, 403);
  assert.equal(suspendedRes.body.code, 'ACCOUNT_INACTIVE');
});

test('public registration strictly creates Student role and allows profile management', async () => {
  const agent = buildTestAgent();

  const regRes = await agent.post('/api/v1/auth/register').send({
    username: 'nina.student',
    password: 'StrongPassword#99',
    fullName: 'Nina Rao',
    email: 'nina.rao@demo-hostel.edu',
    contactNumber: '+91-9800100999',
    role: 'Administrator', // ignored/never escalated
  });
  assert.equal(regRes.status, 201);
  assert.equal(regRes.body.user.role, 'Student');
  assert.match(regRes.body.user.studentId, /^STU-/);

  const profRes = await agent.patch('/api/v1/auth/profile').send({
    fullName: 'Nina S. Rao',
    contactNumber: '+91-9800100888',
  });
  assert.equal(profRes.status, 200);
  assert.equal(profRes.body.user.fullName, 'Nina S. Rao');

  const badPassChange = await agent.patch('/api/v1/auth/profile').send({
    currentPassword: 'WrongCurrentPassword',
    newPassword: 'UpdatedPassword#99',
  });
  assert.equal(badPassChange.status, 400);

  await agent
    .patch('/api/v1/auth/profile')
    .send({
      currentPassword: 'StrongPassword#99',
      newPassword: 'UpdatedPassword#99',
    })
    .expect(200);
});

test('CSRF origin guard blocks disallowed mutation origin and rate limit enforces max attempts', async () => {
  const app = createApp({ loginRateLimitMax: 2 });
  const csrfBlocked = await request(app)
    .post('/api/v1/auth/login')
    .set('Origin', 'https://evil-site.example')
    .send({ identifier: 'aarav.student', password: DEMO_PASSWORD });
  assert.equal(csrfBlocked.status, 403);
  assert.equal(csrfBlocked.body.code, 'CSRF_ORIGIN_DENIED');

  await request(app)
    .post('/api/v1/auth/login')
    .send({ identifier: 'aarav.student', password: 'bad' })
    .expect(401);
  await request(app)
    .post('/api/v1/auth/login')
    .send({ identifier: 'aarav.student', password: 'bad' })
    .expect(401);
  const limited = await request(app)
    .post('/api/v1/auth/login')
    .send({ identifier: 'aarav.student', password: 'bad' });
  assert.equal(limited.status, 429);
});
