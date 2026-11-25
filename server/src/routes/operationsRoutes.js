import express from 'express';
import { operationsController } from '../controllers/operationsController.js';
import { adminController } from '../controllers/adminController.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { validateBody } from '../middleware/errorHandler.js';
import {
  createComplaintSchema,
  createPaymentSchema,
  createUserSchema,
  createVisitorSchema,
  generateReportSchema,
  updateComplaintSchema,
  updatePaymentSchema,
  updateUserSchema,
  updateVisitorStatusSchema,
} from '../validators/schemas.js';

const router = express.Router();

router.use(requireAuth);

// Dashboard
router.get('/dashboard', adminController.getDashboardSummary);

// Complaints
router.get(
  '/complaints',
  requireRoles('Student', 'Warden', 'Administrator', 'HostelManagement'),
  operationsController.listComplaints
);
router.post(
  '/complaints',
  requireRoles('Student'),
  validateBody(createComplaintSchema),
  operationsController.submitComplaint
);
router.patch(
  '/complaints/:id',
  requireRoles('Warden'),
  validateBody(updateComplaintSchema),
  operationsController.updateComplaint
);

// Visitors
router.get(
  '/visitors',
  requireRoles('Student', 'Warden', 'Administrator', 'HostelManagement'),
  operationsController.listVisitorRecords
);
router.post(
  '/visitors',
  requireRoles('Student', 'Warden'),
  validateBody(createVisitorSchema),
  operationsController.registerVisitor
);
router.patch(
  '/visitors/:id',
  requireRoles('Warden'),
  validateBody(updateVisitorStatusSchema),
  operationsController.updateVisitorRecord
);

// Payments
router.get(
  '/payments',
  requireRoles('AccountsPersonnel', 'Student', 'HostelManagement'),
  operationsController.listPayments
);
router.post(
  '/payments',
  requireRoles('AccountsPersonnel'),
  validateBody(createPaymentSchema),
  operationsController.createPayment
);
router.patch(
  '/payments/:id',
  requireRoles('AccountsPersonnel'),
  validateBody(updatePaymentSchema),
  operationsController.updatePayment
);

// Users & Roles
router.get('/users', requireRoles('Administrator', 'Warden'), adminController.listUsers);
router.post(
  '/users',
  requireRoles('Administrator'),
  validateBody(createUserSchema),
  adminController.createUser
);
router.patch(
  '/users/:id',
  requireRoles('Administrator'),
  validateBody(updateUserSchema),
  adminController.updateUser
);

// Audit Logs
router.get('/audit-logs', requireRoles('Administrator', 'HostelManagement'), adminController.viewAuditLogs);

// Reports
router.get(
  '/reports',
  requireRoles('Administrator', 'AccountsPersonnel', 'HostelManagement'),
  adminController.listReports
);
router.post(
  '/reports',
  requireRoles('Administrator', 'AccountsPersonnel', 'HostelManagement'),
  validateBody(generateReportSchema),
  adminController.generateReport
);
router.get(
  '/reports/:id',
  requireRoles('Administrator', 'AccountsPersonnel', 'HostelManagement'),
  adminController.getReportById
);

// Historical Records Search
router.get(
  '/history',
  requireRoles('Warden', 'Administrator', 'HostelManagement'),
  adminController.searchHistory
);

export default router;
