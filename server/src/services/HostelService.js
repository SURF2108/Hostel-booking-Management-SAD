import { Hostel } from '../models/Hostel.js';
import { Room } from '../models/Room.js';
import { Bed } from '../models/Bed.js';
import { Booking } from '../models/Booking.js';
import { Allocation } from '../models/Allocation.js';
import { nextSequence } from '../models/Counter.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { auditService } from './AuditService.js';

export function parseDateRange(startStr, endStr) {
  if (!startStr || !endStr) return null;
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw badRequest('Invalid startDate or endDate format.');
  }
  if (end <= start) {
    throw badRequest('endDate must be strictly after startDate.', {
      endDate: 'End date must be after start date',
    });
  }
  return { start, end };
}

export async function getUnavailableBedIdsForPeriod(start, end, { excludeBookingId = null, session = null } = {}) {
  const allocFilter = {
    allocationStatus: { $in: ['Active', 'CheckedIn'] },
    startDate: { $lt: end },
    endDate: { $gt: start },
  };
  const bookingFilter = {
    bookingStatus: 'Approved',
    startDate: { $lt: end },
    endDate: { $gt: start },
  };
  if (excludeBookingId) {
    bookingFilter._id = { $ne: excludeBookingId };
  }

  const [allocs, approvedBookings] = await Promise.all([
    Allocation.find(allocFilter).select('bed').session(session).lean(),
    Booking.find(bookingFilter).select('bed').session(session).lean(),
  ]);

  const set = new Set();
  for (const a of allocs) set.add(String(a.bed));
  for (const b of approvedBookings) set.add(String(b.bed));
  return set;
}

