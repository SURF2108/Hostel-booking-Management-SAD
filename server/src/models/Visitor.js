import mongoose from 'mongoose';

const visitorSchema = new mongoose.Schema(
  {
    visitorId: { type: Number, required: true, unique: true, index: true },
    visitorName: { type: String, required: true, trim: true },
    contactNumber: { type: String, required: true, trim: true },
    identificationDetails: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const Visitor = mongoose.model('Visitor', visitorSchema);
