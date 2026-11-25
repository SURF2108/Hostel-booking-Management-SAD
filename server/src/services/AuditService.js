import { AuditLog } from '../models/AuditLog.js';
import { nextSequence } from '../models/Counter.js';
import { paginatedResponse, parsePagination } from '../utils/pagination.js';

export class AuditService {
  async recordActivity({
    action,
    affectedModel,
    affectedRecord,
    details = {},
    actor = null,
    session = null,
  }) {
    const logId = await nextSequence('auditLog', session);
    const payload = {
      logId,
      action,
      timestamp: new Date(),
      affectedModel,
      affectedRecord: String(affectedRecord),
      details,
      recordedBy: actor?._id || null,
      actorUsername: actor?.username || 'system',
      actorRole: actor?.role || 'System',
    };
    const [doc] = await AuditLog.create([payload], session ? { session } : {});
    return doc;
  }

  async viewLogs(query = {}) {
    const { page, limit, skip } = parsePagination(query, 25, 100);
    const filter = {};
    if (query.action) {
      filter.action = { $regex: query.action.trim(), $options: 'i' };
    }
    if (query.affectedModel) {
      filter.affectedModel = query.affectedModel.trim();
    }
    if (query.actorRole) {
      filter.actorRole = query.actorRole.trim();
    }
    if (query.search) {
      const rx = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ action: rx }, { affectedRecord: rx }, { actorUsername: rx }];
    }
    if (query.startDate || query.endDate) {
      filter.timestamp = {};
      if (query.startDate) filter.timestamp.$gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setUTCHours(23, 59, 59, 999);
        filter.timestamp.$lte = end;
      }
    }

    const [items, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1, logId: -1 })
        .skip(skip)
        .limit(limit)
        .populate('recordedBy', 'userId username fullName role')
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return paginatedResponse(items, total, page, limit);
  }
}

export const auditService = new AuditService();
