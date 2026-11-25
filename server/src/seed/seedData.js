import bcrypt from 'bcryptjs';
import { Counter, nextSequence } from '../models/Counter.js';
import { User } from '../models/User.js';
import { Hostel } from '../models/Hostel.js';
import { Room } from '../models/Room.js';
import { Bed } from '../models/Bed.js';
import { Booking } from '../models/Booking.js';
import { Allocation } from '../models/Allocation.js';
import { PaymentRecord } from '../models/PaymentRecord.js';
import { Complaint } from '../models/Complaint.js';
import { Visitor } from '../models/Visitor.js';
import { VisitorRecord } from '../models/VisitorRecord.js';
import { AuditLog } from '../models/AuditLog.js';
import { Report } from '../models/Report.js';
import { reportService } from '../services/ReportService.js';

function addDays(base, days) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export async function seedDemoDatabase({ demoPassword, reset = false } = {}) {
  const password = demoPassword || process.env.SEED_DEMO_PASSWORD || 'HostelDemo#2026';

  if (reset) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Refusing --reset seed when NODE_ENV=production.');
    }
    await Promise.all([
      Report.deleteMany({}),
      AuditLog.deleteMany({}),
      VisitorRecord.deleteMany({}),
      Visitor.deleteMany({}),
      Complaint.deleteMany({}),
      PaymentRecord.deleteMany({}),
      Allocation.deleteMany({}),
      Booking.deleteMany({}),
      Bed.deleteMany({}),
      Room.deleteMany({}),
      Hostel.deleteMany({}),
      User.deleteMany({}),
      Counter.deleteMany({}),
    ]);
  }

  // Idempotent guard: if demo hostels and users already exist, preserve all records untouched.
  const existingHostels = await Hostel.countDocuments({});
  const existingUsers = await User.countDocuments({});
  if (existingHostels > 0 && existingUsers > 0 && !reset) {
    return {
      skipped: true,
      message: 'Database already populated; preserving existing user and demo data.',
    };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // 1. Seed Hostels
  const hostelsData = [
    {
      hostelId: 'HST-01',
      hostelName: 'North Crest Hall',
      address: 'Sector 2, Academic Campus West',
      hostelType: 'Boys',
      isActive: true,
    },
    {
      hostelId: 'HST-02',
      hostelName: 'South Pavilion',
      address: 'Sector 4, Academic Campus East',
      hostelType: 'Girls',
      isActive: true,
    },
    {
      hostelId: 'HST-03',
      hostelName: 'Bauhaus Residency',
      address: 'Block C, Graduate Commons',
      hostelType: 'Co-Ed',
      isActive: true,
    },
  ];
  await nextSequence('hostel');
  await nextSequence('hostel');
  await nextSequence('hostel');
  const hostels = await Hostel.insertMany(hostelsData);
  const [h1, h2, h3] = hostels;

  // 2. Seed Users across all 5 SAD roles
  const usersSpec = [
    {
      username: 'aarav.student',
      role: 'Student',
      fullName: 'Aarav Kulkarni',
      email: 'aarav.kulkarni@demo-hostel.edu',
      contactNumber: '+91-9800100101',
      studentId: 'STU-0001',
    },
    {
      username: 'meera.student',
      role: 'Student',
      fullName: 'Meera Deshmukh',
      email: 'meera.deshmukh@demo-hostel.edu',
      contactNumber: '+91-9800100102',
      studentId: 'STU-0002',
    },
    {
      username: 'rohan.student',
      role: 'Student',
      fullName: 'Rohan Iyer',
      email: 'rohan.iyer@demo-hostel.edu',
      contactNumber: '+91-9800100103',
      studentId: 'STU-0003',
    },
    {
      username: 'warden.north',
      role: 'Warden',
      fullName: 'Devika Nair',
      email: 'devika.nair@demo-hostel.edu',
      contactNumber: '+91-9800100201',
      wardenId: 'WRD-0004',
      assignedHostelId: h1._id,
    },
    {
      username: 'warden.south',
      role: 'Warden',
      fullName: 'Vikram Joshi',
      email: 'vikram.joshi@demo-hostel.edu',
      contactNumber: '+91-9800100202',
      wardenId: 'WRD-0005',
      assignedHostelId: h2._id,
    },
    {
      username: 'admin.hostel',
      role: 'Administrator',
      fullName: 'Kavita Menon',
      email: 'kavita.menon@demo-hostel.edu',
      contactNumber: '+91-9800100301',
      adminId: 'ADM-0006',
    },
    {
      username: 'accounts.desk',
      role: 'AccountsPersonnel',
      fullName: 'Rajesh Verma',
      email: 'rajesh.verma@demo-hostel.edu',
      contactNumber: '+91-9800100401',
      employeeId: 'ACC-0007',
    },
    {
      username: 'management.exec',
      role: 'HostelManagement',
      fullName: 'Priya Subramanian',
      email: 'priya.subramanian@demo-hostel.edu',
      contactNumber: '+91-9800100501',
    },
  ];

  const users = [];
  for (const spec of usersSpec) {
    const userId = await nextSequence('user');
    users.push(
      await User.create({
        ...spec,
        userId,
        passwordHash,
        accountStatus: 'Active',
      })
    );
  }
  const [s1, s2, s3, wNorth, wSouth, adminUser, accountsUser, mgmtUser] = users;

  // 3. Seed Rooms and Beds
  const roomSpecs = [
    { hostel: h1, roomNumber: '101', capacity: 3, beds: ['B1', 'B2', 'B3'] },
    { hostel: h1, roomNumber: '102', capacity: 3, beds: ['B1', 'B2', 'B3'] },
    { hostel: h1, roomNumber: '201', capacity: 2, beds: ['B1', 'B2'], maintBed: 'B2' },
    { hostel: h2, roomNumber: '101', capacity: 3, beds: ['B1', 'B2', 'B3'] },
    { hostel: h2, roomNumber: '102', capacity: 3, beds: ['B1', 'B2', 'B3'] },
    { hostel: h3, roomNumber: '301', capacity: 2, beds: ['B1', 'B2'] },
    { hostel: h3, roomNumber: '302', capacity: 2, beds: ['B1', 'B2'] },
  ];

  const bedsByKey = new Map();
  for (const rs of roomSpecs) {
    const room = await Room.create({
      roomId: `RM-${rs.hostel.hostelId}-${rs.roomNumber}`,
      hostel: rs.hostel._id,
      roomNumber: rs.roomNumber,
      capacity: rs.capacity,
      roomStatus: 'Available',
    });
    for (const bn of rs.beds) {
      const bedId = await nextSequence('bed');
      const isMaint = rs.maintBed === bn;
      const bed = await Bed.create({
        bedId,
        room: room._id,
        hostel: rs.hostel._id,
        bedNumber: bn,
        bedStatus: isMaint ? 'Maintenance' : 'Available',
        maintenanceStatus: isMaint ? 'UnderMaintenance' : 'Operational',
      });
      bedsByKey.set(`${rs.hostel.hostelId}-${rs.roomNumber}-${bn}`, { bed, room, hostel: rs.hostel });
    }
  }

  const now = new Date();
  const makeBkgId = async () => {
    const seq = await nextSequence('booking');
    return `BKG-2026-${String(seq).padStart(4, '0')}`;
  };
  const makeAlcId = async () => {
    const seq = await nextSequence('allocation');
    return `ALC-2026-${String(seq).padStart(4, '0')}`;
  };

  // BKG 1: Approved + CheckedIn (Aarav in HST-01 101 B1)
  const target1 = bedsByKey.get('HST-01-101-B1');
  const bkg1 = await Booking.create({
    bookingId: await makeBkgId(),
    student: s1._id,
    bed: target1.bed._id,
    room: target1.room._id,
    hostel: target1.hostel._id,
    requestDate: addDays(now, -20),
    startDate: addDays(now, -15),
    endDate: addDays(now, 120),
    bookingStatus: 'Approved',
    notes: 'Semester fall-spring occupancy near engineering wing',
    reviewedByWarden: wNorth._id,
    reviewedAt: addDays(now, -18),
    decisionNote: 'Approved for North Crest Hall',
  });
  await Allocation.create({
    allocationId: await makeAlcId(),
    booking: bkg1._id,
    bed: target1.bed._id,
    room: target1.room._id,
    hostel: target1.hostel._id,
    student: s1._id,
    allocatedByWarden: wNorth._id,
    allocationDate: addDays(now, -18),
    startDate: bkg1.startDate,
    endDate: bkg1.endDate,
    allocationStatus: 'CheckedIn',
    checkInTime: addDays(now, -15),
  });
  await Bed.updateOne({ _id: target1.bed._id }, { $set: { bedStatus: 'Occupied' } });

  // BKG 2: Approved + Active awaiting check-in (Meera in HST-02 101 B1)
  const target2 = bedsByKey.get('HST-02-101-B1');
  const bkg2 = await Booking.create({
    bookingId: await makeBkgId(),
    student: s2._id,
    bed: target2.bed._id,
    room: target2.room._id,
    hostel: target2.hostel._id,
    requestDate: addDays(now, -5),
    startDate: addDays(now, 3),
    endDate: addDays(now, 140),
    bookingStatus: 'Approved',
    notes: 'Ground floor preference',
    reviewedByWarden: wSouth._id,
    reviewedAt: addDays(now, -3),
    decisionNote: 'Allocated South Pavilion 101-B1',
  });
  await Allocation.create({
    allocationId: await makeAlcId(),
    booking: bkg2._id,
    bed: target2.bed._id,
    room: target2.room._id,
    hostel: target2.hostel._id,
    student: s2._id,
    allocatedByWarden: wSouth._id,
    allocationDate: addDays(now, -3),
    startDate: bkg2.startDate,
    endDate: bkg2.endDate,
    allocationStatus: 'Active',
  });
  await Bed.updateOne({ _id: target2.bed._id }, { $set: { bedStatus: 'Reserved' } });

  // BKG 3: Pending (Rohan in HST-01 102 B1)
  const target3 = bedsByKey.get('HST-01-102-B1');
  await Booking.create({
    bookingId: await makeBkgId(),
    student: s3._id,
    bed: target3.bed._id,
    room: target3.room._id,
    hostel: target3.hostel._id,
    requestDate: addDays(now, -1),
    startDate: addDays(now, 5),
    endDate: addDays(now, 150),
    bookingStatus: 'Pending',
    notes: 'Requesting quiet study room allocation',
  });

  // BKG 4: Pending (Meera in HST-03 301 B1)
  const target4 = bedsByKey.get('HST-03-301-B1');
  await Booking.create({
    bookingId: await makeBkgId(),
    student: s2._id,
    bed: target4.bed._id,
    room: target4.room._id,
    hostel: target4.hostel._id,
    requestDate: addDays(now, -1),
    startDate: addDays(now, 160),
    endDate: addDays(now, 300),
    bookingStatus: 'Pending',
    notes: 'Summer research residency extension',
  });

  // BKG 5: Historical Completed + CheckedOut (Aarav in HST-01 201 B1)
  const target5 = bedsByKey.get('HST-01-201-B1');
  const bkg5 = await Booking.create({
    bookingId: await makeBkgId(),
    student: s1._id,
    bed: target5.bed._id,
    room: target5.room._id,
    hostel: target5.hostel._id,
    requestDate: addDays(now, -180),
    startDate: addDays(now, -170),
    endDate: addDays(now, -30),
    bookingStatus: 'Completed',
    notes: 'Previous academic term stay',
    reviewedByWarden: wNorth._id,
    reviewedAt: addDays(now, -175),
    decisionNote: 'Previous term approved',
  });
  await Allocation.create({
    allocationId: await makeAlcId(),
    booking: bkg5._id,
    bed: target5.bed._id,
    room: target5.room._id,
    hostel: target5.hostel._id,
    student: s1._id,
    allocatedByWarden: wNorth._id,
    allocationDate: addDays(now, -175),
    startDate: bkg5.startDate,
    endDate: bkg5.endDate,
    allocationStatus: 'CheckedOut',
    checkInTime: addDays(now, -170),
    checkOutTime: addDays(now, -30),
  });

  // BKG 6: Rejected historical booking
  const target6 = bedsByKey.get('HST-01-101-B2');
  await Booking.create({
    bookingId: await makeBkgId(),
    student: s3._id,
    bed: target6.bed._id,
    room: target6.room._id,
    hostel: target6.hostel._id,
    requestDate: addDays(now, -10),
    startDate: addDays(now, -5),
    endDate: addDays(now, 30),
    bookingStatus: 'Rejected',
    notes: 'Short-term workshop stay',
    reviewedByWarden: wNorth._id,
    reviewedAt: addDays(now, -8),
    decisionNote: 'Short-term stay redirected to graduate commons',
  });

  // 4. Payment Records
  await PaymentRecord.create([
    {
      paymentId: await nextSequence('payment'),
      booking: bkg1._id,
      student: s1._id,
      recordedBy: accountsUser._id,
      amountMinor: 4200000, // 42,000.00 INR
      currency: 'INR',
      paymentDate: addDays(now, -16),
      paymentReference: 'TXN-DEMO-2026-8801',
      paymentStatus: 'Paid',
      notes: 'Semester hostel fee + mess deposit settled',
    },
    {
      paymentId: await nextSequence('payment'),
      booking: bkg2._id,
      student: s2._id,
      recordedBy: accountsUser._id,
      amountMinor: 3950000, // 39,500.00 INR
      currency: 'INR',
      paymentDate: addDays(now, -2),
      paymentReference: 'TXN-DEMO-2026-8802',
      paymentStatus: 'Pending',
      notes: 'Awaiting bank challan verification',
    },
    {
      paymentId: await nextSequence('payment'),
      booking: bkg5._id,
      student: s1._id,
      recordedBy: accountsUser._id,
      amountMinor: 3800000, // 38,000.00 INR
      currency: 'INR',
      paymentDate: addDays(now, -172),
      paymentReference: 'TXN-DEMO-2025-7104',
      paymentStatus: 'Paid',
      notes: 'Prior term settlement',
    },
  ]);

  // 5. Complaints
  const makeCmpId = async () => `CMP-2026-${String(await nextSequence('complaint')).padStart(4, '0')}`;
  await Complaint.create([
    {
      complaintId: await makeCmpId(),
      student: s1._id,
      hostel: h1._id,
      booking: bkg1._id,
      category: 'Maintenance',
      description: 'Desk lamp ballast in Room 101 flickers intermittently after 21:00.',
      submissionDate: addDays(now, -2),
      complaintStatus: 'Open',
    },
    {
      complaintId: await makeCmpId(),
      student: s2._id,
      hostel: h2._id,
      booking: bkg2._id,
      category: 'Utilities',
      description: 'Solar heater pressure gauge on Wing A second floor needs inspection.',
      submissionDate: addDays(now, -4),
      complaintStatus: 'InProgress',
      resolutionDetails: 'Plumbing technician scheduled for inspection.',
      handledByWarden: wSouth._id,
    },
    {
      complaintId: await makeCmpId(),
      student: s3._id,
      hostel: h1._id,
      category: 'Sanitation',
      description: 'Corridor water cooler tray drainage blocked.',
      submissionDate: addDays(now, -12),
      complaintStatus: 'Resolved',
      resolutionDetails: 'Drain trap cleared and sanitized by housekeeping team.',
      handledByWarden: wNorth._id,
      resolvedAt: addDays(now, -11),
    },
  ]);

  // 6. Visitors and VisitorRecords
  const v1 = await Visitor.create({
    visitorId: await nextSequence('visitor'),
    visitorName: 'Suresh Kulkarni',
    contactNumber: '+91-9811100901',
    identificationDetails: 'GOV-ID-8492',
  });
  const v2 = await Visitor.create({
    visitorId: await nextSequence('visitor'),
    visitorName: 'Ananya Deshmukh',
    contactNumber: '+91-9811100902',
    identificationDetails: 'GOV-ID-5510',
  });
  const v3 = await Visitor.create({
    visitorId: await nextSequence('visitor'),
    visitorName: 'Karthik Iyer',
    contactNumber: '+91-9811100903',
    identificationDetails: 'GOV-ID-3304',
  });

  await VisitorRecord.create([
    {
      visitRecordId: await nextSequence('visitorRecord'),
      visitor: v1._id,
      student: s1._id,
      hostel: h1._id,
      visitDate: addDays(now, 1),
      purpose: 'Parent weekend visit',
      visitStatus: 'Registered',
    },
    {
      visitRecordId: await nextSequence('visitorRecord'),
      visitor: v2._id,
      student: s2._id,
      hostel: h2._id,
      managedByWarden: wSouth._id,
      visitDate: now,
      purpose: 'Delivering medical kit',
      checkInTime: now,
      visitStatus: 'CheckedIn',
    },
    {
      visitRecordId: await nextSequence('visitorRecord'),
      visitor: v3._id,
      student: s3._id,
      hostel: h1._id,
      managedByWarden: wNorth._id,
      visitDate: addDays(now, -7),
      purpose: 'Document pickup',
      checkInTime: addDays(now, -7),
      checkOutTime: addDays(now, -7),
      visitStatus: 'CheckedOut',
    },
  ]);

  // 7. Initial Audit Logs & Generated Reports
  await AuditLog.create([
    {
      logId: await nextSequence('auditLog'),
      action: 'SYSTEM_SEED_INITIALIZED',
      timestamp: addDays(now, -20),
      affectedModel: 'Hostel',
      affectedRecord: 'HST-01,HST-02,HST-03',
      details: { seededBy: adminUser.username },
      recordedBy: adminUser._id,
      actorUsername: adminUser.username,
      actorRole: adminUser.role,
    },
    {
      logId: await nextSequence('auditLog'),
      action: 'BOOKING_APPROVED_AND_ALLOCATED',
      timestamp: addDays(now, -18),
      affectedModel: 'Allocation',
      affectedRecord: 'ALC-2026-0001',
      details: { bookingId: bkg1.bookingId, bedId: target1.bed.bedId },
      recordedBy: wNorth._id,
      actorUsername: wNorth.username,
      actorRole: wNorth.role,
    },
  ]);

  await reportService.generateReport(
    { reportType: 'Occupancy', reportPeriod: 'Current Term 2026' },
    mgmtUser
  );
  await reportService.generateReport(
    { reportType: 'Payments', reportPeriod: 'Current Term 2026' },
    accountsUser
  );

  return {
    skipped: false,
    message: 'Demo dataset seeded successfully across all 5 roles and domain entities.',
    demoPassword: password,
  };
}
