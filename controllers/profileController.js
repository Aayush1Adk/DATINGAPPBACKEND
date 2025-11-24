import UsersAuth from "../models/UsersAuth.js";
import UserProfile from "../models/UserProfile.js";
import UserPreferences from "../models/UserPreferences.js";
import UserPhoto from "../models/UserPhoto.js";
import Location from "../models/Location.js";
import cloudinary from "../config/cloudinary.js";

// Helper: compute age from DOB
function computeAge(dob) {
  if (!dob) return null;
  const b = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

// STEP 1: basic profile
export const updateBasicProfile = async (req, res) => {
  const { firstName, secondName, lastName, dateOfBirth } = req.body;
  const userId = req.user._id;

  try {
    if (!firstName || !lastName || !dateOfBirth) {
      return res.status(400).json({ success:false, message: "First name, last name, and date of birth are required" });
    }
    const dob = new Date(dateOfBirth);
    const age = computeAge(dob);
    if (age === null || age < 18) {
      return res.status(400).json({ success:false, message: "You must be at least 18 years old" });
    }

    let profile = await UserProfile.findOne({ userId });
    if (!profile) {
      profile = new UserProfile({ userId });
    }

    profile.firstName = firstName;
    profile.secondName = secondName || null;
    profile.lastName = lastName;
    profile.dateOfBirth = dob;
    profile.profileStep = Math.max(profile.profileStep || 1, 2);

    await profile.save();

    return res.json({ success:true, message: "Basic profile updated successfully", user: {
      firstName: profile.firstName, secondName: profile.secondName, lastName: profile.lastName,
      dateOfBirth: profile.dateOfBirth, profileStep: profile.profileStep
    }});
  } catch (error) {
    console.error("Error updateBasicProfile:", error);
    res.status(500).json({ success:false, message: "Failed to update profile" });
  }
};

// STEP 2: gender & preference (we store gender in profile and datePreference in preferences)
export const updateGenderPreference = async (req, res) => {
  const { gender } = req.body;
  const userId = req.user._id;
  try {
    if (!gender) return res.status(400).json({ success:false, message: "Gender is required" });
    const validGenders = ["male","female","gay","lesbian","bisexual","trans"];
    if (!validGenders.includes(gender)) return res.status(400).json({ success:false, message: "Invalid gender selection" });

    let profile = await UserProfile.findOne({ userId });
    if (!profile) {
      profile = new UserProfile({ userId });
    }
    profile.gender = gender;
    profile.profileStep = Math.max(profile.profileStep || 1, 3);
    await profile.save();

    // Ensure preferences doc exists
    let prefs = await UserPreferences.findOne({ userId });
    if (!prefs) {
      prefs = new UserPreferences({ userId });
      await prefs.save();
    }

    return res.json({ success:true, message: "Gender updated successfully", user: { gender: profile.gender, profileStep: profile.profileStep }});
  } catch (error) {
    console.error("Error updateGenderPreference:", error);
    res.status(500).json({ success:false, message: "Failed to update gender" });
  }
};

// STEP 3: detailed profile -> stored across profile and preferences
export const updateDetailedProfile = async (req, res) => {
  const { bio, gotra, profession, education, address, height, interests, datePreference } = req.body;
  const userId = req.user._id;

  try {
    if (!education || !address) {
      return res.status(400).json({ success:false, message: "Education and address are required" });
    }
    if (bio && bio.length > 250) {
      return res.status(400).json({ success:false, message: "Bio cannot exceed 250 characters" });
    }
    if (interests && interests.length > 6) {
      return res.status(400).json({ success:false, message: "You can select maximum 6 interests" });
    }
    if (height && (height < 100 || height > 250)) {
      return res.status(400).json({ success:false, message: "Height must be between 100-250 cm" });
    }
    if (datePreference && datePreference.length > 0) {
      const validPreferences = ["man","woman","gay","lesbian","bisexual","trans"];
      const invalid = datePreference.filter(p => !validPreferences.includes(p));
      if (invalid.length) return res.status(400).json({ success:false, message: "Invalid date preference(s)" });
    }

    let profile = await UserProfile.findOne({ userId });
    if (!profile) profile = new UserProfile({ userId });

    if (bio) profile.bio = bio;
    if (gotra) profile.gotra = gotra;
    if (profession) profile.profession = profession;
    if (education) profile.education = education;
    if (address) profile.address = address;
    if (height) profile.height = height;

    profile.profileComplete = true;
    profile.profileStep = Math.max(profile.profileStep || 1, 3);

    await profile.save();

    // preferences (interests/datePreference)
    let prefs = await UserPreferences.findOne({ userId });
    if (!prefs) prefs = new UserPreferences({ userId });

    if (interests) prefs.interests = interests;
    if (datePreference) prefs.datePreference = datePreference;

    await prefs.save();

    return res.json({ success:true, message: "Profile completed successfully!", user: {
      bio: profile.bio, gotra: profile.gotra, profession: profile.profession,
      education: profile.education, address: profile.address, height: profile.height,
      interests: prefs.interests, datePreference: prefs.datePreference, profileComplete: profile.profileComplete
    }});
  } catch (error) {
    console.error("Error updateDetailedProfile:", error);
    res.status(500).json({ success:false, message: "Failed to update profile" });
  }
};

// UPLOAD PHOTOS -> stores each photo as a UserPhoto doc and returns urls
export const uploadPhotos = async (req, res) => {
  const userId = req.user._id;
  // accept multipart files in req.files or base64 in req.body.photos (same as before)
  let photos = req.body.photos;
  if ((!photos || photos.length === 0) && req.files && req.files.length > 0) {
    photos = req.files.map(f => f.path);
  }

  try {
    if (!photos || photos.length === 0) return res.status(400).json({ success:false, message: "At least one photo is required" });
    if (photos.length > 5) return res.status(400).json({ success:false, message: "Maximum 5 photos allowed" });

    const uploadedPhotos = [];
    let failed = 0;

    // upload each file/base64 to Cloudinary
    for (let i=0; i<photos.length; i++) {
      try {
        const result = await cloudinary.uploader.upload(photos[i], {
          folder: "yugma/profiles",
          resource_type: "image",
          transformation: [{ width: 800, height: 1000, crop: "limit" }, { quality: "auto:good" }]
        });
        uploadedPhotos.push({ url: result.secure_url, publicId: result.public_id });
      } catch (err) {
        console.error("Cloudinary upload failed for photo:", i, err);
        failed++;
      }
    }

    if (uploadedPhotos.length === 0) return res.status(500).json({ success:false, message: "Failed to upload any photos" });

    // delete existing photos in DB + cloud if present
    const existing = await UserPhoto.find({ userId });
    if (existing && existing.length > 0) {
      for (const p of existing) {
        try {
          await cloudinary.uploader.destroy(p.publicId);
        } catch (err) {
          console.error("Failed to destroy old photo:", p.publicId, err);
        }
      }
      await UserPhoto.deleteMany({ userId });
    }

    // insert new photos
    const docs = uploadedPhotos.map((p, i) => ({ userId, url: p.url, publicId: p.publicId, order: i }));
    await UserPhoto.insertMany(docs);

    const urls = uploadedPhotos.map(p => p.url);
    return res.json({ success: failed === 0, message: failed === 0 ? `${uploadedPhotos.length} photo(s) uploaded successfully` : `Some photos failed`, photos: urls });
  } catch (error) {
    console.error("Error uploadPhotos:", error);
    res.status(500).json({ success:false, message: "Failed to upload photos" });
  }
};

// GET USER PROFILE (combines UsersAuth + UserProfile + UserPreferences + photos)
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const auth = await UsersAuth.findById(userId).select("email phone");
    if (!auth) return res.status(404).json({ success:false, message: "User not found" });

    const profile = await UserProfile.findOne({ userId });
    const prefs = await UserPreferences.findOne({ userId });
    const photos = await UserPhoto.find({ userId }).sort({ order: 1 });

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
        gender: profile?.gender || "",
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
        profileStep: profile?.profileStep || 1
      }
    });
  } catch (error) {
    console.error("Error getUserProfile:", error);
    res.status(500).json({ success:false, message: "Failed to fetch profile" });
  }
};

