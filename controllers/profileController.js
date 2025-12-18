// controllers/profileController.js

import fs from "fs/promises";
import mongoose from "mongoose";
import cloudinary from "../config/cloudinary.js";

import UsersAuth from "../models/UsersAuth.js";
import UserProfile from "../models/UserProfile.js";
import UserPreferences from "../models/UserPreferences.js";
import UserPhoto from "../models/UserPhoto.js";
import Location from "../models/Location.js";

// ---------------------- Constants ----------------------
const MAX_PHOTOS = 5;
const MAX_BIO_LEN = 250;
const MAX_INTERESTS = 6;
const MIN_AGE = 18;
const MIN_HEIGHT = 100;
const MAX_HEIGHT = 250;

// ---------------------- Utilities ----------------------
const computeAge = (dob) => {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const normalizeGenderInput = (val) => {
  if (!val) return null;
  const s = String(val).toLowerCase().trim();
  if (["male", "man"].includes(s)) return { profile: "male", pref: "man" };
  if (["female", "woman"].includes(s)) return { profile: "female", pref: "woman" };
  if (["gay"].includes(s)) return { profile: "gay", pref: "gay" };
  if (["lesbian"].includes(s)) return { profile: "lesbian", pref: "lesbian" };
  if (["bisexual", "bi"].includes(s)) return { profile: "bisexual", pref: "bisexual" };
  if (["trans", "transgender"].includes(s)) return { profile: "trans", pref: "trans" };
  return null;
};

const normalizeDatePreferenceArray = (arr = []) => {
  if (!Array.isArray(arr)) return [];
  const normalized = [];
  for (const a of arr) {
    const n = normalizeGenderInput(a);
    if (n && n.pref) normalized.push(n.pref);
  }
  return [...new Set(normalized)];
};

const profileGenderToApi = (g) => {
  if (!g) return null;
  const n = normalizeGenderInput(g);
  return n ? n.pref : null;
};

const isImageMime = (mimetype) => typeof mimetype === "string" && mimetype.startsWith("image/");

const removeLocalFile = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.unlink(filePath).catch(() => {});
  } catch {}
};

