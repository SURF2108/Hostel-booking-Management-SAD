import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Bed } from '../src/models/Bed.js';
import { Allocation } from '../src/models/Allocation.js';
import { Booking } from '../src/models/Booking.js';
import {
  buildTestAgent,
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

async function registerStudent(agent, suffix) {
  const res = await agent.post('/api/v1/auth/register').send({
    username: `test.student.${suffix}`,
    password: 'StudentPassword#2026',
    fullName: `Test Student ${suffix}`,
    email: `student.${suffix}@demo-hostel.edu`,
    contactNumber: '+91-9800001122',
  });
  assert.equal(res.status, 201);
  return res.body.user;
}

test('full booking lifecycle: search -> submit -> approve & allocate -> check-in -> check-out', async () => {
  const studentAgent = buildTestAgent();
  const wardenAgent = buildTestAgent();
  await registerStudent(studentAgent, 'lifecycle');
  await loginAgent(wardenAgent, 'warden.north');

  const northHostels = await studentAgent.get('/api/v1/hostels?search=North');
  assert.equal(northHostels.status, 200);
  const h1 = northHostels.body.hostels[0];
  const detail = await studentAgent.get(`/api/v1/hostels/${h1._id}`);
  const openBed = detail.body.hostel.rooms
    .flatMap((r) => r.beds)
    .find((b) => b.bedStatus === 'Available' && b.maintenanceStatus === 'Operational');
  assert.ok(openBed);

  const startDate = new Date(Date.now() + 2 * 86400000).toISOString();
  const endDate = new Date(Date.now() + 30 * 86400000).toISOString();

  // Submit booking
  const createRes = await studentAgent.post('/api/v1/bookings').send({
    bedId: String(openBed._id),
    startDate,
    endDate,
    notes: 'Lifecycle E2E check',
  });
  assert.equal(createRes.status, 201);
  const bookingId = createRes.body.booking._id;
  assert.equal(createRes.body.booking.bookingStatus, 'Pending');

  // Approve & allocate
  const approveRes = await wardenAgent
    .post(`/api/v1/bookings/${bookingId}/approve`)
    .send({ decisionNote: 'Approved for room allocation' });
  assert.equal(approveRes.status, 200);
  const allocationId = approveRes.body.allocation._id;
  assert.equal(approveRes.body.allocation.allocationStatus, 'Active');

  const bedAfterApprove = await Bed.findById(openBed._id);
  assert.equal(bedAfterApprove.bedStatus, 'Reserved');

  // Cannot check out before check in
  await wardenAgent.post(`/api/v1/allocations/${allocationId}/check-out`).expect(409);

  // Check in
  const checkInRes = await wardenAgent.post(`/api/v1/allocations/${allocationId}/check-in`);
  assert.equal(checkInRes.status, 200);
  assert.equal(checkInRes.body.allocation.allocationStatus, 'CheckedIn');
  assert.equal((await Bed.findById(openBed._id)).bedStatus, 'Occupied');

  // Student cannot cancel after check-in
  await studentAgent.post(`/api/v1/bookings/${bookingId}/cancel`).send({}).expect(409);

  // Check out
  const checkOutRes = await wardenAgent.post(`/api/v1/allocations/${allocationId}/check-out`);
  assert.equal(checkOutRes.status, 200);
  assert.equal(checkOutRes.body.allocation.allocationStatus, 'CheckedOut');
  assert.equal((await Bed.findById(openBed._id)).bedStatus, 'Available');
  assert.equal((await Booking.findById(bookingId)).bookingStatus, 'Completed');
});

test('cancellation releases allocated bed, rejection updates status, and overlapping student bookings are rejected', async () => {
  const studentAgent = buildTestAgent();
  const meeraAgent = buildTestAgent();
  const wardenAgent = buildTestAgent();
  await registerStudent(studentAgent, 'cancel');
  await loginAgent(meeraAgent, 'meera.student');
  await loginAgent(wardenAgent, 'warden.south');

  const southRes = await studentAgent.get('/api/v1/hostels?search=South');
  const h2 = southRes.body.hostels[0];
  const detail = await studentAgent.get(`/api/v1/hostels/${h2._id}`);
  const bed = detail.body.hostel.rooms
    .flatMap((r) => r.beds)
    .find((b) => b.bedStatus === 'Available');

  const startDate = new Date(Date.now() + 10 * 86400000).toISOString();
  const endDate = new Date(Date.now() + 40 * 86400000).toISOString();

  // Meera already has an approved booking covering +3..+140 days -> overlapping submit returns 409
  await meeraAgent
    .post('/api/v1/bookings')
    .send({ bedId: String(bed._id), startDate, endDate })
    .expect(409);

  const b1 = await studentAgent.post('/api/v1/bookings').send({ bedId: String(bed._id), startDate, endDate });
  assert.equal(b1.status, 201);
  await wardenAgent.post(`/api/v1/bookings/${b1.body.booking._id}/approve`).send({});
  assert.equal((await Bed.findById(bed._id)).bedStatus, 'Reserved');

  // Student cancels approved booking before check-in -> bed becomes Available again
  const cancelRes = await studentAgent
    .post(`/api/v1/bookings/${b1.body.booking._id}/cancel`)
    .send({ reason: 'Schedule changed' });
  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.body.booking.bookingStatus, 'Cancelled');
  assert.equal(cancelRes.body.booking.allocation.allocationStatus, 'Released');
  assert.equal((await Bed.findById(bed._id)).bedStatus, 'Available');

  // Re-submit & reject
  const b2 = await studentAgent.post('/api/v1/bookings').send({ bedId: String(bed._id), startDate, endDate });
  assert.equal(b2.status, 201);
  const rejectRes = await wardenAgent
    .post(`/api/v1/bookings/${b2.body.booking._id}/reject`)
    .send({ decisionNote: 'Room reserved for maintenance' });
  assert.equal(rejectRes.status, 200);
  assert.equal(rejectRes.body.booking.bookingStatus, 'Rejected');

  // Cannot approve rejected booking
  await wardenAgent.post(`/api/v1/bookings/${b2.body.booking._id}/approve`).send({}).expect(409);
});

