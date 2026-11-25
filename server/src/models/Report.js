import mongoose from 'mongoose';

export const REPORT_TYPES = ['Occupancy', 'Bookings', 'Payments', 'Complaints', 'AuditSummary'];

const reportSchema = new mongoose.Schema(
  {
    reportId: { type: Number, required: true, unique: true, index: true },
    reportType: { type: String, enum: REPORT_TYPES, required: true, index: true },
    generatedAt: { type: Date, default: Date.now, required: true, index: true },
    reportPeriod: { type: String, required: true, trim: true },
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
    summaryMetrics: { type: mongoose.Schema.Types.Mixed, default: {} },
    rows: { type: [mongoose.Schema.Types.Mixed], default: [] },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

export const Report = mongoose.model('Report', reportSchema);
