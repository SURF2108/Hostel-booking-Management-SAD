import mongoose from 'mongoose';

export const USER_ROLES = [
  'Student',
  'Warden',
  'Administrator',
  'AccountsPersonnel',
  'HostelManagement',
];

export const ACCOUNT_STATUSES = ['Active', 'Inactive', 'Suspended'];

const userSchema = new mongoose.Schema(
  {
    userId: { type: Number, unique: true, required: true, index: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, required: true, index: true },
    accountStatus: { type: String, enum: ACCOUNT_STATUSES, default: 'Active', index: true },

    // Shared display / profile metadata across concrete User subclasses
    fullName: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
    contactNumber: { type: String, trim: true, default: '' },

    // Role-specific attributes from class.png
    studentId: { type: String, trim: true, sparse: true, unique: true },
    wardenId: { type: String, trim: true, sparse: true, unique: true },
    assignedHostelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', default: null },
    adminId: { type: String, trim: true, sparse: true, unique: true },
    employeeId: { type: String, trim: true, sparse: true, unique: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const User = mongoose.model('User', userSchema);
