import { Complaint } from '../models/Complaint.js';
import { Booking } from '../models/Booking.js';
import { Hostel } from '../models/Hostel.js';
import { nextSequence } from '../models/Counter.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { paginatedResponse, parsePagination } from '../utils/pagination.js';
import { auditService } from './AuditService.js';

const ALLOWED_TRANSITIONS = {
  Open: new Set(['InProgress', 'Resolved', 'Closed']),
  InProgress: new Set(['Resolved', 'Closed']),
  Resolved: new Set(['Closed', 'InProgress']),
  Closed: new Set([]),
};

export class ComplaintService {
  async submitComplaint(payload, studentUser) {
    let hostelId = payload.hostelId || null;
    let bookingId = payload.bookingId || null;

    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (!booking) throw notFound('Referenced booking not found.');
      if (String(booking.student) !== String(studentUser._id)) {
        throw forbidden('You may only reference your own booking.');
      }
      if (!hostelId) hostelId = booking.hostel;
    }

    if (hostelId) {
      const hostel = await Hostel.findById(hostelId);
      if (!hostel) throw badRequest('Referenced hostel not found.');
    }

    const seq = await nextSequence('complaint');
    const complaintId = `CMP-${new Date().getUTCFullYear()}-${String(seq).padStart(4, '0')}`;

    const complaint = await Complaint.create({
      complaintId,
      student: studentUser._id,
      hostel: hostelId,
      booking: bookingId,
      category: payload.category || 'Maintenance',
      description: payload.description.trim(),
      submissionDate: new Date(),
      complaintStatus: 'Open',
    });

    await auditService.recordActivity({
      action: 'COMPLAINT_SUBMITTED',
      affectedModel: 'Complaint',
      affectedRecord: complaint.complaintId,
      details: { category: complaint.category },
      actor: studentUser,
    });

    return Complaint.findById(complaint._id)
      .populate('student', 'userId username fullName studentId')
      .populate('hostel', 'hostelId hostelName')
      .populate('booking', 'bookingId bookingStatus');
  }

  async listComplaints(query = {}, actor) {
    const { page, limit, skip } = parsePagination(query, 20, 100);
    const filter = {};
    if (actor.role === 'Student') {
      filter.student = actor._id;
    } else if (actor.role === 'Warden' && actor.assignedHostelId) {
      const assignedId = actor.assignedHostelId._id || actor.assignedHostelId;
      filter.$or = [{ hostel: assignedId }, { hostel: null }];
    }
    if (query.status && query.status !== 'All') {
      filter.complaintStatus = query.status;
    }
    if (query.category && query.category !== 'All') {
      filter.category = query.category;
    }

    const [items, total] = await Promise.all([
      Complaint.find(filter)
        .sort({ submissionDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('student', 'userId username fullName studentId')
        .populate('hostel', 'hostelId hostelName')
        .populate('booking', 'bookingId bookingStatus')
        .populate('handledByWarden', 'userId username fullName wardenId')
        .lean(),
      Complaint.countDocuments(filter),
    ]);

    return paginatedResponse(items, total, page, limit);
  }

  async updateComplaint(id, payload, wardenUser) {
    const complaint = await Complaint.findById(id);
    if (!complaint) throw notFound('Complaint not found.');

    if (wardenUser.role === 'Warden' && wardenUser.assignedHostelId && complaint.hostel) {
      const assignedId = String(wardenUser.assignedHostelId._id || wardenUser.assignedHostelId);
      if (String(complaint.hostel) !== assignedId) {
        throw forbidden('Complaint belongs to a hostel outside your assigned scope.');
      }
    }

    if (payload.complaintStatus !== complaint.complaintStatus) {
      const allowed = ALLOWED_TRANSITIONS[complaint.complaintStatus] || new Set();
      if (!allowed.has(payload.complaintStatus)) {
        throw conflict(
          `Cannot transition complaint from ${complaint.complaintStatus} to ${payload.complaintStatus}.`
        );
      }
      complaint.complaintStatus = payload.complaintStatus;
    }

    if (payload.resolutionDetails !== undefined) {
      complaint.resolutionDetails = payload.resolutionDetails.trim();
    }
    if (['Resolved', 'Closed'].includes(complaint.complaintStatus) && !complaint.resolutionDetails) {
      throw badRequest('Resolution details are required when resolving or closing a complaint.', {
        resolutionDetails: 'Provide resolution notes',
      });
    }

    complaint.handledByWarden = wardenUser._id;
    if (complaint.complaintStatus === 'Resolved' || complaint.complaintStatus === 'Closed') {
      complaint.resolvedAt = complaint.resolvedAt || new Date();
    }

    await complaint.save();

    await auditService.recordActivity({
      action: 'COMPLAINT_UPDATED',
      affectedModel: 'Complaint',
      affectedRecord: complaint.complaintId,
      details: {
        complaintStatus: complaint.complaintStatus,
        resolutionDetails: complaint.resolutionDetails,
      },
      actor: wardenUser,
    });

    return Complaint.findById(complaint._id)
      .populate('student', 'userId username fullName studentId')
      .populate('hostel', 'hostelId hostelName')
      .populate('handledByWarden', 'userId username fullName wardenId');
  }
}

export const complaintService = new ComplaintService();
