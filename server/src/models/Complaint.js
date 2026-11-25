import mongoose from 'mongoose';

export const COMPLAINT_STATUSES = ['Open', 'InProgress', 'Resolved', 'Closed'];
export const COMPLAINT_CATEGORIES = ['Maintenance', 'Sanitation', 'Security', 'Utilities', 'Other'];

const complaintSchema = new mongoose.Schema(
  {
    complaintId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', default: null, index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
    category: { type: String, enum: COMPLAINT_CATEGORIES, default: 'Maintenance' },
    description: { type: String, required: true, trim: true },
    submissionDate: { type: Date, default: Date.now, required: true },
    complaintStatus: {
      type: String,
      enum: COMPLAINT_STATUSES,
      default: 'Open',
      required: true,
      index: true,
    },
    resolutionDetails: { type: String, trim: true, default: '' },
    handledByWarden: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Complaint = mongoose.model('Complaint', complaintSchema);
