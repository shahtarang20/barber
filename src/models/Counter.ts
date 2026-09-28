import mongoose, { Schema, Document } from "mongoose";

export interface ICounter extends Document<string> {
  _id: string; // The name of the collection we are tracking (e.g., 'barberId')
  seq: number; // The current sequence number
}

const CounterSchema: Schema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter =
  mongoose.models.Counter || mongoose.model<ICounter>("Counter", CounterSchema);
