import { z } from 'zod';
import { ACCOUNT_STATUSES, USER_ROLES } from '../models/User.js';
import { HOSTEL_TYPES } from '../models/Hostel.js';
import { ROOM_STATUSES } from '../models/Room.js';
import { BED_STATUSES, MAINTENANCE_STATUSES } from '../models/Bed.js';
import { COMPLAINT_CATEGORIES, COMPLAINT_STATUSES } from '../models/Complaint.js';
import { PAYMENT_STATUSES } from '../models/PaymentRecord.js';
import { VISIT_STATUSES } from '../models/VisitorRecord.js';
import { REPORT_TYPES } from '../models/Report.js';

export const objectIdRegex = /^[a-fA-F0-9]{24}$/;

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/, 'Only letters, numbers, dots, underscores, hyphens'),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(120),
  contactNumber: z.string().trim().min(7).max(20),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(2).max(120),
  password: z.string().min(1).max(128),
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().max(120).optional(),
  contactNumber: z.string().trim().min(7).max(20).optional(),
  currentPassword: z.string().min(1).max(128).optional(),
  newPassword: z.string().min(8).max(128).optional(),
});

export const createUserSchema = z.object({
  username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(8).max(128),
  role: z.enum(USER_ROLES),
  accountStatus: z.enum(ACCOUNT_STATUSES).optional(),
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(120).optional(),
  contactNumber: z.string().trim().max(20).optional(),
  assignedHostelId: z.string().regex(objectIdRegex).nullable().optional(),
});

export const updateUserSchema = z.object({
  role: z.enum(USER_ROLES).optional(),
  accountStatus: z.enum(ACCOUNT_STATUSES).optional(),
  fullName: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().max(120).optional(),
  contactNumber: z.string().trim().max(20).optional(),
  assignedHostelId: z.string().regex(objectIdRegex).nullable().optional(),
});

export const createHostelSchema = z.object({
  hostelId: z.string().trim().min(2).max(20).regex(/^[a-zA-Z0-9-]+$/).optional(),
  hostelName: z.string().trim().min(2).max(120),
  address: z.string().trim().min(4).max(240),
  hostelType: z.enum(HOSTEL_TYPES),
  isActive: z.boolean().optional(),
});

export const updateHostelSchema = createHostelSchema.partial();

export const createRoomSchema = z.object({
  roomNumber: z.string().trim().min(1).max(20),
  capacity: z.coerce.number().int().min(1).max(20),
  roomStatus: z.enum(ROOM_STATUSES).optional(),
});

export const updateRoomSchema = createRoomSchema.partial();

export const createBedSchema = z.object({
  bedNumber: z.string().trim().min(1).max(20),
  bedStatus: z.enum(BED_STATUSES).optional(),
  maintenanceStatus: z.enum(MAINTENANCE_STATUSES).optional(),
});

export const updateBedSchema = createBedSchema.partial();

export const createBookingSchema = z.object({
  bedId: z.string().regex(objectIdRegex, 'Valid bed identifier required'),
  startDate: z.string().min(4),
  endDate: z.string().min(4),
  notes: z.string().trim().max(500).optional(),
});

export const bookingDecisionSchema = z.object({
  decisionNote: z.string().trim().max(400).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().trim().max(400).optional(),
});

export const releaseAllocationSchema = z.object({
  reason: z.string().trim().max(400).optional(),
});

export const createComplaintSchema = z.object({
  hostelId: z.string().regex(objectIdRegex).optional().nullable(),
  bookingId: z.string().regex(objectIdRegex).optional().nullable(),
  category: z.enum(COMPLAINT_CATEGORIES).optional(),
  description: z.string().trim().min(5).max(1000),
});

export const updateComplaintSchema = z.object({
  complaintStatus: z.enum(COMPLAINT_STATUSES),
  resolutionDetails: z.string().trim().max(1000).optional(),
});

export const createVisitorSchema = z.object({
  visitorName: z.string().trim().min(2).max(100),
  contactNumber: z.string().trim().min(7).max(20),
  identificationDetails: z.string().trim().min(3).max(120),
  hostelId: z.string().regex(objectIdRegex, 'Valid hostel required'),
  studentId: z.string().regex(objectIdRegex).optional(),
  visitDate: z.string().min(4),
  purpose: z.string().trim().min(2).max(200).optional(),
});

export const updateVisitorStatusSchema = z.object({
  visitStatus: z.enum(VISIT_STATUSES),
  visitorName: z.string().trim().min(2).max(100).optional(),
  contactNumber: z.string().trim().min(7).max(20).optional(),
  identificationDetails: z.string().trim().min(3).max(120).optional(),
});

export const createPaymentSchema = z.object({
  bookingId: z.string().regex(objectIdRegex, 'Valid booking required'),
  amountMinor: z.coerce.number().int().min(100, 'Amount must be at least 100 paise (1.00 INR)'),
  paymentReference: z.string().trim().min(3).max(80),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  paymentDate: z.string().optional(),
  notes: z.string().trim().max(400).optional(),
});

export const updatePaymentSchema = z.object({
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  amountMinor: z.coerce.number().int().min(100).optional(),
  paymentReference: z.string().trim().min(3).max(80).optional(),
  notes: z.string().trim().max(400).optional(),
});

export const generateReportSchema = z.object({
  reportType: z.enum(REPORT_TYPES),
  reportPeriod: z.string().trim().min(2).max(80),
  hostelId: z.string().regex(objectIdRegex).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});
