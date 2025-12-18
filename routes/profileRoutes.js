import express from "express";
import multer from "multer";
import { 
  updateBasicProfile, 
  updateGenderPreference, 
  updateDetailedProfile,
  uploadPhotos,
  getUserProfile,
  getDiscoverProfiles
} from "../controllers/profileController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * Multer configuration
 * - memoryStorage prevents files from being written to disk
 * - files live in req.files[].buffer
 */
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
  },
});

router.use(protect);

router.post("/basic", updateBasicProfile);
router.post("/gender", updateGenderPreference);
router.post("/detailed", updateDetailedProfile);

/**
 * Photo upload (Cloudinary)
 * field name: "photos"
 * max files: 5
 */
router.post("/photos", upload.array("photos", 5), uploadPhotos);

router.get("/me", getUserProfile);
router.get("/discover", getDiscoverProfiles);

export default router;
