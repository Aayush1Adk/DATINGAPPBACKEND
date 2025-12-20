import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { getUserMatches } from "../services/match.service.js";
import { getMessagesByMatch } from "../services/message.service.js";

const router = express.Router();

// Get all matches for current user
router.get("/matches", protect, async (req, res) => {
  try {
    const matches = await getUserMatches(req.user._id);
    
    return res.json({
      success: true,
      matches
    });
  } catch (err) {
    console.error("Get matches error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch matches"
    });
  }
});

// Get messages for a specific match
router.get("/messages/:matchId", protect, async (req, res) => {
  try {
    const { matchId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;

    const messages = await getMessagesByMatch(matchId, limit, skip);
    
    return res.json({
      success: true,
      messages: messages.reverse() // Oldest first
    });
  } catch (err) {
    console.error("Get messages error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch messages"
    });
  }
});

export default router;