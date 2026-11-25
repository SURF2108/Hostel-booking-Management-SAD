import { Report } from '../models/Report.js';
import { Hostel } from '../models/Hostel.js';
import { Room } from '../models/Room.js';
import { Bed } from '../models/Bed.js';
import { Booking } from '../models/Booking.js';
import { PaymentRecord } from '../models/PaymentRecord.js';
import { Complaint } from '../models/Complaint.js';
import { AuditLog } from '../models/AuditLog.js';
import { nextSequence } from '../models/Counter.js';
import { notFound } from '../utils/errors.js';
import { paginatedResponse, parsePagination } from '../utils/pagination.js';
import { auditService } from './AuditService.js';

export class ReportService {
  async generateReport(payload, actor) {
    const { reportType, reportPeriod, hostelId, startDate, endDate } = payload;
    const dateMatch = {};
    if (startDate || endDate) {
      if (startDate) dateMatch.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
        dateMatch.$lte = end;
      }
    }

    let summaryMetrics = {};
    let rows = [];

    if (reportType === 'Occupancy') {
      const hostelFilter = hostelId ? { _id: hostelId } : {};
      const hostels = await Hostel.find(hostelFilter).sort({ hostelId: 1 }).lean();
      const [rooms, beds] = await Promise.all([
        Room.find(hostelId ? { hostel: hostelId } : {}).lean(),
        Bed.find(hostelId ? { hostel: hostelId } : {}).lean(),
      ]);

      rows = hostels.map((h) => {
        const hBeds = beds.filter((b) => String(b.hostel) === String(h._id));
        const hRooms = rooms.filter((r) => String(r.hostel) === String(h._id));
        const available = hBeds.filter((b) => b.bedStatus === 'Available').length;
        const reserved = hBeds.filter((b) => b.bedStatus === 'Reserved').length;
        const occupied = hBeds.filter((b) => b.bedStatus === 'Occupied').length;
        const maintenance = hBeds.filter((b) => b.maintenanceStatus !== 'Operational').length;
        return {
          hostelId: h.hostelId,
          hostelName: h.hostelName,
          hostelType: h.hostelType,
          totalRooms: hRooms.length,
          totalBeds: hBeds.length,
          available,
          reserved,
          occupied,
          maintenance,
          occupancyPct: hBeds.length ? Math.round(((reserved + occupied) / hBeds.length) * 100) : 0,
        };
      });

      const totalBeds = rows.reduce((s, r) => s + r.totalBeds, 0);
      const occupiedOrReserved = rows.reduce((s, r) => s + r.occupied + r.reserved, 0);
      summaryMetrics = {
        totalHostels: rows.length,
        totalBeds,
        occupiedOrReserved,
        availableBeds: rows.reduce((s, r) => s + r.available, 0),
        overallOccupancyPct: totalBeds ? Math.round((occupiedOrReserved / totalBeds) * 100) : 0,
      };
    } else if (reportType === 'Bookings') {
      const filter = {};
      if (hostelId) filter.hostel = hostelId;
      if (Object.keys(dateMatch).length) filter.requestDate = dateMatch;
      const bookings = await Booking.find(filter)
        .populate('hostel', 'hostelId hostelName')
        .populate('student', 'studentId fullName')
        .lean();

      const byStatus = {};
      for (const b of bookings) {
        byStatus[b.bookingStatus] = (byStatus[b.bookingStatus] || 0) + 1;
      }
      summaryMetrics = { totalBookings: bookings.length, byStatus };
      rows = bookings.slice(0, 50).map((b) => ({
        bookingId: b.bookingId,
        student: b.student?.fullName || '',
        hostel: b.hostel?.hostelName || '',
        status: b.bookingStatus,
        startDate: b.startDate,
        endDate: b.endDate,
      }));
    } else if (reportType === 'Payments') {
      const filter = {};
      if (Object.keys(dateMatch).length) filter.paymentDate = dateMatch;
      const payments = await PaymentRecord.find(filter)
        .populate('booking', 'bookingId')
        .populate('student', 'studentId fullName')
        .lean();

      const totalCollectedMinor = payments
        .filter((p) => p.paymentStatus === 'Paid')
        .reduce((s, p) => s + p.amountMinor, 0);
      const totalPendingMinor = payments
        .filter((p) => p.paymentStatus === 'Pending')
        .reduce((s, p) => s + p.amountMinor, 0);
      const totalRefundedMinor = payments
        .filter((p) => p.paymentStatus === 'Refunded')
        .reduce((s, p) => s + p.amountMinor, 0);

      summaryMetrics = {
        totalRecords: payments.length,
        totalCollectedMinor,
        totalPendingMinor,
        totalRefundedMinor,
        currency: 'INR',
      };
      rows = payments.slice(0, 50).map((p) => ({
        paymentId: p.paymentId,
        reference: p.paymentReference,
        bookingId: p.booking?.bookingId || '',
        student: p.student?.fullName || '',
        amountMinor: p.amountMinor,
        status: p.paymentStatus,
        paymentDate: p.paymentDate,
      }));
    } else if (reportType === 'Complaints') {
      const filter = {};
      if (hostelId) filter.hostel = hostelId;
      if (Object.keys(dateMatch).length) filter.submissionDate = dateMatch;
      const complaints = await Complaint.find(filter)
        .populate('hostel', 'hostelId hostelName')
        .populate('student', 'studentId fullName')
        .lean();

      const byStatus = {};
      for (const c of complaints) {
        byStatus[c.complaintStatus] = (byStatus[c.complaintStatus] || 0) + 1;
      }
      summaryMetrics = { totalComplaints: complaints.length, byStatus };
      rows = complaints.slice(0, 50).map((c) => ({
        complaintId: c.complaintId,
        category: c.category,
        student: c.student?.fullName || '',
        hostel: c.hostel?.hostelName || 'General',
        status: c.complaintStatus,
        submissionDate: c.submissionDate,
      }));
    } else if (reportType === 'AuditSummary') {
      const filter = {};
      if (Object.keys(dateMatch).length) filter.timestamp = dateMatch;
      const logs = await AuditLog.find(filter).sort({ timestamp: -1 }).limit(100).lean();
      const byAction = {};
      for (const l of logs) {
        byAction[l.action] = (byAction[l.action] || 0) + 1;
      }
      summaryMetrics = { sampledEvents: logs.length, byAction };
      rows = logs.slice(0, 50).map((l) => ({
        logId: l.logId,
        action: l.action,
        affectedModel: l.affectedModel,
        affectedRecord: l.affectedRecord,
        actor: l.actorUsername,
        actorRole: l.actorRole,
        timestamp: l.timestamp,
      }));
    }

