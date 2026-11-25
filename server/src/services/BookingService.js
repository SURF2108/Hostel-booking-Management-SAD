import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { dbConnection } from '../config/db.js';
import { Bed } from '../models/Bed.js';
import { Booking } from '../models/Booking.js';
import { Allocation } from '../models/Allocation.js';
import { PaymentRecord } from '../models/PaymentRecord.js';
import { nextSequence } from '../models/Counter.js';
import { conflict, forbidden, notFound } from '../utils/errors.js';
import { paginatedResponse, parsePagination } from '../utils/pagination.js';
import { auditService } from './AuditService.js';
import { getUnavailableBedIdsForPeriod, parseDateRange } from './HostelService.js';

/**
 * Coordinates atomic bed lock and replica-set transaction when available, falling back
 * to an atomic Bed.allocationLock mutex when connected to standalone MongoDB.
 */
export async function runWithBedLockAndTx(bedObjectId, fn) {
  if (dbConnection.supportsTransactions()) {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const session = await mongoose.startSession();
      try {
        let result;
        await session.withTransaction(async () => {
          const lockedBed = await Bed.findOneAndUpdate(
            { _id: bedObjectId },
            { $inc: { allocationVersion: 1 } },
            { session, new: true }
          )
            .populate('room')
            .populate('hostel');
          if (!lockedBed) throw notFound('Bed not found.');
          result = await fn({ session, bed: lockedBed });
        });
        await session.endSession();
        return result;
      } catch (err) {
        await session.endSession();
        const isTransient =
          err?.hasErrorLabel?.('TransientTransactionError') ||
          err?.code === 112 ||
          err?.codeName === 'WriteConflict';
        if (isTransient && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 40 * attempt));
          continue;
        }
        throw err;
      }
    }
  }

  // Standalone MongoDB atomic mutex via Bed.allocationLock
  const token = crypto.randomUUID();
  let lockedBed = null;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    lockedBed = await Bed.findOneAndUpdate(
      { _id: bedObjectId, allocationLock: null },
      { $set: { allocationLock: token }, $inc: { allocationVersion: 1 } },
      { new: true }
    )
      .populate('room')
      .populate('hostel');
    if (lockedBed) break;
    await new Promise((r) => setTimeout(r, 40));
  }
  if (!lockedBed) {
    throw conflict('Bed is currently being processed by another request. Please retry.');
  }

  try {
    return await fn({ session: null, bed: lockedBed });
  } finally {
    await Bed.updateOne({ _id: bedObjectId, allocationLock: token }, { $set: { allocationLock: null } });
  }
}

export async function recomputeBedStatus(bedObjectId, session = null) {
  const bed = await Bed.findById(bedObjectId).session(session);
  if (!bed) return null;
  if (bed.maintenanceStatus !== 'Operational') {
    bed.bedStatus = 'Maintenance';
    await bed.save({ session });
    return bed;
  }
  const activeAllocs = await Allocation.find({
    bed: bed._id,
    allocationStatus: { $in: ['Active', 'CheckedIn'] },
  })
    .session(session)
    .lean();

  if (activeAllocs.some((a) => a.allocationStatus === 'CheckedIn')) {
    bed.bedStatus = 'Occupied';
  } else if (activeAllocs.length > 0) {
    bed.bedStatus = 'Reserved';
  } else {
    bed.bedStatus = 'Available';
  }
  await bed.save({ session });
  return bed;
}

export class BookingService {
  async createBooking({ bedId, startDate, endDate, notes = '' }, studentUser) {
    const { start, end } = parseDateRange(startDate, endDate);

    return runWithBedLockAndTx(bedId, async ({ session, bed }) => {
      if (!bed.hostel?.isActive) {
        throw conflict('Selected hostel is currently inactive.');
      }
      if (!bed.room || bed.room.roomStatus === 'Maintenance' || bed.room.roomStatus === 'Inactive') {
        throw conflict(`Selected room is currently ${bed.room?.roomStatus || 'unavailable'}.`);
      }
      if (bed.maintenanceStatus !== 'Operational') {
        throw conflict(`Selected bed is ${bed.maintenanceStatus}.`);
      }

      const unavailableSet = await getUnavailableBedIdsForPeriod(start, end, { session });
      if (unavailableSet.has(String(bed._id))) {
        throw conflict('Selected bed is already allocated or approved for overlapping dates.');
      }

      const studentOverlap = await Booking.findOne({
        student: studentUser._id,
        bookingStatus: { $in: ['Pending', 'Approved'] },
        startDate: { $lt: end },
        endDate: { $gt: start },
      }).session(session);

      if (studentOverlap) {
        throw conflict(
          `You already have an active ${studentOverlap.bookingStatus} booking (${studentOverlap.bookingId}) overlapping these dates.`
        );
      }

      const seq = await nextSequence('booking', session);
      const bookingId = `BKG-${new Date().getUTCFullYear()}-${String(seq).padStart(4, '0')}`;

      const [booking] = await Booking.create(
        [
          {
            bookingId,
            student: studentUser._id,
            bed: bed._id,
            room: bed.room._id,
            hostel: bed.hostel._id,
            requestDate: new Date(),
            startDate: start,
            endDate: end,
            bookingStatus: 'Pending',
            notes: notes.trim(),
          },
        ],
        session ? { session } : {}
      );

      await auditService.recordActivity({
        action: 'BOOKING_SUBMITTED',
        affectedModel: 'Booking',
        affectedRecord: booking.bookingId,
        details: {
          bedId: bed.bedId,
          hostelId: bed.hostel.hostelId,
          startDate: start,
          endDate: end,
        },
        actor: studentUser,
        session,
      });

      return Booking.findById(booking._id)
        .populate('student', 'userId username fullName studentId email contactNumber')
        .populate('hostel', 'hostelId hostelName hostelType')
        .populate('room', 'roomId roomNumber roomStatus')
        .populate('bed', 'bedId bedNumber bedStatus maintenanceStatus')
        .session(session);
    });
  }

