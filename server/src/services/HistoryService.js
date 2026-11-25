import { Booking } from '../models/Booking.js';
import { Allocation } from '../models/Allocation.js';
import { Complaint } from '../models/Complaint.js';
import { VisitorRecord } from '../models/VisitorRecord.js';
import { PaymentRecord } from '../models/PaymentRecord.js';
import { paginatedResponse, parsePagination } from '../utils/pagination.js';

export class HistoryService {
  async searchRecords(query = {}, actor) {
    const { page, limit, skip } = parsePagination(query, 25, 100);
    const category = query.category || 'All';
    const search = (query.search || '').trim();
    const rx = search ? new RegExp(search, 'i') : null;
    const wardenHostel =
      actor.role === 'Warden' && actor.assignedHostelId
        ? actor.assignedHostelId._id || actor.assignedHostelId
        : null;

    const dateFilter = {};
    if (query.startDate) dateFilter.$gte = new Date(query.startDate);
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setUTCHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }
    const hasDate = Object.keys(dateFilter).length > 0;

    const results = [];

    if (category === 'All' || category === 'Bookings') {
      const f = {};
      if (wardenHostel) f.hostel = wardenHostel;
      if (hasDate) f.requestDate = dateFilter;
      if (rx) f.$or = [{ bookingId: rx }, { bookingStatus: rx }, { notes: rx }];
      const bookings = await Booking.find(f)
        .sort({ requestDate: -1 })
        .limit(100)
        .populate('student', 'username fullName studentId')
        .populate('hostel', 'hostelId hostelName')
        .lean();
      for (const b of bookings) {
        results.push({
          recordType: 'Booking',
          referenceId: b.bookingId,
          status: b.bookingStatus,
          date: b.requestDate,
          hostelName: b.hostel?.hostelName || '',
          subject: `${b.student?.fullName || 'Student'} (${b.student?.studentId || ''})`,
          summary: `${new Date(b.startDate).toISOString().slice(0, 10)} to ${new Date(b.endDate).toISOString().slice(0, 10)}`,
          entityId: b._id,
        });
      }
    }

    if (category === 'All' || category === 'Allocations') {
      const f = {};
      if (wardenHostel) f.hostel = wardenHostel;
      if (hasDate) f.allocationDate = dateFilter;
      if (rx) f.$or = [{ allocationId: rx }, { allocationStatus: rx }];
      const allocations = await Allocation.find(f)
        .sort({ allocationDate: -1 })
        .limit(100)
        .populate('student', 'fullName studentId')
        .populate('hostel', 'hostelName')
        .populate('room', 'roomNumber')
        .populate('bed', 'bedNumber')
        .lean();
      for (const a of allocations) {
        results.push({
          recordType: 'Allocation',
          referenceId: a.allocationId,
          status: a.allocationStatus,
          date: a.allocationDate,
          hostelName: a.hostel?.hostelName || '',
          subject: `${a.student?.fullName || 'Student'} - Room ${a.room?.roomNumber || ''} Bed ${a.bed?.bedNumber || ''}`,
          summary: a.checkOutTime
            ? `Checked out ${new Date(a.checkOutTime).toISOString().slice(0, 10)}`
            : a.checkInTime
              ? `Checked in ${new Date(a.checkInTime).toISOString().slice(0, 10)}`
              : `Active from ${new Date(a.startDate).toISOString().slice(0, 10)}`,
          entityId: a._id,
        });
      }
    }

    if (category === 'All' || category === 'Complaints') {
      const f = {};
      if (wardenHostel) f.hostel = wardenHostel;
      if (hasDate) f.submissionDate = dateFilter;
      if (rx) f.$or = [{ complaintId: rx }, { description: rx }, { complaintStatus: rx }];
      const complaints = await Complaint.find(f)
        .sort({ submissionDate: -1 })
        .limit(100)
        .populate('student', 'fullName studentId')
        .populate('hostel', 'hostelName')
        .lean();
      for (const c of complaints) {
        results.push({
          recordType: 'Complaint',
          referenceId: c.complaintId,
          status: c.complaintStatus,
          date: c.submissionDate,
          hostelName: c.hostel?.hostelName || 'General',
          subject: `${c.student?.fullName || 'Student'} (${c.category})`,
          summary: c.description.slice(0, 110),
          entityId: c._id,
        });
      }
    }

    if (category === 'All' || category === 'Visitors') {
      const f = {};
      if (wardenHostel) f.hostel = wardenHostel;
      if (hasDate) f.visitDate = dateFilter;
      if (rx) f.$or = [{ purpose: rx }, { visitStatus: rx }];
      const visits = await VisitorRecord.find(f)
        .sort({ visitDate: -1 })
        .limit(100)
        .populate('visitor', 'visitorName contactNumber')
        .populate('student', 'fullName studentId')
        .populate('hostel', 'hostelName')
        .lean();
      for (const v of visits) {
        results.push({
          recordType: 'Visitor',
          referenceId: `VST-${v.visitRecordId}`,
          status: v.visitStatus,
          date: v.visitDate,
          hostelName: v.hostel?.hostelName || '',
          subject: `${v.visitor?.visitorName || 'Visitor'} visiting ${v.student?.fullName || 'Student'}`,
          summary: v.purpose,
          entityId: v._id,
        });
      }
    }

    if ((category === 'All' || category === 'Payments') && actor.role !== 'Warden') {
      const f = {};
      if (hasDate) f.paymentDate = dateFilter;
      if (rx) f.$or = [{ paymentReference: rx }, { paymentStatus: rx }];
      const payments = await PaymentRecord.find(f)
        .sort({ paymentDate: -1 })
        .limit(100)
        .populate('booking', 'bookingId')
        .populate('student', 'fullName studentId')
        .lean();
      for (const p of payments) {
        results.push({
          recordType: 'Payment',
          referenceId: `PAY-${p.paymentId}`,
          status: p.paymentStatus,
          date: p.paymentDate,
          hostelName: p.booking?.bookingId || '',
          subject: `${p.student?.fullName || 'Student'} (${p.paymentReference})`,
          summary: `${(p.amountMinor / 100).toFixed(2)} ${p.currency}`,
          entityId: p._id,
        });
      }
    }

    results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const paged = results.slice(skip, skip + limit);
    return paginatedResponse(paged, results.length, page, limit);
  }
}

export const historyService = new HistoryService();
