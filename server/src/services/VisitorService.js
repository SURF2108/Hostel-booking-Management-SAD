import { Visitor } from '../models/Visitor.js';
import { VisitorRecord } from '../models/VisitorRecord.js';
import { Hostel } from '../models/Hostel.js';
import { User } from '../models/User.js';
import { nextSequence } from '../models/Counter.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { paginatedResponse, parsePagination } from '../utils/pagination.js';
import { auditService } from './AuditService.js';

const VISIT_TRANSITIONS = {
  Registered: new Set(['CheckedIn', 'Cancelled']),
  CheckedIn: new Set(['CheckedOut']),
  CheckedOut: new Set([]),
  Cancelled: new Set([]),
};

export class VisitorService {
  async registerVisitor(payload, actor) {
    const hostel = await Hostel.findById(payload.hostelId);
    if (!hostel) throw badRequest('Selected hostel does not exist.');

    if (actor.role === 'Warden' && actor.assignedHostelId) {
      const assignedId = String(actor.assignedHostelId._id || actor.assignedHostelId);
      if (String(hostel._id) !== assignedId) {
        throw forbidden('Warden cannot register visitors for another hostel.');
      }
    }

    let studentObjectId = actor._id;
    if (actor.role === 'Warden') {
      if (payload.studentId) {
        const student = await User.findOne({ _id: payload.studentId, role: 'Student' });
        if (!student) throw badRequest('Referenced student not found.');
        studentObjectId = student._id;
      } else {
        throw badRequest('Student identifier is required when Warden registers a visitor.', {
          studentId: 'Select visited student',
        });
      }
    }

    const visitDate = new Date(payload.visitDate);
    if (Number.isNaN(visitDate.getTime())) {
      throw badRequest('Invalid visitDate.');
    }

    const visitorId = await nextSequence('visitor');
    const visitRecordId = await nextSequence('visitorRecord');

    const visitor = await Visitor.create({
      visitorId,
      visitorName: payload.visitorName.trim(),
      contactNumber: payload.contactNumber.trim(),
      identificationDetails: payload.identificationDetails.trim(),
    });

    const record = await VisitorRecord.create({
      visitRecordId,
      visitor: visitor._id,
      student: studentObjectId,
      hostel: hostel._id,
      managedByWarden: actor.role === 'Warden' ? actor._id : null,
      visitDate,
      purpose: payload.purpose?.trim() || 'Student visit',
      visitStatus: 'Registered',
    });

    await auditService.recordActivity({
      action: 'VISITOR_REGISTERED',
      affectedModel: 'VisitorRecord',
      affectedRecord: String(record.visitRecordId),
      details: { visitorName: visitor.visitorName, hostelId: hostel.hostelId },
      actor,
    });

    return VisitorRecord.findById(record._id)
      .populate('visitor')
      .populate('student', 'userId username fullName studentId')
      .populate('hostel', 'hostelId hostelName')
      .populate('managedByWarden', 'userId username fullName wardenId');
  }

  async listVisitorRecords(query = {}, actor) {
    const { page, limit, skip } = parsePagination(query, 20, 100);
    const filter = {};
    if (actor.role === 'Student') {
      filter.student = actor._id;
    } else if (actor.role === 'Warden' && actor.assignedHostelId) {
      filter.hostel = actor.assignedHostelId._id || actor.assignedHostelId;
    }
    if (query.status && query.status !== 'All') {
      filter.visitStatus = query.status;
    }

    const [items, total] = await Promise.all([
      VisitorRecord.find(filter)
        .sort({ visitDate: -1, visitRecordId: -1 })
        .skip(skip)
        .limit(limit)
        .populate('visitor')
        .populate('student', 'userId username fullName studentId')
        .populate('hostel', 'hostelId hostelName')
        .populate('managedByWarden', 'userId username fullName wardenId')
        .lean(),
      VisitorRecord.countDocuments(filter),
    ]);

    return paginatedResponse(items, total, page, limit);
  }

  async updateVisitorRecord(id, payload, wardenUser) {
    const record = await VisitorRecord.findById(id).populate('visitor');
    if (!record) throw notFound('Visitor record not found.');

    if (wardenUser.role === 'Warden' && wardenUser.assignedHostelId) {
      const assignedId = String(wardenUser.assignedHostelId._id || wardenUser.assignedHostelId);
      if (String(record.hostel) !== assignedId) {
        throw forbidden('Visitor record belongs to another hostel.');
      }
    }

    if (payload.visitStatus !== record.visitStatus) {
      const allowed = VISIT_TRANSITIONS[record.visitStatus] || new Set();
      if (!allowed.has(payload.visitStatus)) {
        throw conflict(`Cannot transition visit from ${record.visitStatus} to ${payload.visitStatus}.`);
      }
      record.visitStatus = payload.visitStatus;
      if (payload.visitStatus === 'CheckedIn') {
        record.checkInTime = new Date();
      } else if (payload.visitStatus === 'CheckedOut') {
        record.checkOutTime = new Date();
      }
    }

    if (record.visitor) {
      let dirty = false;
      if (payload.visitorName !== undefined) {
        record.visitor.visitorName = payload.visitorName;
        dirty = true;
      }
      if (payload.contactNumber !== undefined) {
        record.visitor.contactNumber = payload.contactNumber;
        dirty = true;
      }
      if (payload.identificationDetails !== undefined) {
        record.visitor.identificationDetails = payload.identificationDetails;
        dirty = true;
      }
      if (dirty) await record.visitor.save();
    }

    record.managedByWarden = wardenUser._id;
    await record.save();

    await auditService.recordActivity({
      action: 'VISITOR_RECORD_UPDATED',
      affectedModel: 'VisitorRecord',
      affectedRecord: String(record.visitRecordId),
      details: { visitStatus: record.visitStatus },
      actor: wardenUser,
    });

    return VisitorRecord.findById(record._id)
      .populate('visitor')
      .populate('student', 'userId username fullName studentId')
      .populate('hostel', 'hostelId hostelName')
      .populate('managedByWarden', 'userId username fullName wardenId');
  }
}

export const visitorService = new VisitorService();
