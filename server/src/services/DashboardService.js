import { Hostel } from '../models/Hostel.js';
import { Room } from '../models/Room.js';
import { Bed } from '../models/Bed.js';
import { Booking } from '../models/Booking.js';
import { Allocation } from '../models/Allocation.js';
import { Complaint } from '../models/Complaint.js';
import { VisitorRecord } from '../models/VisitorRecord.js';
import { PaymentRecord } from '../models/PaymentRecord.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { Report } from '../models/Report.js';

export class DashboardService {
  async getSummary(actor) {
    if (actor.role === 'Student') {
      const [
        myBookingsCount,
        pendingBookingsCount,
        approvedBookingsCount,
        openComplaintsCount,
        upcomingVisitsCount,
        availableBedsCount,
        recentBookings,
      ] = await Promise.all([
        Booking.countDocuments({ student: actor._id }),
        Booking.countDocuments({ student: actor._id, bookingStatus: 'Pending' }),
        Booking.countDocuments({ student: actor._id, bookingStatus: 'Approved' }),
        Complaint.countDocuments({ student: actor._id, complaintStatus: { $in: ['Open', 'InProgress'] } }),
        VisitorRecord.countDocuments({ student: actor._id, visitStatus: { $in: ['Registered', 'CheckedIn'] } }),
        Bed.countDocuments({ bedStatus: 'Available', maintenanceStatus: 'Operational' }),
        Booking.find({ student: actor._id })
          .sort({ requestDate: -1 })
          .limit(5)
          .populate('hostel', 'hostelName hostelId')
          .populate('room', 'roomNumber')
          .populate('bed', 'bedNumber')
          .lean(),
      ]);

      return {
        role: actor.role,
        metrics: {
          myBookingsCount,
          pendingBookingsCount,
          approvedBookingsCount,
          openComplaintsCount,
          upcomingVisitsCount,
          availableBedsCount,
        },
        recentBookings,
      };
    }

    if (actor.role === 'Warden') {
      const hostelScope = actor.assignedHostelId
        ? { hostel: actor.assignedHostelId._id || actor.assignedHostelId }
        : {};
      const [
        pendingReviewsCount,
        activeAllocationsCount,
        checkedInCount,
        openComplaintsCount,
        registeredVisitorsCount,
        availableBedsCount,
        pendingBookings,
      ] = await Promise.all([
        Booking.countDocuments({ ...hostelScope, bookingStatus: 'Pending' }),
        Allocation.countDocuments({ ...hostelScope, allocationStatus: 'Active' }),
        Allocation.countDocuments({ ...hostelScope, allocationStatus: 'CheckedIn' }),
        Complaint.countDocuments({ ...hostelScope, complaintStatus: { $in: ['Open', 'InProgress'] } }),
        VisitorRecord.countDocuments({ ...hostelScope, visitStatus: { $in: ['Registered', 'CheckedIn'] } }),
        Bed.countDocuments({ ...hostelScope, bedStatus: 'Available', maintenanceStatus: 'Operational' }),
        Booking.find({ ...hostelScope, bookingStatus: 'Pending' })
          .sort({ requestDate: 1 })
          .limit(5)
          .populate('student', 'fullName studentId')
          .populate('hostel', 'hostelName')
          .populate('room', 'roomNumber')
          .populate('bed', 'bedNumber')
          .lean(),
      ]);

      return {
        role: actor.role,
        assignedHostel: actor.assignedHostelId || null,
        metrics: {
          pendingReviewsCount,
          activeAllocationsCount,
          checkedInCount,
          openComplaintsCount,
          registeredVisitorsCount,
          availableBedsCount,
        },
        pendingBookings,
      };
    }

    if (actor.role === 'AccountsPersonnel') {
      const [payments, totalBookings, reportsCount] = await Promise.all([
        PaymentRecord.find({}).lean(),
        Booking.countDocuments({ bookingStatus: { $in: ['Pending', 'Approved', 'Completed'] } }),
        Report.countDocuments({}),
      ]);

      const paidMinor = payments
        .filter((p) => p.paymentStatus === 'Paid')
        .reduce((s, p) => s + p.amountMinor, 0);
      const pendingMinor = payments
        .filter((p) => p.paymentStatus === 'Pending')
        .reduce((s, p) => s + p.amountMinor, 0);
      const failedCount = payments.filter((p) => p.paymentStatus === 'Failed').length;

      return {
        role: actor.role,
        metrics: {
          totalPaymentRecords: payments.length,
          paidMinor,
          pendingMinor,
          failedCount,
          eligibleBookingsCount: totalBookings,
          reportsCount,
        },
      };
    }

    // Administrator & HostelManagement
    const [
      hostelsCount,
      roomsCount,
      totalBeds,
      availableBeds,
      occupiedOrReservedBeds,
      usersCount,
      pendingBookingsCount,
      openComplaintsCount,
      auditEventsCount,
      reportsCount,
      paidPayments,
    ] = await Promise.all([
      Hostel.countDocuments({ isActive: true }),
      Room.countDocuments({}),
      Bed.countDocuments({}),
      Bed.countDocuments({ bedStatus: 'Available', maintenanceStatus: 'Operational' }),
      Bed.countDocuments({ bedStatus: { $in: ['Reserved', 'Occupied'] } }),
      User.countDocuments({ accountStatus: 'Active' }),
      Booking.countDocuments({ bookingStatus: 'Pending' }),
      Complaint.countDocuments({ complaintStatus: { $in: ['Open', 'InProgress'] } }),
      AuditLog.countDocuments({}),
      Report.countDocuments({}),
      PaymentRecord.find({ paymentStatus: 'Paid' }).select('amountMinor').lean(),
    ]);

    const revenueMinor = paidPayments.reduce((s, p) => s + p.amountMinor, 0);

    return {
      role: actor.role,
      metrics: {
        hostelsCount,
        roomsCount,
        totalBeds,
        availableBeds,
        occupiedOrReservedBeds,
        occupancyPct: totalBeds ? Math.round((occupiedOrReservedBeds / totalBeds) * 100) : 0,
        usersCount,
        pendingBookingsCount,
        openComplaintsCount,
        auditEventsCount,
        reportsCount,
        revenueMinor,
      },
    };
  }
}

export const dashboardService = new DashboardService();
