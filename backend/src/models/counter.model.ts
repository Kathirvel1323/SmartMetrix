import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ICounter extends Document {
  key: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    seq: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

export const Counter: Model<ICounter> = mongoose.model<ICounter>('Counter', counterSchema);

/**
 * Atomically retrieves the next sequence number for a given prefix key.
 * Guarantees no duplicate sequence numbers during concurrent requests.
 *
 * Concurrency safety: When two requests race to create a brand-new counter
 * for the same region simultaneously, MongoDB may raise a duplicate-key error
 * on the upsert. We catch that error (code 11000) and retry the atomic
 * findOneAndUpdate once — at that point the document already exists and the
 * $inc succeeds cleanly, producing a unique, non-duplicate sequence number.
 */
export const getNextSequence = async (key: string, retried = false): Promise<number> => {
  try {
    const result = await Counter.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    return result.seq;
  } catch (err: any) {
    // MongoDB duplicate-key error code — can occur during first concurrent upsert
    if (err.code === 11000 && !retried) {
      return getNextSequence(key, true);
    }
    throw err;
  }
};
