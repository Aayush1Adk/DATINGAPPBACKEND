import mongoose from "mongoose";

const UserPreferencesSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "UsersAuth", required: true, unique: true },
  interests: { type: [String], default: [], validate: [arr => arr.length <= 6, "Max 6 interests"] },
  datePreference: { type: [String], enum: ['man','woman','gay','lesbian','bisexual','trans'], default: [] },
  preferredAgeRange: { min: { type: Number, default: 18 }, max: { type: Number, default: 100 } },
  preferredDistanceKm: { type: Number, default: 50 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

UserPreferencesSchema.pre("save", function(next){
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model("UserPreferences", UserPreferencesSchema, "UserPreferences");
