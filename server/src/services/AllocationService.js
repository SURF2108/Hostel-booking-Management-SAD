import { Booking } from '../models/Booking.js';
import { Allocation } from '../models/Allocation.js';
import { nextSequence } from '../models/Counter.js';
import { conflict, forbidden, notFound } from '../utils/errors.js';
import { paginatedResponse, parsePagination } from '../utils/pagination.js';
import { auditService } from './AuditService.js';
import { getUnavailableBedIdsForPeriod } from './HostelService.js';
import { recomputeBedStatus, runWithBedLockAndTx } from './BookingService.js';

function assertWardenHostelAccess(warden, hostelId) {
  if (warden.role === 'Warden' && warden.assignedHostelId) {
    const assigned = String(warden.assignedHostelId._id || warden.assignedHostelId);
    if (String(hostelId) !== assigned) {
      throw forbidden('Warden is not assigned to this hostel.');
    }
  }
}

export class AllocationService {
  async approveAndAllocate(bookingId, wardenUser, decisionNote = '') {
    const target = await Booking.findById(bookingId);
    if (!target) throw notFound('Booking not found.');
    assertWardenHostelAccess(wardenUser, target.hostel);

    return runWithBedLockAndTx(target.bed, async ({ session, bed }) => {
      const booking = await Booking.findById(bookingId).session(session);
      if (!booking) throw notFound('Booking not found.');

      if (booking.bookingStatus !== 'Pending') {
        throw conflict(`Booking is already ${booking.bookingStatus}; only Pending bookings can be approved.`);
      }

      if (!bed.hostel?.isActive) {
        throw conflict('Hostel is inactive and cannot be allocated.');
      }
      if (!bed.room || bed.room.roomStatus === 'Maintenance' || bed.room.roomStatus === 'Inactive') {
        throw conflict(`Room is ${bed.room?.roomStatus || 'unavailable'}.`);
      }
      if (bed.maintenanceStatus !== 'Operational') {
        throw conflict(`Bed is ${bed.maintenanceStatus} and cannot be allocated.`);
      }

      const unavailableSet = await getUnavailableBedIdsForPeriod(booking.startDate, booking.endDate, {
        excludeBookingId: booking._id,
        session,
      });
      if (unavailableSet.has(String(bed._id))) {
        throw conflict('Bed availability recheck failed: overlapping allocation or approved booking exists.');
      }

      booking.bookingStatus = 'Approved';
      booking.reviewedByWarden = wardenUser._id;
      booking.reviewedAt = new Date();
      booking.decisionNote = decisionNote.trim();
      await booking.save({ session });

      const seq = await nextSequence('allocation', session);
      const allocationId = `ALC-${new Date().getUTCFullYear()}-${String(seq).padStart(4, '0')}`;

      const [allocation] = await Allocation.create(
        [
          {
            allocationId,
            booking: booking._id,
            bed: booking.bed,
            room: booking.room,
            hostel: booking.hostel,
            student: booking.student,
            allocatedByWarden: wardenUser._id,
            allocationDate: new Date(),
            startDate: booking.startDate,
            endDate: booking.endDate,
            allocationStatus: 'Active',
          },
        ],
        session ? { session } : {}
      );

      await recomputeBedStatus(booking.bed, session);

      await auditService.recordActivity({
        action: 'BOOKING_APPROVED_AND_ALLOCATED',
        affectedModel: 'Allocation',
        affectedRecord: allocation.allocationId,
        details: {
          bookingId: booking.bookingId,
          bedId: bed.bedId,
          decisionNote: booking.decisionNote,
        },
        actor: wardenUser,
        session,
      });

      return Allocation.findById(allocation._id)
        .populate('booking')
        .populate('student', 'userId username fullName studentId')
        .populate('hostel', 'hostelId hostelName')
        .populate('room', 'roomId roomNumber')
        .populate('bed', 'bedId bedNumber bedStatus')
        .populate('allocatedByWarden', 'userId username fullName wardenId')
        .session(session);
    });
  }

  async rejectBooking(bookingId, wardenUser, decisionNote = '') {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw notFound('Booking not found.');
    assertWardenHostelAccess(wardenUser, booking.hostel);

    if (booking.bookingStatus !== 'Pending') {
      throw conflict(`Booking is already ${booking.bookingStatus}; only Pending bookings can be rejected.`);
    }

    booking.bookingStatus = 'Rejected';
    booking.reviewedByWarden = wardenUser._id;
    booking.reviewedAt = new Date();
    booking.decisionNote = decisionNote.trim() || 'Rejected by Warden';
    await booking.save();

    await auditService.recordActivity({
      action: 'BOOKING_REJECTED',
      affectedModel: 'Booking',
      affectedRecord: booking.bookingId,
      details: { decisionNote: booking.decisionNote },
      actor: wardenUser,
    });

    return booking;
  }

