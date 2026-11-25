import { hostelService } from '../services/HostelService.js';
import { allocationService } from '../services/AllocationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * ManagementController aligned with class.png, SAD-component, and SAD-composite.
 */
export const managementController = {
  searchHostels: asyncHandler(async (req, res) => {
    const hostels = await hostelService.searchHostels(req.query);
    res.json({ hostels });
  }),

  getHostelDetail: asyncHandler(async (req, res) => {
    const hostel = await hostelService.getHostelDetail(req.params.id, req.query);
    res.json({ hostel });
  }),

  checkAvailability: asyncHandler(async (req, res) => {
    const result = await hostelService.checkAvailability(req.query);
    if (req.query.bedId) {
      res.json(result);
    } else {
      res.json({ beds: result });
    }
  }),

  createHostel: asyncHandler(async (req, res) => {
    const hostel = await hostelService.createHostel(req.body, req.user);
    res.status(201).json({ hostel });
  }),

  updateHostel: asyncHandler(async (req, res) => {
    const hostel = await hostelService.updateHostel(req.params.id, req.body, req.user);
    res.json({ hostel });
  }),

  deleteHostel: asyncHandler(async (req, res) => {
    const result = await hostelService.deleteHostel(req.params.id, req.user);
    res.json(result);
  }),

  createRoom: asyncHandler(async (req, res) => {
    const room = await hostelService.createRoom(req.params.hostelId, req.body, req.user);
    res.status(201).json({ room });
  }),

  updateRoom: asyncHandler(async (req, res) => {
    const room = await hostelService.updateRoom(req.params.roomId, req.body, req.user);
    res.json({ room });
  }),

  deleteRoom: asyncHandler(async (req, res) => {
    const result = await hostelService.deleteRoom(req.params.roomId, req.user);
    res.json(result);
  }),

  createBed: asyncHandler(async (req, res) => {
    const bed = await hostelService.createBed(req.params.roomId, req.body, req.user);
    res.status(201).json({ bed });
  }),

  updateBed: asyncHandler(async (req, res) => {
    const bed = await hostelService.updateBed(req.params.bedId, req.body, req.user);
    res.json({ bed });
  }),

  deleteBed: asyncHandler(async (req, res) => {
    const result = await hostelService.deleteBed(req.params.bedId, req.user);
    res.json(result);
  }),

  approveAndAllocate: asyncHandler(async (req, res) => {
    const allocation = await allocationService.approveAndAllocate(
      req.params.id,
      req.user,
      req.body?.decisionNote
    );
    res.json({ allocation });
  }),

  rejectBooking: asyncHandler(async (req, res) => {
    const booking = await allocationService.rejectBooking(
      req.params.id,
      req.user,
      req.body?.decisionNote
    );
    res.json({ booking });
  }),

  listAllocations: asyncHandler(async (req, res) => {
    const result = await allocationService.listAllocations(req.query, req.user);
    res.json(result);
  }),

  recordCheckIn: asyncHandler(async (req, res) => {
    const allocation = await allocationService.recordCheckIn(req.params.id, req.user);
    res.json({ allocation });
  }),

  recordCheckOut: asyncHandler(async (req, res) => {
    const allocation = await allocationService.recordCheckOut(req.params.id, req.user);
    res.json({ allocation });
  }),

  releaseBed: asyncHandler(async (req, res) => {
    const allocation = await allocationService.releaseBed(
      req.params.id,
      req.user,
      req.body?.reason
    );
    res.json({ allocation });
  }),
};
