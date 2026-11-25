import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

export const Counter = mongoose.model('Counter', counterSchema);

export async function nextSequence(name, session = null) {
  const options = { new: true, upsert: true };
  if (session) {
    options.session = session;
  }
  const doc = await Counter.findByIdAndUpdate(name, { $inc: { seq: 1 } }, options);
  return doc.seq;
}