// ---------------------- STEP 1: Basic Profile ----------------------
export const updateBasicProfile = async (req, res) => {
  try {
    const { firstName, secondName, lastName, dateOfBirth } = req.body;
    const userId = req.user._id;

    if (!firstName || !lastName || !dateOfBirth) {
      return res.status(400).json({ success: false, message: "firstName, lastName and dateOfBirth are required" });
    }

    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) return res.status(400).json({ success: false, message: "Invalid dateOfBirth" });

    const age = computeAge(dob);
    if (!age || age < MIN_AGE) return res.status(400).json({ success: false, message: `You must be at least ${MIN_AGE} years old` });

    let profile = await UserProfile.findOne({ userId });
    if (!profile) profile = new UserProfile({ userId });

    profile.firstName = firstName.trim();
    profile.secondName = secondName ? secondName.trim() : null;
    profile.lastName = lastName.trim();
    profile.dateOfBirth = dob;
    profile.profileStep = Math.max(profile.profileStep || 1, 2);

    await profile.save();

    return res.json({
      success: true,
      message: "Basic profile updated",
      user: { firstName: profile.firstName, secondName: profile.secondName, lastName: profile.lastName, dateOfBirth: profile.dateOfBirth, age, profileStep: profile.profileStep },
    });
  } catch (err) {
    console.error("updateBasicProfile error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ---------------------- STEP 2: Gender & Preference ----------------------
export const updateGenderPreference = async (req, res) => {
  try {
    const { gender } = req.body;
    const userId = req.user._id;
    if (!gender) return res.status(400).json({ success: false, message: "Gender is required" });

    const normalized = normalizeGenderInput(gender);
    if (!normalized) return res.status(400).json({ success: false, message: "Invalid gender value" });

    let profile = await UserProfile.findOne({ userId });
    if (!profile) profile = new UserProfile({ userId });
    profile.gender = normalized.profile;
    profile.profileStep = Math.max(profile.profileStep || 1, 3);
    await profile.save();

    // Ensure preferences doc exists
    let prefs = await UserPreferences.findOne({ userId });
    if (!prefs) {
      prefs = new UserPreferences({ userId });
      await prefs.save();
    }

    return res.json({ success: true, message: "Gender updated", user: { gender: profileGenderToApi(profile.gender), profileStep: profile.profileStep } });
  } catch (err) {
    console.error("updateGenderPreference error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ---------------------- STEP 3: Detailed Profile ----------------------
export const updateDetailedProfile = async (req, res) => {
  try {
    const { bio, gotra, profession, education, address, height, interests, datePreference, preferredAgeRange, preferredDistanceKm, location } = req.body;
    const userId = req.user._id;

    if (!education || !address) return res.status(400).json({ success: false, message: "education and address are required" });
    if (bio && bio.length > MAX_BIO_LEN) return res.status(400).json({ success: false, message: `bio cannot exceed ${MAX_BIO_LEN} characters` });
    if (interests && (!Array.isArray(interests) || interests.length > MAX_INTERESTS)) return res.status(400).json({ success: false, message: `interests must be array max ${MAX_INTERESTS}` });
    if (height && (height < MIN_HEIGHT || height > MAX_HEIGHT)) return res.status(400).json({ success: false, message: `height must be between ${MIN_HEIGHT} and ${MAX_HEIGHT} cm` });

    const normalizedDatePref = normalizeDatePreferenceArray(datePreference);

    let profile = await UserProfile.findOne({ userId });
    if (!profile) profile = new UserProfile({ userId });

    if (bio !== undefined) profile.bio = bio;
    if (gotra !== undefined) profile.gotra = gotra;
    if (profession !== undefined) profile.profession = profession;
    profile.education = education;
    profile.address = address;
    if (height !== undefined) profile.height = Number(height);

    // If frontend provides location { lat, lng } store in Location collection (separate document)
    if (location && typeof location === "object" && location.lat != null && location.lng != null) {
      const coords = [Number(location.lng), Number(location.lat)];
      await Location.findOneAndUpdate(
        { userId },
        { userId, location: { type: "Point", coordinates: coords }, updatedAt: new Date() },
        { upsert: true, new: true }
      );
    }

    // Do not automatically mark complete here; completion depends on uploaded photos too (handled in uploadPhotos)
    profile.profileStep = Math.max(profile.profileStep || 1, 3);
    await profile.save();

    let prefs = await UserPreferences.findOne({ userId });
    if (!prefs) prefs = new UserPreferences({ userId });

    if (interests !== undefined) prefs.interests = Array.isArray(interests) ? interests.slice(0, MAX_INTERESTS) : [];
    if (normalizedDatePref.length > 0) prefs.datePreference = normalizedDatePref;
    if (preferredAgeRange) {
      prefs.preferredAgeRange.min = Number(preferredAgeRange.min) || prefs.preferredAgeRange.min;
      prefs.preferredAgeRange.max = Number(preferredAgeRange.max) || prefs.preferredAgeRange.max;
    }
    if (preferredDistanceKm !== undefined) prefs.preferredDistanceKm = Number(preferredDistanceKm) || prefs.preferredDistanceKm;

    await prefs.save();

    return res.json({
      success: true,
      message: "Detailed profile updated",
      user: {
        bio: profile.bio,
        gotra: profile.gotra,
        profession: profile.profession,
        education: profile.education,
        address: profile.address,
        height: profile.height,
        interests: prefs.interests,
        datePreference: prefs.datePreference,
        profileStep: profile.profileStep,
        profileComplete: !!profile.profileComplete,
      },
    });
  } catch (err) {
    console.error("updateDetailedProfile error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ---------------------- UPLOAD PHOTOS ----------------------
export const uploadPhotos = async (req, res) => {
  const userId = req.user._id;
  const files = req.files || [];
  const base64Photos = Array.isArray(req.body.photos) ? req.body.photos : [];

  try {
    const totalIncoming = files.length + base64Photos.length;

    if (totalIncoming === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one photo is required",
      });
    }

    if (totalIncoming > MAX_PHOTOS) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_PHOTOS} photos allowed`,
      });
    }

    for (const f of files) {
      if (!isImageMime(f.mimetype)) {
        return res.status(400).json({
          success: false,
          message: "Only image files are allowed",
        });
      }
    }

    const uploaded = [];

    const uploadFromBuffer = (buffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "yugma/profiles",
            resource_type: "image",
            transformation: [
              { width: 1200, height: 1200, crop: "limit" },
              { quality: "auto:good" },
            ],
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );

        stream.end(buffer);
      });
    };

    // Upload files from memory (multer)
    for (const f of files) {
      try {
        const result = await uploadFromBuffer(f.buffer);
        uploaded.push({
          url: result.secure_url,
          publicId: result.public_id,
        });
      } catch (err) {
        console.error("Cloudinary buffer upload failed:", err);
      }
    }

    // Upload base64 photos (if any)
    for (const b64 of base64Photos) {
      try {
        const result = await cloudinary.uploader.upload(b64, {
          folder: "yugma/profiles",
          resource_type: "image",
          transformation: [
            { width: 1200, height: 1200, crop: "limit" },
            { quality: "auto:good" },
          ],
        });

        uploaded.push({
          url: result.secure_url,
          publicId: result.public_id,
        });
      } catch (err) {
        console.error("Cloudinary base64 upload failed:", err);
      }
    }

    if (uploaded.length === 0) {
      return res.status(500).json({
        success: false,
        message: "Failed to upload any photos",
      });
    }

    // Remove old photos (best-effort)
    const existingPhotos = await UserPhoto.find({ userId }).lean();
    for (const p of existingPhotos) {
      if (p.publicId) {
        cloudinary.uploader.destroy(p.publicId).catch(() => {});
      }
    }

    await UserPhoto.deleteMany({ userId });

    // Save new photos
    const docs = uploaded.map((p, i) => ({
      userId,
      url: p.url,
      publicId: p.publicId,
      order: i,
    }));

    await UserPhoto.insertMany(docs);

    // Update profile status
    let profile = await UserProfile.findOne({ userId });
    if (!profile) profile = new UserProfile({ userId });

    profile.profileComplete = true;
    profile.profileStep = Math.max(profile.profileStep || 1, 4);
    await profile.save();

    return res.json({
      success: true,
      message: `${uploaded.length} photo(s) uploaded`,
      photos: uploaded.map((p) => p.url),
    });
  } catch (err) {
    console.error("uploadPhotos error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to upload photos",
    });
  }
};


// ---------------------- GET USER PROFILE ----------------------
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const auth = await UsersAuth.findById(userId).select("email phone");
    if (!auth) return res.status(404).json({ success: false, message: "User not found" });

    const profile = await UserProfile.findOne({ userId }).lean();
    const prefs = await UserPreferences.findOne({ userId }).lean();
    const photos = await UserPhoto.find({ userId }).sort({ order: 1 }).lean();
    const age = computeAge(profile?.dateOfBirth);

    return res.json({
      success: true,
      user: {
        id: auth._id,
        email: auth.email,
        phone: auth.phone,
        firstName: profile?.firstName || "",
        secondName: profile?.secondName || "",
        lastName: profile?.lastName || "",
        dateOfBirth: profile?.dateOfBirth || null,
        age,
        gender: profileGenderToApi(profile?.gender) || null,
        photos: photos.map(p => p.url),
        bio: profile?.bio || "",
        gotra: profile?.gotra || "",
        profession: profile?.profession || "",
        education: profile?.education || "",
        address: profile?.address || "",
        height: profile?.height || null,
        interests: prefs?.interests || [],
        datePreference: prefs?.datePreference || [],
        profileComplete: !!profile?.profileComplete,
        profileStep: profile?.profileStep || 1,
      },
    });
  } catch (err) {
    console.error("getUserProfile error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ---------------------- GET DISCOVER PROFILES ----------------------
/*
  Query params:
    page, limit
    lat, lng, maxDistanceKm  (optional)
    minAge, maxAge
    interests (comma-separated)
*/
export const getDiscoverProfiles = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const lat = req.query.lat ? Number(req.query.lat) : null;
    const lng = req.query.lng ? Number(req.query.lng) : null;
    const maxDistanceKm = req.query.maxDistanceKm ? Number(req.query.maxDistanceKm) : null;

    const minAge = req.query.minAge ? Number(req.query.minAge) : null;
    const maxAge = req.query.maxAge ? Number(req.query.maxAge) : null;

    const interestsFilter = req.query.interests ? String(req.query.interests).split(",").map(s => s.trim()).filter(Boolean) : [];

    // If lat/lng is provided, find nearby userIds via Location collection (avoid $geoNear complexities)
    let nearbyUserIds = null;
    if (lat !== null && lng !== null) {
      // default maxDistanceKm fallback to 50 if not provided
      const distanceKm = maxDistanceKm || 50;
      // earth radius in km
      const earthRadiusKm = 6378.1;
      const maxDistanceRadians = distanceKm / earthRadiusKm;

      // Find locations within spherical distance
      const locDocs = await Location.find({
        location: {
          $geoWithin: {
            $centerSphere: [[lng, lat], maxDistanceRadians],
          },
        },
      }).select("userId").lean();

      nearbyUserIds = locDocs.map(d => d.userId).filter(id => id && id.toString() !== currentUserId.toString());
      if (nearbyUserIds.length === 0) {
        // No nearby users — return empty page
        return res.json({ success: true, profiles: [], page, limit });
      }
    }

    // Build match filter for UserProfile
    const match = { profileComplete: true, userId: { $ne: currentUserId } };
    if (nearbyUserIds !== null) match.userId = { $in: nearbyUserIds };

    // Run aggregation on UserProfile, joining preferences and photos and auth
    const pipeline = [
      { $match: match },
      // Join UsersAuth to ensure verified accounts (collection name exactly as you reported)
      {
        $lookup: {
          from: "UsersAuth",
          localField: "userId",
          foreignField: "_id",
          as: "auth",
        }
      },
      { $unwind: "$auth" },
      { $match: { "auth.verified": true } },
      // Join preferences
      {
        $lookup: {
          from: "UserPreferences",
          localField: "userId",
          foreignField: "userId",
          as: "prefs"
        }
      },
      { $unwind: { path: "$prefs", preserveNullAndEmptyArrays: true } },
      // Join photos
      {
        $lookup: {
          from: "UserPhoto",
          localField: "userId",
          foreignField: "userId",
          as: "photos"
        }
      },
      // Compute age field in the pipeline using $$NOW
      {
        $addFields: {
          age: {
            $cond: [
              { $ifNull: ["$dateOfBirth", false] },
              {
                $floor: {
                  $divide: [
                    { $subtract: ["$$NOW", "$dateOfBirth"] },
                    1000 * 60 * 60 * 24 * 365
                  ]
                }
              },
              null
            ]
          }
        }
      },
      // Optional age filter
      ...(minAge !== null || maxAge !== null ? [{ $match: { age: (() => {
        const q = {};
        if (minAge !== null) q.$gte = minAge;
        if (maxAge !== null) q.$lte = maxAge;
        return q;
      })() } }] : []),
      // If interests provided — add sharedInterestsCount and sort by it
      ...(interestsFilter.length > 0 ? [
        {
          $addFields: {
            sharedInterestsCount: {
              $size: { $ifNull: [{ $setIntersection: ["$prefs.interests", interestsFilter] }, []] }
            }
          }
        },
        { $sort: { sharedInterestsCount: -1 } }
      ] : []),
      // Project only necessary fields and convert photos to array of urls (max 3)
      {
        $project: {
          _id: 0,
          userId: 1,
          firstName: 1,
          lastName: 1,
          dateOfBirth: 1,
          age: 1,
          gender: 1,
          bio: 1,
          profession: 1,
          education: 1,
          address: 1,
          height: 1,
          "prefs.interests": 1,
          "prefs.datePreference": 1,
          profileComplete: 1,
          photos: {
            $map: {
              input: { $slice: ["$photos", 3] },
              as: "p",
              in: "$$p.url"
            }
          }
        }
      },
      { $skip: skip },
      { $limit: limit }
    ];

    const docs = await UserProfile.aggregate(pipeline).allowDiskUse(true);

    // Map to frontend-friendly objects
    const results = docs.map(d => ({
      id: d.userId,
      firstName: d.firstName || "",
      lastName: d.lastName || "",
      age: d.age || computeAge(d.dateOfBirth),
      gender: profileGenderToApi(d.gender),
      photos: d.photos || [],
      bio: d.bio || "",
      profession: d.profession || "",
      education: d.education || "",
      address: d.address || "",
      height: d.height || null,
      interests: (d.prefs && d.prefs.interests) || [],
      datePreference: (d.prefs && d.prefs.datePreference) || [],
      profileComplete: !!d.profileComplete
    }));

    return res.json({ success: true, profiles: results, page, limit });
  } catch (err) {
    console.error("getDiscoverProfiles error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
