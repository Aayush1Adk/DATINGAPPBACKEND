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
const upload = multer({ dest: "uploads/" }); // temp folder

router.use(protect);

router.post("/basic", updateBasicProfile);
router.post("/gender", updateGenderPreference);
router.post("/detailed", updateDetailedProfile);

// Use multer for photo upload
router.post("/photos", upload.array("photos", 5), uploadPhotos);

router.get("/me", getUserProfile);
router.get("/discover", getDiscoverProfiles);

export default router;