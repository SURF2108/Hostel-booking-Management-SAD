import mongoose from 'mongoose';

export const BOOKING_STATUSES = ['Pending', 'Approved', 'Rejected', 'Cancelled', 'Completed'];

const bookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bed: { type: mongoose.Schema.Types.ObjectId, ref: 'Bed', required: true, index: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    hostel: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
    requestDate: { type: Date, default: Date.now, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    bookingStatus: {
      type: String,
      enum: BOOKING_STATUSES,
      default: 'Pending',
      required: true,
      index: true,
    },
    notes: { type: String, trim: true, default: '' },
    reviewedByWarden: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    decisionNote: { type: String, trim: true, default: '' },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

bookingSchema.index({ bed: 1, bookingStatus: 1, startDate: 1, endDate: 1 });
bookingSchema.index({ student: 1, bookingStatus: 1, startDate: 1, endDate: 1 });

export const Booking = mongoose.model('Booking', bookingSchema);
