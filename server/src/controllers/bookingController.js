import { bookingService } from '../services/BookingService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * BookingController aligned with class.png, SAD-component, SAD-sequence, and SAD-communication.
 */
export const bookingController = {
  submitBooking: asyncHandler(async (req, res) => {
    const booking = await bookingService.createBooking(req.body, req.user);
    res.status(201).json({ booking });
  }),

  listBookings: asyncHandler(async (req, res) => {
    const result = await bookingService.listBookings(req.query, req.user);
    res.json(result);
  }),

  getBookingById: asyncHandler(async (req, res) => {
    const booking = await bookingService.getBookingById(req.params.id, req.user);
    res.json({ booking });
  }),

  getStatus: asyncHandler(async (req, res) => {
    const booking = await bookingService.getBookingById(req.params.id, req.user);
    res.json({
      bookingId: booking.bookingId,
      bookingStatus: booking.bookingStatus,
      allocationStatus: booking.allocation?.allocationStatus || null,
    });
  }),

  cancelBooking: asyncHandler(async (req, res) => {
    const booking = await bookingService.cancelBooking(req.params.id, req.user, req.body?.reason);
    res.json({ booking });
  }),
};
