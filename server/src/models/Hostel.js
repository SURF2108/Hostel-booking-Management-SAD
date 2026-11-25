import mongoose from 'mongoose';

export const HOSTEL_TYPES = ['Boys', 'Girls', 'Co-Ed'];

const hostelSchema = new mongoose.Schema(
  {
    hostelId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    hostelName: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    hostelType: { type: String, enum: HOSTEL_TYPES, required: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const Hostel = mongoose.model('Hostel', hostelSchema);
