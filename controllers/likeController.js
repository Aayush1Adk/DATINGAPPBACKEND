import Swipe from '../models/Swipe.js';
import Match from '../models/Match.js';
import UserProfile from '../models/UserProfile.js';

// Send a like
export const sendLike = async (req, res) => {
  try {
    const userId = req.user._id.toString(); // From auth middleware
    const { targetUserId } = req.body;

    console.log(`💖 User ${userId} likes ${targetUserId}`);

    // Validate input
    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID is required'
      });
    }

    // Can't like yourself
    if (userId === targetUserId) {
      return res.status(400).json({
        success: false,
        message: "You can't like yourself"
      });
    }

    // Check if already swiped on this person
    const existingSwipe = await Swipe.findOne({ userId, targetUserId });
    if (existingSwipe) {
      return res.status(400).json({
        success: false,
        message: 'You already swiped on this person'
      });
    }

    // Create the swipe (like)
    await Swipe.create({
      userId,
      targetUserId,
      action: 'like'
    });

    console.log('✅ Like saved to database');

    // Check if target user also liked you (potential match)
    const reciprocalLike = await Swipe.findOne({
      userId: targetUserId,
      targetUserId: userId,
      action: { $in: ['like', 'superlike'] }
    });

    if (reciprocalLike) {
      console.log('🎉 IT\'S A MATCH!');

      // Ensure userA is always smaller ID to prevent duplicates
      const [userA, userB] = [userId, targetUserId].sort();

      // Check if match already exists
      let match = await Match.findOne({ userA, userB });

      if (!match) {
        // Create a match
        match = await Match.create({
          userA,
          userB,
          isActive: true
        });
      }

      // Get both user profiles for notification
      const [user1Profile, user2Profile] = await Promise.all([
        UserProfile.findOne({ userId }).select('firstName lastName'),
        UserProfile.findOne({ userId: targetUserId }).select('firstName lastName')
      ]);

      return res.status(200).json({
        success: true,
        isMatch: true,
        message: "It's a match!",
        match: {
          matchId: match._id,
          user: {
            id: targetUserId,
            firstName: user2Profile?.firstName,
            lastName: user2Profile?.lastName
          }
        }
      });
    }

    // No match yet, just a like
    return res.status(200).json({
      success: true,
      isMatch: false,
      message: 'Like sent successfully'
    });

  } catch (error) {
    console.error('❌ Error sending like:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send like',
      error: error.message
    });
  }
};

// Send a super like
export const sendSuperLike = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { targetUserId } = req.body;

    console.log(`⭐ User ${userId} super likes ${targetUserId}`);

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID is required'
      });
    }

    if (userId === targetUserId) {
      return res.status(400).json({
        success: false,
        message: "You can't super like yourself"
      });
    }

    const existingSwipe = await Swipe.findOne({ userId, targetUserId });
    if (existingSwipe) {
      return res.status(400).json({
        success: false,
        message: 'You already swiped on this person'
      });
    }

    // Create super like
    await Swipe.create({
      userId,
      targetUserId,
      action: 'superlike'
    });

    console.log('✅ Super like saved to database');

    // Check for match
    const reciprocalLike = await Swipe.findOne({
      userId: targetUserId,
      targetUserId: userId,
      action: { $in: ['like', 'superlike'] }
    });

    if (reciprocalLike) {
      console.log('🎉 SUPER LIKE MATCHED!');

      const [userA, userB] = [userId, targetUserId].sort();
      
      let match = await Match.findOne({ userA, userB });
      if (!match) {
        match = await Match.create({
          userA,
          userB,
          isActive: true
        });
      }

      const user2Profile = await UserProfile.findOne({ userId: targetUserId })
        .select('firstName lastName');

      return res.status(200).json({
        success: true,
        isMatch: true,
        isSuperLike: true,
        message: "It's a match!",
        match: {
          matchId: match._id,
          user: {
            id: targetUserId,
            firstName: user2Profile?.firstName,
            lastName: user2Profile?.lastName
          }
        }
      });
    }

    return res.status(200).json({
      success: true,
      isMatch: false,
      isSuperLike: true,
      message: 'Super like sent successfully'
    });

  } catch (error) {
    console.error('❌ Error sending super like:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send super like',
      error: error.message
    });
  }
};

// Pass on a profile (swipe left)
export const passProfile = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { targetUserId } = req.body;

    console.log(`👎 User ${userId} passes on ${targetUserId}`);

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID is required'
      });
    }

    const existingSwipe = await Swipe.findOne({ userId, targetUserId });
    if (existingSwipe) {
      return res.status(400).json({
        success: false,
        message: 'You already swiped on this person'
      });
    }

    // Create pass
    await Swipe.create({
      userId,
      targetUserId,
      action: 'dislike'
    });

    res.status(200).json({
      success: true,
      message: 'Profile passed'
    });

  } catch (error) {
    console.error('❌ Error passing profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to pass profile',
      error: error.message
    });
  }
};

// Get people who liked you
export const getLikesYou = async (req, res) => {
  try {
    const userId = req.user._id.toString();

    console.log(`💝 Getting likes for user ${userId}`);

    // Find all users who liked you
    const likes = await Swipe.find({
      targetUserId: userId,
      action: { $in: ['like', 'superlike'] }
    }).select('userId action createdAt');

    // Get user IDs who liked you
    const userIds = likes.map(like => like.userId);

    // Get their profiles
    const profiles = await UserProfile.find({
      userId: { $in: userIds }
    }).select('userId firstName lastName age address bio');

    res.status(200).json({
      success: true,
      count: profiles.length,
      likes: profiles
    });

  } catch (error) {
    console.error('❌ Error getting likes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get likes',
      error: error.message
    });
  }
};