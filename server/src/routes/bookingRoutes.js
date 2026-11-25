import express from 'express';
import { bookingController } from '../controllers/bookingController.js';
import { managementController } from '../controllers/managementController.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { validateBody } from '../middleware/errorHandler.js';
import {
  bookingDecisionSchema,
  cancelBookingSchema,
  createBookingSchema,
  releaseAllocationSchema,
} from '../validators/schemas.js';

const router = express.Router();

router.use(requireAuth);

// Bookings
router.get(
  '/bookings',
  requireRoles('Student', 'Warden', 'Administrator', 'AccountsPersonnel', 'HostelManagement'),
  bookingController.listBookings
);
router.post(
  '/bookings',
  requireRoles('Student'),
  validateBody(createBookingSchema),
  bookingController.submitBooking
);
router.get(
  '/bookings/:id',
  requireRoles('Student', 'Warden', 'Administrator', 'AccountsPersonnel', 'HostelManagement'),
  bookingController.getBookingById
);
router.get(
  '/bookings/:id/status',
  requireRoles('Student', 'Warden', 'Administrator', 'HostelManagement'),
  bookingController.getStatus
);
router.post(
  '/bookings/:id/cancel',
  requireRoles('Student'),
  validateBody(cancelBookingSchema),
  bookingController.cancelBooking
);
router.post(
  '/bookings/:id/approve',
  requireRoles('Warden'),
  validateBody(bookingDecisionSchema),
  managementController.approveAndAllocate
);
router.post(
  '/bookings/:id/reject',
  requireRoles('Warden'),
  validateBody(bookingDecisionSchema),
  managementController.rejectBooking
);

// Allocations
router.get(
  '/allocations',
  requireRoles('Warden', 'Administrator', 'HostelManagement'),
  managementController.listAllocations
);
router.post('/allocations/:id/check-in', requireRoles('Warden'), managementController.recordCheckIn);
router.post('/allocations/:id/check-out', requireRoles('Warden'), managementController.recordCheckOut);
router.post(
  '/allocations/:id/release',
  requireRoles('Warden'),
  validateBody(releaseAllocationSchema),
  managementController.releaseBed
);

export default router;