    const reportId = await nextSequence('report');
    const report = await Report.create({
      reportId,
      reportType,
      generatedAt: new Date(),
      reportPeriod,
      filters: { hostelId: hostelId || null, startDate: startDate || null, endDate: endDate || null },
      summaryMetrics,
      rows,
      generatedBy: actor._id,
    });

    await auditService.recordActivity({
      action: 'REPORT_GENERATED',
      affectedModel: 'Report',
      affectedRecord: String(report.reportId),
      details: { reportType, reportPeriod },
      actor,
    });

    return Report.findById(report._id).populate('generatedBy', 'userId username fullName role');
  }

  async listReports(query = {}) {
    const { page, limit, skip } = parsePagination(query, 20, 100);
    const filter = {};
    if (query.reportType && query.reportType !== 'All') {
      filter.reportType = query.reportType;
    }

    const [items, total] = await Promise.all([
      Report.find(filter)
        .sort({ generatedAt: -1, reportId: -1 })
        .skip(skip)
        .limit(limit)
        .populate('generatedBy', 'userId username fullName role')
        .lean(),
      Report.countDocuments(filter),
    ]);

    return paginatedResponse(items, total, page, limit);
  }

  async getReportById(id) {
    const report = await Report.findById(id)
      .populate('generatedBy', 'userId username fullName role')
      .lean();
    if (!report) throw notFound('Report not found.');
    return report;
  }
}

export const reportService = new ReportService();
