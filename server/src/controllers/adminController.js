import { userService } from '../services/UserService.js';
import { auditService } from '../services/AuditService.js';
import { reportService } from '../services/ReportService.js';
import { historyService } from '../services/HistoryService.js';
import { dashboardService } from '../services/DashboardService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const adminController = {
  getDashboardSummary: asyncHandler(async (req, res) => {
    const summary = await dashboardService.getSummary(req.user);
    res.json(summary);
  }),

  listUsers: asyncHandler(async (req, res) => {
    const result = await userService.listUsers(req.query);
    res.json(result);
  }),

  createUser: asyncHandler(async (req, res) => {
    const user = await userService.createUser(req.body, req.user);
    res.status(201).json({ user });
  }),

  updateUser: asyncHandler(async (req, res) => {
    const user = await userService.updateUser(req.params.id, req.body, req.user);
    res.json({ user });
  }),

  viewAuditLogs: asyncHandler(async (req, res) => {
    const result = await auditService.viewLogs(req.query);
    res.json(result);
  }),

  generateReport: asyncHandler(async (req, res) => {
    const report = await reportService.generateReport(req.body, req.user);
    res.status(201).json({ report });
  }),

  listReports: asyncHandler(async (req, res) => {
    const result = await reportService.listReports(req.query);
    res.json(result);
  }),

  getReportById: asyncHandler(async (req, res) => {
    const report = await reportService.getReportById(req.params.id);
    res.json({ report });
  }),

  searchHistory: asyncHandler(async (req, res) => {
    const result = await historyService.searchRecords(req.query, req.user);
    res.json(result);
  }),
};
