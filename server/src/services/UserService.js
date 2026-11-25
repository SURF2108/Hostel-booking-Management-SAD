import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Hostel } from '../models/Hostel.js';
import { nextSequence } from '../models/Counter.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { paginatedResponse, parsePagination } from '../utils/pagination.js';
import { auditService } from './AuditService.js';

function roleCodePrefix(role) {
  switch (role) {
    case 'Student':
      return { field: 'studentId', prefix: 'STU' };
    case 'Warden':
      return { field: 'wardenId', prefix: 'WRD' };
    case 'Administrator':
      return { field: 'adminId', prefix: 'ADM' };
    case 'AccountsPersonnel':
      return { field: 'employeeId', prefix: 'ACC' };
    default:
      return null;
  }
}

export class UserService {
  async listUsers(query = {}) {
    const { page, limit, skip } = parsePagination(query, 20, 100);
    const filter = {};
    if (query.role) filter.role = query.role;
    if (query.accountStatus) filter.accountStatus = query.accountStatus;
    if (query.search) {
      const rx = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { username: rx },
        { fullName: rx },
        { email: rx },
        { studentId: rx },
        { wardenId: rx },
        { adminId: rx },
        { employeeId: rx },
      ];
    }

    const [items, total] = await Promise.all([
      User.find(filter)
        .sort({ userId: 1 })
        .skip(skip)
        .limit(limit)
        .populate('assignedHostelId', 'hostelId hostelName'),
      User.countDocuments(filter),
    ]);

    return paginatedResponse(
      items.map((u) => u.toJSON()),
      total,
      page,
      limit
    );
  }

  async createUser(payload, actor) {
    const normalizedUsername = payload.username.trim().toLowerCase();
    const normalizedEmail = payload.email ? payload.email.trim().toLowerCase() : undefined;

    const orClauses = [{ username: normalizedUsername }];
    if (normalizedEmail) orClauses.push({ email: normalizedEmail });

    const existing = await User.findOne({ $or: orClauses });
    if (existing) {
      throw conflict('Username or email already exists.', 'DUPLICATE_USER');
    }

    let assignedHostelId = null;
    if (payload.role === 'Warden' && payload.assignedHostelId) {
      const hostel = await Hostel.findById(payload.assignedHostelId);
      if (!hostel) {
        throw badRequest('Assigned hostel does not exist.', { assignedHostelId: 'Hostel not found' });
      }
      assignedHostelId = hostel._id;
    }

    const userId = await nextSequence('user');
    const passwordHash = await bcrypt.hash(payload.password, 10);

    const docData = {
      userId,
      username: normalizedUsername,
      passwordHash,
      role: payload.role,
      accountStatus: payload.accountStatus || 'Active',
      fullName: payload.fullName.trim(),
      email: normalizedEmail,
      contactNumber: payload.contactNumber?.trim() || '',
      assignedHostelId,
    };

    const roleMeta = roleCodePrefix(payload.role);
    if (roleMeta) {
      docData[roleMeta.field] = `${roleMeta.prefix}-${String(userId).padStart(4, '0')}`;
    }

    const user = await User.create(docData);
    await auditService.recordActivity({
      action: 'USER_CREATED',
      affectedModel: 'User',
      affectedRecord: user.username,
      details: { role: user.role, accountStatus: user.accountStatus },
      actor,
    });

    const populated = await User.findById(user._id).populate('assignedHostelId', 'hostelId hostelName');
    return populated.toJSON();
  }

  async updateUser(targetId, payload, actor) {
    const user = await User.findById(targetId);
    if (!user) throw notFound('User not found.');

    if (String(user._id) === String(actor._id)) {
      if (payload.role && payload.role !== 'Administrator') {
        throw badRequest('Administrators cannot remove their own Administrator role.');
      }
      if (payload.accountStatus && payload.accountStatus !== 'Active') {
        throw badRequest('Administrators cannot deactivate or suspend their own active account.');
      }
    }

    if (
      user.role === 'Administrator' &&
      user.accountStatus === 'Active' &&
      ((payload.role && payload.role !== 'Administrator') ||
        (payload.accountStatus && payload.accountStatus !== 'Active'))
    ) {
      const activeAdminCount = await User.countDocuments({
        role: 'Administrator',
        accountStatus: 'Active',
      });
      if (activeAdminCount <= 1) {
        throw conflict('At least one active Administrator must remain in the system.');
      }
    }

    if (payload.email && payload.email.toLowerCase() !== user.email) {
      const taken = await User.findOne({
        email: payload.email.toLowerCase(),
        _id: { $ne: user._id },
      });
      if (taken) throw conflict('Email address is already in use.', 'DUPLICATE_EMAIL');
      user.email = payload.email.toLowerCase();
    }

    if (payload.fullName !== undefined) user.fullName = payload.fullName;
    if (payload.contactNumber !== undefined) user.contactNumber = payload.contactNumber;
    if (payload.accountStatus !== undefined) user.accountStatus = payload.accountStatus;

    if (payload.role && payload.role !== user.role) {
      user.role = payload.role;
      const roleMeta = roleCodePrefix(payload.role);
      if (roleMeta && !user[roleMeta.field]) {
        user[roleMeta.field] = `${roleMeta.prefix}-${String(user.userId).padStart(4, '0')}`;
      }
      if (payload.role !== 'Warden') {
        user.assignedHostelId = null;
      }
    }

    if (payload.assignedHostelId !== undefined) {
      if (payload.assignedHostelId === null) {
        user.assignedHostelId = null;
      } else {
        const hostel = await Hostel.findById(payload.assignedHostelId);
        if (!hostel) {
          throw badRequest('Assigned hostel does not exist.', { assignedHostelId: 'Hostel not found' });
        }
        user.assignedHostelId = hostel._id;
      }
    }

    await user.save();

    await auditService.recordActivity({
      action: 'USER_UPDATED',
      affectedModel: 'User',
      affectedRecord: user.username,
      details: payload,
      actor,
    });

    const populated = await User.findById(user._id).populate('assignedHostelId', 'hostelId hostelName');
    return populated.toJSON();
  }
}

export const userService = new UserService();
