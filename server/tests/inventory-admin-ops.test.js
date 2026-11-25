import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Booking } from '../src/models/Booking.js';
import { Hostel } from '../src/models/Hostel.js';
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

test('administrator manages hostels, rooms, beds, users, roles, audit logs, and reports', async () => {
  const adminAgent = buildTestAgent();
  const studentAgent = buildTestAgent();
  await loginAgent(adminAgent, 'admin.hostel');
  await loginAgent(studentAgent, 'aarav.student');

  // Student denied inventory mutations, user management, and audit logs
  await studentAgent
    .post('/api/v1/hostels')
    .send({ hostelName: 'Illegal', address: 'Campus', hostelType: 'Co-Ed' })
    .expect(403);
  await studentAgent.get('/api/v1/users').expect(403);
  await studentAgent.get('/api/v1/audit-logs').expect(403);
  await studentAgent.get('/api/v1/reports').expect(403);

  // Admin creates Hostel -> Room -> Bed
  const hRes = await adminAgent.post('/api/v1/hostels').send({
    hostelId: 'HST-99',
    hostelName: 'Pavilion West',
    address: 'Sector 9, Campus',
    hostelType: 'Co-Ed',
  });
  assert.equal(hRes.status, 201);
  const hostelId = hRes.body.hostel._id;

  const rRes = await adminAgent.post(`/api/v1/hostels/${hostelId}/rooms`).send({
    roomNumber: '401',
    capacity: 1,
  });
  assert.equal(rRes.status, 201);
  const roomId = rRes.body.room._id;

  const bRes = await adminAgent.post(`/api/v1/rooms/${roomId}/beds`).send({ bedNumber: 'B1' });
  assert.equal(bRes.status, 201);

  // Adding a second bed exceeds capacity=1 -> 409
  await adminAgent.post(`/api/v1/rooms/${roomId}/beds`).send({ bedNumber: 'B2' }).expect(409);

  // Admin creates new staff user and updates role
  const newUserRes = await adminAgent.post('/api/v1/users').send({
    username: 'warden.west',
    password: 'StaffPassword#2026',
    role: 'Warden',
    fullName: 'Arjun Kapoor',
    email: 'arjun.kapoor@demo-hostel.edu',
    assignedHostelId: hostelId,
  });
  assert.equal(newUserRes.status, 201);
  assert.equal(newUserRes.body.user.role, 'Warden');

  // Admin cannot deactivate last/self admin
  const me = await adminAgent.get('/api/v1/auth/me');
  await adminAgent
    .patch(`/api/v1/users/${me.body.user._id}`)
    .send({ accountStatus: 'Suspended' })
    .expect(400);

  // Audit logs capture all these mutations
  const logsRes = await adminAgent.get('/api/v1/audit-logs?action=HOSTEL_CREATED');
  assert.equal(logsRes.status, 200);
  assert.ok(logsRes.body.items.length >= 1);

  // Generate Occupancy Report
  const repRes = await adminAgent.post('/api/v1/reports').send({
    reportType: 'Occupancy',
    reportPeriod: 'Q4 2026',
  });
  assert.equal(repRes.status, 201);
  assert.ok(repRes.body.report.summaryMetrics.totalBeds > 0);
});

test('complaints, visitors, payments, management reports, and historical record search workflows', async () => {
  const studentAgent = buildTestAgent();
  const wardenAgent = buildTestAgent();
  const accountsAgent = buildTestAgent();
  const mgmtAgent = buildTestAgent();

  await loginAgent(studentAgent, 'aarav.student');
  await loginAgent(wardenAgent, 'warden.north');
  await loginAgent(accountsAgent, 'accounts.desk');
  await loginAgent(mgmtAgent, 'management.exec');

  const h1 = await Hostel.findOne({ hostelId: 'HST-01' });
  const aaravBooking = await Booking.findOne({ bookingStatus: 'Approved', hostel: h1._id });

  // Complaint submit & warden resolve
  const cmpRes = await studentAgent.post('/api/v1/complaints').send({
    hostelId: String(h1._id),
    bookingId: String(aaravBooking._id),
    category: 'Maintenance',
    description: 'Window latch requires replacement in room 101',
  });
  assert.equal(cmpRes.status, 201);

  // Resolving without resolutionDetails returns 400
  await wardenAgent
    .patch(`/api/v1/complaints/${cmpRes.body.complaint._id}`)
    .send({ complaintStatus: 'Resolved' })
    .expect(400);

  const cmpResolved = await wardenAgent
    .patch(`/api/v1/complaints/${cmpRes.body.complaint._id}`)
    .send({
      complaintStatus: 'Resolved',
      resolutionDetails: 'Latch replaced by carpentry maintenance',
    });
  assert.equal(cmpResolved.status, 200);
  assert.equal(cmpResolved.body.complaint.complaintStatus, 'Resolved');

  // Visitor register & warden check-in / check-out
  const visRes = await studentAgent.post('/api/v1/visitors').send({
    visitorName: 'Ramesh Kulkarni',
    contactNumber: '+91-9876543210',
    identificationDetails: 'GOV-ID-9921',
    hostelId: String(h1._id),
    visitDate: new Date().toISOString(),
    purpose: 'Parent visit',
  });
  assert.equal(visRes.status, 201);

  const visIn = await wardenAgent
    .patch(`/api/v1/visitors/${visRes.body.visitorRecord._id}`)
    .send({ visitStatus: 'CheckedIn' });
  assert.equal(visIn.status, 200);
  assert.equal(visIn.body.visitorRecord.visitStatus, 'CheckedIn');

  const visOut = await wardenAgent
    .patch(`/api/v1/visitors/${visRes.body.visitorRecord._id}`)
    .send({ visitStatus: 'CheckedOut' });
  assert.equal(visOut.status, 200);
  assert.equal(visOut.body.visitorRecord.visitStatus, 'CheckedOut');

  // Payment creation & status update by AccountsPersonnel
  await studentAgent
    .post('/api/v1/payments')
    .send({
      bookingId: String(aaravBooking._id),
      amountMinor: 50000,
      paymentReference: 'ILLEGAL-PAY-1',
    })
    .expect(403);

  const payRes = await accountsAgent.post('/api/v1/payments').send({
    bookingId: String(aaravBooking._id),
    amountMinor: 150000,
    paymentReference: 'TXN-TEST-9001',
    paymentStatus: 'Pending',
    notes: 'Security deposit top-up',
  });
  assert.equal(payRes.status, 201);

  const payUpdate = await accountsAgent
    .patch(`/api/v1/payments/${payRes.body.payment._id}`)
    .send({ paymentStatus: 'Paid' });
  assert.equal(payUpdate.status, 200);
  assert.equal(payUpdate.body.payment.paymentStatus, 'Paid');

  // HostelManagement views audit logs, generates reports, and searches historical records
  await mgmtAgent.get('/api/v1/audit-logs').expect(200);
  await mgmtAgent
    .post('/api/v1/reports')
    .send({ reportType: 'Payments', reportPeriod: 'Nov 2026' })
    .expect(201);
  const histRes = await mgmtAgent.get('/api/v1/history?category=All');
  assert.equal(histRes.status, 200);
  assert.ok(histRes.body.items.length > 0);
});
