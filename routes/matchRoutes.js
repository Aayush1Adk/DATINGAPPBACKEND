import express from 'express';
import { getMatches, unmatch } from '../controllers/matchController.js';
import { protect } from '../middlewares/authMiddleware.js'; // ← FIXED PATH

const router = express.Router();

// All routes require authentication
router.use(protect);

// GET /api/matches - Get all matches
router.get('/', getMatches);

// DELETE /api/matches/:matchId - Unmatch
router.delete('/:matchId', unmatch);

export default router;