// DISCOVER: basic discover using profileComplete filter + pagination + optional geolocation
export const getDiscoverProfiles = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const currentUserId = req.user._id;

    // Basic approach: get user profiles where profileComplete = true and not current user
    const profiles = await UserProfile.find({ userId: { $ne: currentUserId }, profileComplete: true })
      .select("userId firstName lastName dateOfBirth gender bio gotra profession education address height")
      .skip(skip).limit(limit).lean();

    // Fetch photos and compute age
    const userIds = profiles.map(p => p.userId);
    const photos = await UserPhoto.find({ userId: { $in: userIds } }).lean();

    const photosByUser = photos.reduce((acc, p) => {
      acc[p.userId] = acc[p.userId] || [];
      acc[p.userId].push(p.url);
      return acc;
    }, {});

    // Attach interests & datePreference from prefs
    const prefs = await UserPreferences.find({ userId: { $in: userIds } }).lean();
    const prefsByUser = prefs.reduce((acc, p) => { acc[p.userId] = p; return acc; }, {});

    const results = profiles.map(u => {
      return {
        id: u.userId,
        firstName: u.firstName || "",
        lastName: u.lastName || "",
        age: computeAge(u.dateOfBirth),
        gender: u.gender || "",
        photos: photosByUser[u.userId] || [],
        bio: u.bio || "",
        gotra: u.gotra || "",
        profession: u.profession || "",
        education: u.education || "",
        address: u.address || "",
        height: u.height || null,
        interests: (prefsByUser[u.userId]?.interests) || [],
        datePreference: (prefsByUser[u.userId]?.datePreference) || [],
        profileComplete: !!u.profileComplete
      };
    });

    return res.json({ success:true, profiles: results, page, limit });
  } catch (error) {
    console.error("Error getDiscoverProfiles:", error);
    res.status(500).json({ success:false, message: "Failed to fetch discover profiles" });
  }
};