  async listBookings(query = {}, actor) {
    const { page, limit, skip } = parsePagination(query, 20, 100);
    const filter = {};

    if (actor.role === 'Student') {
      filter.student = actor._id;
    } else if (actor.role === 'Warden' && actor.assignedHostelId) {
      filter.hostel = actor.assignedHostelId._id || actor.assignedHostelId;
    } else if (query.hostelId) {
      filter.hostel = query.hostelId;
    }

    if (query.status && query.status !== 'All') {
      filter.bookingStatus = query.status;
    }
    if (query.search) {
      filter.bookingId = { $regex: query.search.trim(), $options: 'i' };
    }

    const [items, total] = await Promise.all([
      Booking.find(filter)
        .sort({ requestDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('student', 'userId username fullName studentId email contactNumber')
        .populate('hostel', 'hostelId hostelName hostelType')
        .populate('room', 'roomId roomNumber')
        .populate('bed', 'bedId bedNumber bedStatus maintenanceStatus')
        .populate('reviewedByWarden', 'userId username fullName wardenId')
        .lean(),
      Booking.countDocuments(filter),
    ]);

    const bookingIds = items.map((b) => b._id);
    const allocations = await Allocation.find({ booking: { $in: bookingIds } }).lean();
    const allocByBooking = new Map(allocations.map((a) => [String(a.booking), a]));

    const enriched = items.map((b) => ({
      ...b,
      allocation: allocByBooking.get(String(b._id)) || null,
    }));

    return paginatedResponse(enriched, total, page, limit);
  }

  async getBookingById(id, actor) {
    const booking = await Booking.findById(id)
      .populate('student', 'userId username fullName studentId email contactNumber')
      .populate('hostel', 'hostelId hostelName address hostelType')
      .populate('room', 'roomId roomNumber capacity roomStatus')
      .populate('bed', 'bedId bedNumber bedStatus maintenanceStatus')
      .populate('reviewedByWarden', 'userId username fullName wardenId')
      .lean();

    if (!booking) throw notFound('Booking not found.');

    if (actor.role === 'Student' && String(booking.student._id) !== String(actor._id)) {
      throw forbidden('You can only view your own booking records.');
    }
    if (actor.role === 'Warden' && actor.assignedHostelId) {
      const assignedId = String(actor.assignedHostelId._id || actor.assignedHostelId);
      if (String(booking.hostel._id) !== assignedId) {
        throw forbidden('This booking belongs to a hostel outside your assigned scope.');
      }
    }

    const [allocation, payments] = await Promise.all([
      Allocation.findOne({ booking: booking._id })
        .populate('allocatedByWarden', 'userId username fullName wardenId')
        .lean(),
      PaymentRecord.find({ booking: booking._id }).sort({ paymentDate: -1 }).lean(),
    ]);

    return {
      ...booking,
      allocation: allocation || null,
      payments,
    };
  }

  async cancelBooking(id, actor, reason = '') {
    const existing = await Booking.findById(id);
    if (!existing) throw notFound('Booking not found.');

    if (actor.role !== 'Student' || String(existing.student) !== String(actor._id)) {
      throw forbidden('Only the booking owner (Student) can cancel this booking.');
    }

    return runWithBedLockAndTx(existing.bed, async ({ session }) => {
      const booking = await Booking.findById(id).session(session);
      if (!booking) throw notFound('Booking not found.');

      if (!['Pending', 'Approved'].includes(booking.bookingStatus)) {
        throw conflict(`Cannot cancel booking in ${booking.bookingStatus} status.`);
      }

      const allocation = await Allocation.findOne({ booking: booking._id }).session(session);
      if (allocation && allocation.allocationStatus === 'CheckedIn') {
        throw conflict('Cannot cancel a booking after check-in has been recorded. Request check-out from Warden.');
      }

      booking.bookingStatus = 'Cancelled';
      booking.cancelledAt = new Date();
      if (reason) {
        booking.decisionNote = reason.trim();
      }
      await booking.save({ session });

      if (allocation && allocation.allocationStatus === 'Active') {
        allocation.allocationStatus = 'Released';
        allocation.releasedAt = new Date();
        allocation.releaseReason = reason?.trim() || 'Cancelled by student';
        await allocation.save({ session });
        await recomputeBedStatus(booking.bed, session);
      }

      await auditService.recordActivity({
        action: 'BOOKING_CANCELLED',
        affectedModel: 'Booking',
        affectedRecord: booking.bookingId,
        details: { reason: reason || 'Cancelled by student', releasedAllocation: Boolean(allocation) },
        actor,
        session,
      });

      return this.getBookingById(booking._id, actor);
    });
  }
}

export const bookingService = new BookingService();
