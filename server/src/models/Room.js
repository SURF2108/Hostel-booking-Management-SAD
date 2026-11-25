import mongoose from 'mongoose';

export const ROOM_STATUSES = ['Available', 'Full', 'Maintenance', 'Inactive'];

const roomSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
    roomNumber: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1, max: 20 },
    roomStatus: { type: String, enum: ROOM_STATUSES, default: 'Available', index: true },
  },
  { timestamps: true }
);

roomSchema.index({ hostel: 1, roomNumber: 1 }, { unique: true });

export const Room = mongoose.model('Room', roomSchema);
