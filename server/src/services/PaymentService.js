import { PaymentRecord } from '../models/PaymentRecord.js';
import { Booking } from '../models/Booking.js';
import { nextSequence } from '../models/Counter.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { paginatedResponse, parsePagination } from '../utils/pagination.js';
import { auditService } from './AuditService.js';

const PAYMENT_TRANSITIONS = {
  Pending: new Set(['Paid', 'Failed']),
  Failed: new Set(['Pending', 'Paid']),
  Paid: new Set(['Refunded']),
  Refunded: new Set([]),
};

export class PaymentService {
  async createPaymentRecord(payload, accountsUser) {
    const booking = await Booking.findById(payload.bookingId);
    if (!booking) throw notFound('Booking not found for payment record.');

    if (booking.bookingStatus === 'Rejected' || booking.bookingStatus === 'Cancelled') {
      throw conflict(`Cannot create a payment record for a ${booking.bookingStatus} booking.`);
    }

    const dupRef = await PaymentRecord.findOne({ paymentReference: payload.paymentReference.trim() });
    if (dupRef) {
      throw conflict('Payment reference already exists.', 'DUPLICATE_REFERENCE');
    }

    const paymentDate = payload.paymentDate ? new Date(payload.paymentDate) : new Date();
    if (Number.isNaN(paymentDate.getTime())) {
      throw badRequest('Invalid paymentDate.');
    }

    const paymentId = await nextSequence('payment');
    const record = await PaymentRecord.create({
      paymentId,
      booking: booking._id,
      student: booking.student,
      recordedBy: accountsUser._id,
      amountMinor: payload.amountMinor,
      currency: 'INR',
      paymentDate,
      paymentReference: payload.paymentReference.trim(),
      paymentStatus: payload.paymentStatus || 'Pending',
      notes: payload.notes?.trim() || '',
    });

    await auditService.recordActivity({
      action: 'PAYMENT_RECORD_CREATED',
      affectedModel: 'PaymentRecord',
      affectedRecord: String(record.paymentId),
      details: {
        bookingId: booking.bookingId,
        amountMinor: record.amountMinor,
        paymentStatus: record.paymentStatus,
      },
      actor: accountsUser,
    });

    return PaymentRecord.findById(record._id)
      .populate('booking', 'bookingId bookingStatus startDate endDate')
      .populate('student', 'userId username fullName studentId')
      .populate('recordedBy', 'userId username fullName employeeId');
  }

  async updatePaymentRecord(id, payload, accountsUser) {
    const record = await PaymentRecord.findById(id);
    if (!record) throw notFound('Payment record not found.');

    if (payload.paymentStatus && payload.paymentStatus !== record.paymentStatus) {
      const allowed = PAYMENT_TRANSITIONS[record.paymentStatus] || new Set();
      if (!allowed.has(payload.paymentStatus)) {
        throw conflict(
          `Cannot transition payment from ${record.paymentStatus} to ${payload.paymentStatus}.`
        );
      }
      record.paymentStatus = payload.paymentStatus;
    }

    if (payload.amountMinor !== undefined) record.amountMinor = payload.amountMinor;
    if (payload.paymentReference !== undefined) record.paymentReference = payload.paymentReference.trim();
    if (payload.notes !== undefined) record.notes = payload.notes.trim();
    record.recordedBy = accountsUser._id;

    await record.save();

    await auditService.recordActivity({
      action: 'PAYMENT_RECORD_UPDATED',
      affectedModel: 'PaymentRecord',
      affectedRecord: String(record.paymentId),
      details: payload,
      actor: accountsUser,
    });

    return PaymentRecord.findById(record._id)
      .populate('booking', 'bookingId bookingStatus startDate endDate')
      .populate('student', 'userId username fullName studentId')
      .populate('recordedBy', 'userId username fullName employeeId');
  }

  async listPaymentRecords(query = {}, actor) {
    const { page, limit, skip } = parsePagination(query, 20, 100);
    const filter = {};
    if (actor.role === 'Student') {
      filter.student = actor._id;
    }
    if (query.status && query.status !== 'All') {
      filter.paymentStatus = query.status;
    }
    if (query.search) {
      const rx = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ paymentReference: rx }, { notes: rx }];
    }

    const [items, total] = await Promise.all([
      PaymentRecord.find(filter)
        .sort({ paymentDate: -1, paymentId: -1 })
        .skip(skip)
        .limit(limit)
        .populate('booking', 'bookingId bookingStatus startDate endDate')
        .populate('student', 'userId username fullName studentId')
        .populate('recordedBy', 'userId username fullName employeeId')
        .lean(),
      PaymentRecord.countDocuments(filter),
    ]);

    return paginatedResponse(items, total, page, limit);
  }
}

export const paymentService = new PaymentService();
