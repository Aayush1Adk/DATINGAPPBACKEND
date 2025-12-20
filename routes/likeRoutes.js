import express from 'express';
import { sendLike, sendSuperLike, passProfile, getLikesYou } from '../controllers/likeController.js';
import { protect } from '../middlewares/authMiddleware.js'; // ← FIXED PATH

const router = express.Router();

// All routes require authentication
router.use(protect);

// POST /api/likes/send - Send a like
router.post('/send', sendLike);

// POST /api/likes/super-like - Send a super like
router.post('/super-like', sendSuperLike);

// POST /api/likes/pass - Pass on a profile
router.post('/pass', passProfile);

// GET /api/likes/likes-you - Get people who liked you
router.get('/likes-you', getLikesYou);

export default router;