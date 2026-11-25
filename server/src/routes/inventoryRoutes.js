import express from 'express';
import { managementController } from '../controllers/managementController.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { validateBody } from '../middleware/errorHandler.js';
import {
  createBedSchema,
  createHostelSchema,
  createRoomSchema,
  updateBedSchema,
  updateHostelSchema,
  updateRoomSchema,
} from '../validators/schemas.js';

const router = express.Router();

router.use(requireAuth);

router.get('/hostels', managementController.searchHostels);
router.get('/hostels/:id', managementController.getHostelDetail);
router.get('/beds/availability', managementController.checkAvailability);

router.post(
  '/hostels',
  requireRoles('Administrator'),
  validateBody(createHostelSchema),
  managementController.createHostel
);
router.patch(
  '/hostels/:id',
  requireRoles('Administrator'),
  validateBody(updateHostelSchema),
  managementController.updateHostel
);
router.delete('/hostels/:id', requireRoles('Administrator'), managementController.deleteHostel);

router.post(
  '/hostels/:hostelId/rooms',
  requireRoles('Administrator'),
  validateBody(createRoomSchema),
  managementController.createRoom
);
router.patch(
  '/rooms/:roomId',
  requireRoles('Administrator'),
  validateBody(updateRoomSchema),
  managementController.updateRoom
);
router.delete('/rooms/:roomId', requireRoles('Administrator'), managementController.deleteRoom);

router.post(
  '/rooms/:roomId/beds',
  requireRoles('Administrator'),
  validateBody(createBedSchema),
  managementController.createBed
);
router.patch(
  '/beds/:bedId',
  requireRoles('Administrator'),
  validateBody(updateBedSchema),
  managementController.updateBed
);
router.delete('/beds/:bedId', requireRoles('Administrator'), managementController.deleteBed);

export default router;
