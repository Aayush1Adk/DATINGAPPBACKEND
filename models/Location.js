import mongoose from "mongoose";

const LocationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "UsersAuth", required: true, unique: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0,0] } // [lng, lat]
  },
  updatedAt: { type: Date, default: Date.now }
});

LocationSchema.index({ location: "2dsphere" }); // important for geo queries

LocationSchema.pre("save", function(next){
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model("Location", LocationSchema, "Location");