  async listAllocations(query = {}, actor) {
    const { page, limit, skip } = parsePagination(query, 20, 100);
    const filter = {};
    if (actor.role === 'Warden' && actor.assignedHostelId) {
      filter.hostel = actor.assignedHostelId._id || actor.assignedHostelId;
    } else if (query.hostelId) {
      filter.hostel = query.hostelId;
    }
    if (query.status && query.status !== 'All') {
      filter.allocationStatus = query.status;
    }

    const [items, total] = await Promise.all([
      Allocation.find(filter)
        .sort({ allocationDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('booking', 'bookingId bookingStatus startDate endDate')
        .populate('student', 'userId username fullName studentId contactNumber')
        .populate('hostel', 'hostelId hostelName')
        .populate('room', 'roomId roomNumber')
        .populate('bed', 'bedId bedNumber bedStatus maintenanceStatus')
        .populate('allocatedByWarden', 'userId username fullName wardenId')
        .lean(),
      Allocation.countDocuments(filter),
    ]);

    return paginatedResponse(items, total, page, limit);
  }

  async recordCheckIn(allocationId, wardenUser) {
    const target = await Allocation.findById(allocationId);
    if (!target) throw notFound('Allocation not found.');
    assertWardenHostelAccess(wardenUser, target.hostel);

    return runWithBedLockAndTx(target.bed, async ({ session }) => {
      const alloc = await Allocation.findById(allocationId).session(session);
      if (!alloc) throw notFound('Allocation not found.');
      if (alloc.allocationStatus !== 'Active') {
        throw conflict(`Cannot check in allocation in ${alloc.allocationStatus} status.`);
      }

      alloc.allocationStatus = 'CheckedIn';
      alloc.checkInTime = new Date();
      await alloc.save({ session });

      await recomputeBedStatus(alloc.bed, session);

      await auditService.recordActivity({
        action: 'ALLOCATION_CHECK_IN',
        affectedModel: 'Allocation',
        affectedRecord: alloc.allocationId,
        details: { checkInTime: alloc.checkInTime },
        actor: wardenUser,
        session,
      });

      return Allocation.findById(alloc._id)
        .populate('booking', 'bookingId bookingStatus')
        .populate('student', 'userId username fullName studentId')
        .populate('hostel', 'hostelId hostelName')
        .populate('room', 'roomId roomNumber')
        .populate('bed', 'bedId bedNumber bedStatus')
        .session(session);
    });
  }

  async recordCheckOut(allocationId, wardenUser) {
    const target = await Allocation.findById(allocationId);
    if (!target) throw notFound('Allocation not found.');
    assertWardenHostelAccess(wardenUser, target.hostel);

    return runWithBedLockAndTx(target.bed, async ({ session }) => {
      const alloc = await Allocation.findById(allocationId).session(session);
      if (!alloc) throw notFound('Allocation not found.');
      if (alloc.allocationStatus !== 'CheckedIn') {
        throw conflict(`Cannot check out allocation in ${alloc.allocationStatus} status.`);
      }

      alloc.allocationStatus = 'CheckedOut';
      alloc.checkOutTime = new Date();
      await alloc.save({ session });

      await Booking.updateOne(
        { _id: alloc.booking, bookingStatus: 'Approved' },
        { $set: { bookingStatus: 'Completed' } },
        { session }
      );

      await recomputeBedStatus(alloc.bed, session);

      await auditService.recordActivity({
        action: 'ALLOCATION_CHECK_OUT',
        affectedModel: 'Allocation',
        affectedRecord: alloc.allocationId,
        details: { checkOutTime: alloc.checkOutTime },
        actor: wardenUser,
        session,
      });

      return Allocation.findById(alloc._id)
        .populate('booking', 'bookingId bookingStatus')
        .populate('student', 'userId username fullName studentId')
        .populate('hostel', 'hostelId hostelName')
        .populate('room', 'roomId roomNumber')
        .populate('bed', 'bedId bedNumber bedStatus')
        .session(session);
    });
  }

  async releaseBed(allocationId, wardenUser, reason = '') {
    const target = await Allocation.findById(allocationId);
    if (!target) throw notFound('Allocation not found.');
    assertWardenHostelAccess(wardenUser, target.hostel);

    return runWithBedLockAndTx(target.bed, async ({ session }) => {
      const alloc = await Allocation.findById(allocationId).session(session);
      if (!alloc) throw notFound('Allocation not found.');
      if (alloc.allocationStatus !== 'Active') {
        throw conflict(`Only Active allocations can be released; current status is ${alloc.allocationStatus}.`);
      }

      alloc.allocationStatus = 'Released';
      alloc.releasedAt = new Date();
      alloc.releaseReason = reason.trim() || 'Released by Warden';
      await alloc.save({ session });

      await Booking.updateOne(
        { _id: alloc.booking, bookingStatus: 'Approved' },
        { $set: { bookingStatus: 'Cancelled', cancelledAt: new Date(), decisionNote: alloc.releaseReason } },
        { session }
      );

      await recomputeBedStatus(alloc.bed, session);

      await auditService.recordActivity({
        action: 'ALLOCATION_RELEASED',
        affectedModel: 'Allocation',
        affectedRecord: alloc.allocationId,
        details: { reason: alloc.releaseReason },
        actor: wardenUser,
        session,
      });

      return Allocation.findById(alloc._id)
        .populate('booking', 'bookingId bookingStatus')
        .populate('student', 'userId username fullName studentId')
        .populate('hostel', 'hostelId hostelName')
        .populate('room', 'roomId roomNumber')
        .populate('bed', 'bedId bedNumber bedStatus')
        .session(session);
    });
  }
}

export const allocationService = new AllocationService();
