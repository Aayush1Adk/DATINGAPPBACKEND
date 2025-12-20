import Match from "../models/Match.js";
import mongoose from "mongoose";

/**
 * Get a match by ID and verify the user is authorized
 * @param {string} matchId 
 * @param {string} userId 
 * @returns {Promise<Match|null>}
 */
export const getMatchById = async (matchId, userId) => {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(matchId)) {
      return null;
    }

    const match = await Match.findOne({
      _id: matchId,
      isActive: true,
      $or: [
        { userA: userId },
        { userB: userId }
      ]
    });

    return match;
  } catch (error) {
    console.error("getMatchById error:", error);
    return null;
  }
};

/**
 * Get all active matches for a user
 * @param {string} userId 
 * @returns {Promise<Match[]>}
 */
export const getUserMatches = async (userId) => {
  try {
    const matches = await Match.find({
      isActive: true,
      $or: [
        { userA: userId },
        { userB: userId }
      ]
    }).sort({ matchedAt: -1 });

    return matches;
  } catch (error) {
    console.error("getUserMatches error:", error);
    return [];
  }
};

/**
 * Create a new match between two users
 * @param {string} userAId 
 * @param {string} userBId 
 * @returns {Promise<Match|null>}
 */
export const createMatch = async (userAId, userBId) => {
  try {
    // Ensure userA is always the "smaller" ID to prevent duplicates
    const [smallerId, largerId] = [userAId, userBId].sort();

    // Check if match already exists
    const existingMatch = await Match.findOne({
      userA: smallerId,
      userB: largerId
    });

    if (existingMatch) {
      return existingMatch;
    }

    // Create new match
    const match = await Match.create({
      userA: smallerId,
      userB: largerId,
      isActive: true
    });

    return match;
  } catch (error) {
    console.error("createMatch error:", error);
    return null;
  }
};