import Match from '../models/Match.js';
import UserProfile from '../models/UserProfile.js';

// Get all matches for current user
export const getMatches = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    
    console.log(`🔥 Getting matches for user ${userId}`);

    // Find all matches where user is either userA or userB
    const matches = await Match.find({
      $or: [
        { userA: userId },
        { userB: userId }
      ],
      isActive: true
    }).sort({ matchedAt: -1 });

    console.log(`Found ${matches.length} matches`);

    // Get the other user's profile for each match
    const matchesWithProfiles = await Promise.all(
      matches.map(async (match) => {
        // Determine which user is the "other" user
        const otherUserId = match.userA.toString() === userId 
          ? match.userB 
          : match.userA;

        // Get their profile
        const profile = await UserProfile.findOne({ userId: otherUserId })
          .select('userId firstName lastName age address profession bio');

        return {
          matchId: match._id,
          matchedAt: match.matchedAt,
          user: profile ? {
            id: profile.userId,
            firstName: profile.firstName,
            lastName: profile.lastName,
            age: profile.age,
            address: profile.address,
            profession: profile.profession,
            bio: profile.bio
          } : null
        };
      })
    );

    // Filter out matches where profile wasn't found
    const validMatches = matchesWithProfiles.filter(m => m.user !== null);

    res.status(200).json({
      success: true,
      count: validMatches.length,
      matches: validMatches
    });

  } catch (error) {
    console.error('❌ Error getting matches:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get matches',
      error: error.message
    });
  }
};

// Unmatch with a user
export const unmatch = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { matchId } = req.params;

    console.log(`💔 Unmatching: ${matchId}`);

    // Find the match
    const match = await Match.findById(matchId);

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    // Verify user is part of this match
    if (match.userA.toString() !== userId && match.userB.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You are not part of this match'
      });
    }

    // Set match as inactive (soft delete)
    match.isActive = false;
    await match.save();

    res.status(200).json({
      success: true,
      message: 'Unmatched successfully'
    });

  } catch (error) {
    console.error('❌ Error unmatching:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unmatch',
      error: error.message
    });
  }
};