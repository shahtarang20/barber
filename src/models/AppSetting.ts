import mongoose, { Schema } from "mongoose";

/** Platform-wide settings the admin can change (one document per key). */
const AppSettingSchema = new Schema(
  { key: { type: String, required: true, unique: true }, value: { type: Schema.Types.Mixed, required: true } },
  { timestamps: true }
);

export const AppSetting = mongoose.models.AppSetting || mongoose.model("AppSetting", AppSettingSchema);
