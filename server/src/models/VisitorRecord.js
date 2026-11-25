import mongoose from 'mongoose';

export const VISIT_STATUSES = ['Registered', 'CheckedIn', 'CheckedOut', 'Cancelled'];

const visitorRecordSchema = new mongoose.Schema(
  {
    visitRecordId: { type: Number, required: true, unique: true, index: true },
    visitor: { type: mongoose.Schema.Types.ObjectId, ref: 'Visitor', required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
    managedByWarden: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    visitDate: { type: Date, required: true, index: true },
    purpose: { type: String, trim: true, default: 'Family visit' },
    checkInTime: { type: Date, default: null },
    checkOutTime: { type: Date, default: null },
    visitStatus: {
      type: String,
      enum: VISIT_STATUSES,
      default: 'Registered',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

export const VisitorRecord = mongoose.model('VisitorRecord', visitorRecordSchema);