test('concurrency guard prevents parallel duplicate student submissions and parallel conflicting bed approvals', async () => {
  const s1Agent = buildTestAgent();
  const s2Agent = buildTestAgent();
  const wardenAgent = buildTestAgent();
  await registerStudent(s1Agent, 'race1');
  await registerStudent(s2Agent, 'race2');
  await loginAgent(wardenAgent, 'warden.north');

  const northRes = await s1Agent.get('/api/v1/hostels?search=North');
  const h1 = northRes.body.hostels[0];
  const detail = await s1Agent.get(`/api/v1/hostels/${h1._id}`);
  const bed = detail.body.hostel.rooms
    .flatMap((r) => r.beds)
    .find((b) => b.bedStatus === 'Available');

  const startDate = new Date(Date.now() + 20 * 86400000).toISOString();
  const endDate = new Date(Date.now() + 60 * 86400000).toISOString();

  // 1) Parallel double-submit by same student: only 1 succeeds
  const parallelSubmits = await Promise.all([
    s1Agent.post('/api/v1/bookings').send({ bedId: String(bed._id), startDate, endDate }),
    s1Agent.post('/api/v1/bookings').send({ bedId: String(bed._id), startDate, endDate }),
    s1Agent.post('/api/v1/bookings').send({ bedId: String(bed._id), startDate, endDate }),
    s1Agent.post('/api/v1/bookings').send({ bedId: String(bed._id), startDate, endDate }),
  ]);
  const submitSuccess = parallelSubmits.filter((r) => r.status === 201);
  const submitConflict = parallelSubmits.filter((r) => r.status === 409);
  assert.equal(submitSuccess.length, 1);
  assert.equal(submitConflict.length, 3);

  // 2) Second student submits competing pending request for overlapping dates on same bed
  const compRes = await s2Agent
    .post('/api/v1/bookings')
    .send({ bedId: String(bed._id), startDate, endDate });
  assert.equal(compRes.status, 201);

  // 3) Warden approves BOTH concurrently -> strictly ONE allocation succeeds, ONE fails with 409 Conflict
  const [app1, app2] = await Promise.all([
    wardenAgent.post(`/api/v1/bookings/${submitSuccess[0].body.booking._id}/approve`).send({}),
    wardenAgent.post(`/api/v1/bookings/${compRes.body.booking._id}/approve`).send({}),
  ]);
  const statuses = [app1.status, app2.status].sort();
  assert.deepEqual(statuses, [200, 409]);

  const activeCount = await Allocation.countDocuments({
    bed: bed._id,
    allocationStatus: { $in: ['Active', 'CheckedIn'] },
  });
  assert.equal(activeCount, 1);

  // 4) Non-overlapping future dates on the same bed CAN still be submitted and approved
  const futureStart = new Date(Date.now() + 90 * 86400000).toISOString();
  const futureEnd = new Date(Date.now() + 120 * 86400000).toISOString();
  const futureRes = await s2Agent
    .post('/api/v1/bookings')
    .send({ bedId: String(bed._id), startDate: futureStart, endDate: futureEnd });
  assert.equal(futureRes.status, 201);
  await wardenAgent
    .post(`/api/v1/bookings/${futureRes.body.booking._id}/approve`)
    .send({})
    .expect(200);
});

test('cross-user and cross-hostel warden authorization denial', async () => {
  const s1Agent = buildTestAgent();
  const s2Agent = buildTestAgent();
  const wSouthAgent = buildTestAgent();
  await loginAgent(s1Agent, 'aarav.student');
  await loginAgent(s2Agent, 'meera.student');
  await loginAgent(wSouthAgent, 'warden.south');

  const myBookings = await s1Agent.get('/api/v1/bookings');
  const aaravBooking = myBookings.body.items[0];
  assert.ok(aaravBooking);

  // Student 2 cannot read or cancel Student 1's booking
  await s2Agent.get(`/api/v1/bookings/${aaravBooking._id}`).expect(403);
  await s2Agent.post(`/api/v1/bookings/${aaravBooking._id}/cancel`).send({}).expect(403);

  // South Warden cannot approve North Hostel's pending booking
  const northPending = await Booking.findOne({ bookingStatus: 'Pending' }).populate('hostel');
  if (northPending && northPending.hostel.hostelId === 'HST-01') {
    await wSouthAgent.post(`/api/v1/bookings/${northPending._id}/approve`).send({}).expect(403);
  }
});