export class HostelService {
  async searchHostels(query = {}) {
    const filter = {};
    if (query.includeInactive !== 'true') {
      filter.isActive = true;
    }
    if (query.hostelType && query.hostelType !== 'All') {
      filter.hostelType = query.hostelType;
    }
    if (query.search) {
      const rx = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ hostelName: rx }, { hostelId: rx }, { address: rx }];
    }

    const range = query.startDate && query.endDate ? parseDateRange(query.startDate, query.endDate) : null;
    const hostels = await Hostel.find(filter).sort({ hostelId: 1 }).lean();
    const hostelIds = hostels.map((h) => h._id);

    const [rooms, beds, unavailableSet] = await Promise.all([
      Room.find({ hostel: { $in: hostelIds } }).lean(),
      Bed.find({ hostel: { $in: hostelIds } }).lean(),
      range ? getUnavailableBedIdsForPeriod(range.start, range.end) : Promise.resolve(null),
    ]);

    const roomMap = new Map(rooms.map((r) => [String(r._id), r]));

    return hostels.map((h) => {
      const hRooms = rooms.filter((r) => String(r.hostel) === String(h._id));
      const hBeds = beds.filter((b) => String(b.hostel) === String(h._id));
      const availableBeds = hBeds.filter((b) => {
        const room = roomMap.get(String(b.room));
        const roomOk = room && room.roomStatus !== 'Maintenance' && room.roomStatus !== 'Inactive';
        const maintOk = b.maintenanceStatus === 'Operational';
        if (!roomOk || !maintOk || !h.isActive) return false;
        if (unavailableSet) {
          return !unavailableSet.has(String(b._id));
        }
        return b.bedStatus === 'Available';
      });
      return {
        ...h,
        totalRooms: hRooms.length,
        totalBeds: hBeds.length,
        availableBedsCount: availableBeds.length,
      };
    });
  }

  async getHostelDetail(id, query = {}) {
    const hostel = await Hostel.findById(id).lean();
    if (!hostel) throw notFound('Hostel not found.');

    const range = query.startDate && query.endDate ? parseDateRange(query.startDate, query.endDate) : null;
    const [rooms, beds, unavailableSet] = await Promise.all([
      Room.find({ hostel: hostel._id }).sort({ roomNumber: 1 }).lean(),
      Bed.find({ hostel: hostel._id }).sort({ bedNumber: 1 }).lean(),
      range ? getUnavailableBedIdsForPeriod(range.start, range.end) : Promise.resolve(null),
    ]);

    const roomsWithBeds = rooms.map((room) => {
      const roomBeds = beds
        .filter((b) => String(b.room) === String(room._id))
        .map((b) => {
          const roomOk = room.roomStatus !== 'Maintenance' && room.roomStatus !== 'Inactive';
          const maintOk = b.maintenanceStatus === 'Operational';
          const periodAvailable = unavailableSet
            ? hostel.isActive && roomOk && maintOk && !unavailableSet.has(String(b._id))
            : hostel.isActive && roomOk && maintOk && b.bedStatus === 'Available';
          return {
            ...b,
            isAvailableForQuery: periodAvailable,
          };
        });
      return {
        ...room,
        beds: roomBeds,
        availableCount: roomBeds.filter((b) => b.isAvailableForQuery).length,
      };
    });

    return {
      ...hostel,
      rooms: roomsWithBeds,
    };
  }

  async checkAvailability({ hostelId, roomId, bedId, startDate, endDate }, session = null) {
    const range = startDate && endDate ? parseDateRange(startDate, endDate) : null;

    if (bedId) {
      const bed = await Bed.findById(bedId).populate('room').populate('hostel').session(session);
      if (!bed) throw notFound('Bed not found.');
      const roomOk = bed.room && bed.room.roomStatus !== 'Maintenance' && bed.room.roomStatus !== 'Inactive';
      const hostelOk = bed.hostel && bed.hostel.isActive;
      const maintOk = bed.maintenanceStatus === 'Operational';

      let conflictFound = false;
      let reason = null;
      if (!hostelOk) reason = 'Hostel is inactive';
      else if (!roomOk) reason = `Room is ${bed.room?.roomStatus || 'unavailable'}`;
      else if (!maintOk) reason = `Bed is ${bed.maintenanceStatus}`;
      else if (range) {
        const unavailableSet = await getUnavailableBedIdsForPeriod(range.start, range.end, { session });
        if (unavailableSet.has(String(bed._id))) {
          conflictFound = true;
          reason = 'Bed already has an overlapping allocation or approved booking for the selected dates';
        }
      } else if (bed.bedStatus !== 'Available') {
        conflictFound = true;
        reason = `Bed is currently ${bed.bedStatus}`;
      }

      return {
        available: hostelOk && roomOk && maintOk && !conflictFound,
        reason,
        bed,
      };
    }

    const bedFilter = {};
    if (hostelId) bedFilter.hostel = hostelId;
    if (roomId) bedFilter.room = roomId;

    const [beds, unavailableSet] = await Promise.all([
      Bed.find(bedFilter).populate('room').populate('hostel').sort({ bedId: 1 }).lean(),
      range ? getUnavailableBedIdsForPeriod(range.start, range.end) : Promise.resolve(null),
    ]);

    return beds.map((b) => {
      const hostelOk = b.hostel && b.hostel.isActive;
      const roomOk = b.room && b.room.roomStatus !== 'Maintenance' && b.room.roomStatus !== 'Inactive';
      const maintOk = b.maintenanceStatus === 'Operational';
      const free = unavailableSet
        ? !unavailableSet.has(String(b._id))
        : b.bedStatus === 'Available';
      return {
        ...b,
        isAvailable: Boolean(hostelOk && roomOk && maintOk && free),
      };
    });
  }

  async createHostel(payload, actor) {
    const seq = await nextSequence('hostel');
    const hostelId = (payload.hostelId || `HST-${String(seq).padStart(2, '0')}`).toUpperCase();
    const hostel = await Hostel.create({
      hostelId,
      hostelName: payload.hostelName,
      address: payload.address,
      hostelType: payload.hostelType,
      isActive: payload.isActive ?? true,
    });
    await auditService.recordActivity({
      action: 'HOSTEL_CREATED',
      affectedModel: 'Hostel',
      affectedRecord: hostel.hostelId,
      details: { hostelName: hostel.hostelName, hostelType: hostel.hostelType },
      actor,
    });
    return hostel;
  }

  async updateHostel(id, payload, actor) {
    const hostel = await Hostel.findById(id);
    if (!hostel) throw notFound('Hostel not found.');
    if (payload.hostelName !== undefined) hostel.hostelName = payload.hostelName;
    if (payload.address !== undefined) hostel.address = payload.address;
    if (payload.hostelType !== undefined) hostel.hostelType = payload.hostelType;
    if (payload.isActive !== undefined) hostel.isActive = payload.isActive;
    await hostel.save();
    await auditService.recordActivity({
      action: 'HOSTEL_UPDATED',
      affectedModel: 'Hostel',
      affectedRecord: hostel.hostelId,
      details: payload,
      actor,
    });
    return hostel;
  }

  async deleteHostel(id, actor) {
    const hostel = await Hostel.findById(id);
    if (!hostel) throw notFound('Hostel not found.');
    const activeAlloc = await Allocation.exists({
      hostel: hostel._id,
      allocationStatus: { $in: ['Active', 'CheckedIn'] },
    });
    if (activeAlloc) {
      throw conflict('Cannot delete a hostel with active or checked-in bed allocations.');
    }
    const roomCount = await Room.countDocuments({ hostel: hostel._id });
    if (roomCount > 0) {
      throw conflict('Remove rooms under this hostel before deleting it, or mark the hostel inactive.');
    }
    await hostel.deleteOne();
    await auditService.recordActivity({
      action: 'HOSTEL_DELETED',
      affectedModel: 'Hostel',
      affectedRecord: hostel.hostelId,
      details: { hostelName: hostel.hostelName },
      actor,
    });
    return { deleted: true, hostelId: hostel.hostelId };
  }

  async createRoom(hostelId, payload, actor) {
    const hostel = await Hostel.findById(hostelId);
    if (!hostel) throw notFound('Hostel not found.');
    const roomId = `RM-${hostel.hostelId}-${payload.roomNumber.toUpperCase()}`;
    const room = await Room.create({
      roomId,
      hostel: hostel._id,
      roomNumber: payload.roomNumber,
      capacity: payload.capacity,
      roomStatus: payload.roomStatus || 'Available',
    });
    await auditService.recordActivity({
      action: 'ROOM_CREATED',
      affectedModel: 'Room',
      affectedRecord: room.roomId,
      details: { hostelId: hostel.hostelId, capacity: room.capacity },
      actor,
    });
    return room;
  }

  async updateRoom(roomId, payload, actor) {
    const room = await Room.findById(roomId);
    if (!room) throw notFound('Room not found.');
    if (payload.roomNumber !== undefined) room.roomNumber = payload.roomNumber;
    if (payload.capacity !== undefined) {
      const existingBeds = await Bed.countDocuments({ room: room._id });
      if (payload.capacity < existingBeds) {
        throw conflict(`Room capacity (${payload.capacity}) cannot be less than existing beds (${existingBeds}).`);
      }
      room.capacity = payload.capacity;
    }
    if (payload.roomStatus !== undefined) room.roomStatus = payload.roomStatus;
    await room.save();
    await auditService.recordActivity({
      action: 'ROOM_UPDATED',
      affectedModel: 'Room',
      affectedRecord: room.roomId,
      details: payload,
      actor,
    });
    return room;
  }

  async deleteRoom(roomId, actor) {
    const room = await Room.findById(roomId);
    if (!room) throw notFound('Room not found.');
    const activeAlloc = await Allocation.exists({
      room: room._id,
      allocationStatus: { $in: ['Active', 'CheckedIn'] },
    });
    if (activeAlloc) throw conflict('Cannot delete room with active or checked-in allocations.');
    const bedCount = await Bed.countDocuments({ room: room._id });
    if (bedCount > 0) throw conflict('Remove beds in this room before deleting the room.');
    await room.deleteOne();
    await auditService.recordActivity({
      action: 'ROOM_DELETED',
      affectedModel: 'Room',
      affectedRecord: room.roomId,
      details: {},
      actor,
    });
    return { deleted: true, roomId: room.roomId };
  }

  async createBed(roomId, payload, actor) {
    const room = await Room.findById(roomId).populate('hostel');
    if (!room) throw notFound('Room not found.');
    const currentBedCount = await Bed.countDocuments({ room: room._id });
    if (currentBedCount >= room.capacity) {
      throw conflict(`Room ${room.roomNumber} is already at capacity (${room.capacity} beds).`);
    }
    const bedId = await nextSequence('bed');
    const bed = await Bed.create({
      bedId,
      room: room._id,
      hostel: room.hostel._id,
      bedNumber: payload.bedNumber,
      bedStatus: payload.bedStatus || 'Available',
      maintenanceStatus: payload.maintenanceStatus || 'Operational',
    });
    await auditService.recordActivity({
      action: 'BED_CREATED',
      affectedModel: 'Bed',
      affectedRecord: `${room.roomId}-${bed.bedNumber}`,
      details: { bedId: bed.bedId },
      actor,
    });
    return bed;
  }

  async updateBed(bedObjectId, payload, actor) {
    const bed = await Bed.findById(bedObjectId);
    if (!bed) throw notFound('Bed not found.');
    if (payload.bedNumber !== undefined) bed.bedNumber = payload.bedNumber;
    if (payload.maintenanceStatus !== undefined) {
      bed.maintenanceStatus = payload.maintenanceStatus;
      if (payload.maintenanceStatus !== 'Operational' && bed.bedStatus === 'Available') {
        bed.bedStatus = 'Maintenance';
      } else if (payload.maintenanceStatus === 'Operational' && bed.bedStatus === 'Maintenance') {
        bed.bedStatus = 'Available';
      }
    }
    if (payload.bedStatus !== undefined) {
      const hasActive = await Allocation.exists({
        bed: bed._id,
        allocationStatus: { $in: ['Active', 'CheckedIn'] },
      });
      if (hasActive && payload.bedStatus === 'Available') {
        throw conflict('Cannot set bedStatus to Available while an Active or CheckedIn allocation exists.');
      }
      bed.bedStatus = payload.bedStatus;
    }
    await bed.save();
    await auditService.recordActivity({
      action: 'BED_UPDATED',
      affectedModel: 'Bed',
      affectedRecord: String(bed.bedId),
      details: payload,
      actor,
    });
    return bed;
  }

  async deleteBed(bedObjectId, actor) {
    const bed = await Bed.findById(bedObjectId);
    if (!bed) throw notFound('Bed not found.');
    const activeAllocOrPending = await Promise.all([
      Allocation.exists({ bed: bed._id, allocationStatus: { $in: ['Active', 'CheckedIn'] } }),
      Booking.exists({ bed: bed._id, bookingStatus: { $in: ['Pending', 'Approved'] } }),
    ]);
    if (activeAllocOrPending[0] || activeAllocOrPending[1]) {
      throw conflict('Cannot delete bed with pending bookings or active allocations.');
    }
    await bed.deleteOne();
    await auditService.recordActivity({
      action: 'BED_DELETED',
      affectedModel: 'Bed',
      affectedRecord: String(bed.bedId),
      details: {},
      actor,
    });
    return { deleted: true, bedId: bed.bedId };
  }
}

export const hostelService = new HostelService();
