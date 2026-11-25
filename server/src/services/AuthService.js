import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { nextSequence } from '../models/Counter.js';
import { signSessionToken } from '../middleware/auth.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../utils/errors.js';
import { auditService } from './AuditService.js';

export class AuthService {
  async login({ identifier, password }) {
    const normalized = identifier.trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ username: normalized }, { email: normalized }],
    })
      .select('+passwordHash')
      .populate('assignedHostelId', 'hostelId hostelName');

    if (!user) {
      throw unauthorized('Invalid username/email or password.', 'INVALID_CREDENTIALS');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await auditService.recordActivity({
        action: 'AUTH_LOGIN_FAILED',
        affectedModel: 'User',
        affectedRecord: user.username,
        details: { reason: 'Invalid password' },
        actor: { _id: user._id, username: user.username, role: user.role },
      });
      throw unauthorized('Invalid username/email or password.', 'INVALID_CREDENTIALS');
    }

    if (user.accountStatus !== 'Active') {
      throw forbidden(`Account is ${user.accountStatus}. Contact an administrator.`, 'ACCOUNT_INACTIVE');
    }

    const token = signSessionToken(user);
    await auditService.recordActivity({
      action: 'AUTH_LOGIN_SUCCESS',
      affectedModel: 'User',
      affectedRecord: user.username,
      details: { role: user.role },
      actor: user,
    });

    const safeUser = user.toJSON();
    return { user: safeUser, token };
  }

  async registerStudent({ username, password, fullName, email, contactNumber }) {
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await User.findOne({
      $or: [{ username: normalizedUsername }, { email: normalizedEmail }],
    });
    if (existing) {
      throw conflict('Username or email address is already registered.', 'DUPLICATE_USER');
    }

    const userId = await nextSequence('user');
    const studentId = `STU-${String(userId).padStart(4, '0')}`;
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      userId,
      username: normalizedUsername,
      passwordHash,
      role: 'Student',
      accountStatus: 'Active',
      fullName: fullName.trim(),
      email: normalizedEmail,
      contactNumber: contactNumber.trim(),
      studentId,
    });

    await auditService.recordActivity({
      action: 'STUDENT_REGISTERED',
      affectedModel: 'User',
      affectedRecord: studentId,
      details: { username: normalizedUsername },
      actor: user,
    });

    const token = signSessionToken(user);
    return { user: user.toJSON(), token };
  }

  async logout(actor) {
    if (actor) {
      await auditService.recordActivity({
        action: 'AUTH_LOGOUT',
        affectedModel: 'User',
        affectedRecord: actor.username,
        details: { role: actor.role },
        actor,
      });
    }
  }

  async getProfile(userObjectId) {
    const user = await User.findById(userObjectId).populate('assignedHostelId', 'hostelId hostelName');
    if (!user) throw notFound('User profile not found.');
    return user.toJSON();
  }

  async updateProfile(userObjectId, payload) {
    const user = await User.findById(userObjectId).select('+passwordHash');
    if (!user) throw notFound('User profile not found.');

    if (payload.email && payload.email.toLowerCase() !== user.email) {
      const taken = await User.findOne({
        email: payload.email.toLowerCase(),
        _id: { $ne: user._id },
      });
      if (taken) {
        throw conflict('Email address is already in use.', 'DUPLICATE_EMAIL');
      }
      user.email = payload.email.toLowerCase();
    }

    if (payload.fullName !== undefined) user.fullName = payload.fullName;
    if (payload.contactNumber !== undefined) user.contactNumber = payload.contactNumber;

    if (payload.newPassword) {
      if (!payload.currentPassword) {
        throw badRequest('Current password is required to set a new password.', {
          currentPassword: 'Required',
        });
      }
      const matches = await bcrypt.compare(payload.currentPassword, user.passwordHash);
      if (!matches) {
        throw badRequest('Current password is incorrect.', {
          currentPassword: 'Incorrect current password',
        });
      }
      user.passwordHash = await bcrypt.hash(payload.newPassword, 10);
    }

    await user.save();

    await auditService.recordActivity({
      action: 'PROFILE_UPDATED',
      affectedModel: 'User',
      affectedRecord: user.username,
      details: { updatedFields: Object.keys(payload).filter((k) => !k.includes('Password')) },
      actor: user,
    });

    const refreshed = await User.findById(user._id).populate('assignedHostelId', 'hostelId hostelName');
    return refreshed.toJSON();
  }
}

export const authService = new AuthService();
