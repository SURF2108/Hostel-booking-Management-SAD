import { complaintService } from '../services/ComplaintService.js';
import { visitorService } from '../services/VisitorService.js';
import { paymentService } from '../services/PaymentService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const operationsController = {
  submitComplaint: asyncHandler(async (req, res) => {
    const complaint = await complaintService.submitComplaint(req.body, req.user);
    res.status(201).json({ complaint });
  }),

  listComplaints: asyncHandler(async (req, res) => {
    const result = await complaintService.listComplaints(req.query, req.user);
    res.json(result);
  }),

  updateComplaint: asyncHandler(async (req, res) => {
    const complaint = await complaintService.updateComplaint(req.params.id, req.body, req.user);
    res.json({ complaint });
  }),

  registerVisitor: asyncHandler(async (req, res) => {
    const visitorRecord = await visitorService.registerVisitor(req.body, req.user);
    res.status(201).json({ visitorRecord });
  }),

  listVisitorRecords: asyncHandler(async (req, res) => {
    const result = await visitorService.listVisitorRecords(req.query, req.user);
    res.json(result);
  }),

  updateVisitorRecord: asyncHandler(async (req, res) => {
    const visitorRecord = await visitorService.updateVisitorRecord(
      req.params.id,
      req.body,
      req.user
    );
    res.json({ visitorRecord });
  }),

  createPayment: asyncHandler(async (req, res) => {
    const payment = await paymentService.createPaymentRecord(req.body, req.user);
    res.status(201).json({ payment });
  }),

  updatePayment: asyncHandler(async (req, res) => {
    const payment = await paymentService.updatePaymentRecord(req.params.id, req.body, req.user);
    res.json({ payment });
  }),

  listPayments: asyncHandler(async (req, res) => {
    const result = await paymentService.listPaymentRecords(req.query, req.user);
    res.json(result);
  }),
};
