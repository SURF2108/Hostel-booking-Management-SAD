import mongoose from 'mongoose';

export const ALLOCATION_STATUSES = ['Active', 'CheckedIn', 'CheckedOut', 'Released'];

const allocationSchema = new mongoose.Schema(
  {
    allocationId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    bed: { type: mongoose.Schema.Types.ObjectId, ref: 'Bed', required: true, index: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    allocatedByWarden: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    allocationDate: { type: Date, default: Date.now, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    allocationStatus: {
      type: String,
      enum: ALLOCATION_STATUSES,
      default: 'Active',
      required: true,
      index: true,
    },
    checkInTime: { type: Date, default: null },
    checkOutTime: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
    releaseReason: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

allocationSchema.index({ bed: 1, allocationStatus: 1, startDate: 1, endDate: 1 });

export const Allocation = mongoose.model('Allocation', allocationSchema);
