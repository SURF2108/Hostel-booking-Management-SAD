import mongoose from 'mongoose';

export const BED_STATUSES = ['Available', 'Reserved', 'Occupied', 'Maintenance'];
export const MAINTENANCE_STATUSES = ['Operational', 'UnderMaintenance', 'OutOfService'];

const bedSchema = new mongoose.Schema(
  {
    bedId: { type: Number, required: true, unique: true, index: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
    bedNumber: { type: String, required: true, trim: true },
    bedStatus: { type: String, enum: BED_STATUSES, default: 'Available', index: true },
    maintenanceStatus: {
      type: String,
      enum: MAINTENANCE_STATUSES,
      default: 'Operational',
      index: true,
    },
    allocationVersion: { type: Number, default: 0 },
    allocationLock: { type: String, default: null },
  },
  { timestamps: true }
);

bedSchema.index({ room: 1, bedNumber: 1 }, { unique: true });

export const Bed = mongoose.model('Bed', bedSchema);
