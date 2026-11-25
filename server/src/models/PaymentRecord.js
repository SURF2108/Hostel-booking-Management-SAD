import mongoose from 'mongoose';

export const PAYMENT_STATUSES = ['Pending', 'Paid', 'Failed', 'Refunded'];

const paymentRecordSchema = new mongoose.Schema(
  {
    paymentId: { type: Number, required: true, unique: true, index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'INR', trim: true, uppercase: true },
    paymentDate: { type: Date, default: Date.now, required: true },
    paymentReference: { type: String, required: true, unique: true, trim: true },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'Pending',
      required: true,
      index: true,
    },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

export const PaymentRecord = mongoose.model('PaymentRecord', paymentRecordSchema);
