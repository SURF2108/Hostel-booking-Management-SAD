import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    logId: { type: Number, required: true, unique: true, index: true },
    action: { type: String, required: true, trim: true, index: true },
    timestamp: { type: Date, default: Date.now, required: true, index: true },
    affectedModel: { type: String, required: true, trim: true, index: true },
    affectedRecord: { type: String, required: true, trim: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actorUsername: { type: String, default: 'system', trim: true },
    actorRole: { type: String, default: 'System', trim: true, index: true },
  },
  { timestamps: false }
);

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
