// node migrations/migrate-users.js
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import UsersAuth from "../models/UsersAuth.js";
import UserProfile from "../models/UserProfile.js";
import UserPreferences from "../models/UserPreferences.js";
import UserPhoto from "../models/UserPhoto.js";
import Location from "../models/Location.js";

// connect to existing mongo (same as your config/db.js)
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) throw new Error("MONGO_URI not set in .env");
await mongoose.connect(MONGO_URI);

console.log("Connected to MongoDB for migration");

// Replace with the name of your current single collection (you used "Usersinfo")
const oldCollectionName = "Usersinfo";
const Old = mongoose.connection.collection(oldCollectionName);

const cursor = Old.find({});
let count = 0;
while (await cursor.hasNext()) {
  const doc = await cursor.next();
  try {
    // Create UsersAuth
    const authDoc = {
      email: doc.email,
      phone: doc.phone,
      password: doc.password, // already hashed in your current code
      otp: doc.otp || null,
      otpExpiresAt: doc.otpExpiresAt || null,
      verified: doc.verified || false
    };
    const usersAuth = await UsersAuth.create(authDoc);

    const userId = usersAuth._id;

    // Create UserProfile
    const profileDoc = {
      userId,
      firstName: doc.firstName || null,
      secondName: doc.secondName || null,
      lastName: doc.lastName || null,
      dateOfBirth: doc.dateOfBirth || null,
      gender: doc.gender || null,
      bio: doc.bio || null,
      gotra: doc.gotra || null,
      profession: doc.profession || null,
      education: doc.education || null,
      address: doc.address || null,
      height: doc.height || null,
      profileComplete: doc.profileComplete || false,
      profileStep: doc.profileStep || 1
    };
    await UserProfile.create(profileDoc);

    // Preferences
    const preferencesDoc = {
      userId,
      interests: doc.interests || [],
      datePreference: doc.datePreference || [],
      preferredAgeRange: { min: 18, max: 100 }
    };
    await UserPreferences.create(preferencesDoc);

    // Photos (if present)
    if (Array.isArray(doc.photos) && doc.photos.length > 0) {
      const photos = doc.photos.map((p, i) => ({
        userId,
        url: p.url,
        publicId: p.publicId,
        order: i
      }));
      await UserPhoto.insertMany(photos);
    }

    // Location: if you stored lat/lng inside doc.location or doc.latitude/longitude adapt here
    if (doc.location && doc.location.lat != null && doc.location.lng != null) {
      await Location.create({
        userId,
        location: { type: "Point", coordinates: [doc.location.lng, doc.location.lat] }
      });
    }

    count++;
    if (count % 50 === 0) console.log(`${count} users migrated`);
  } catch (err) {
    console.error("Failed to migrate doc _id:", doc._id, err);
  }
}

console.log(`Migration complete. ${count} users migrated.`);
await mongoose.disconnect();
process.exit(0);
