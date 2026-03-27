const { createRoom, findRoom, validateRoomPassword, getRoomHistory } = require('../services/roomService');
const { generateUsername } = require('../utils/generators');

/**
 * POST /api/v1/rooms
 * Create a new room with a user-supplied room ID and username.
 */
const createRoomHandler = async (req, res, next) => {
  try {
    const { roomId, username } = req.body;

    if (!roomId || !username) {
      return res.status(400).json({ message: 'Room ID and username are required.' });
    }

    // Validate: alphanumeric + hyphens/underscores, 3–20 chars
    const codeClean = roomId.trim().toUpperCase().replace(/\s+/g, '-');
    if (!/^[A-Z0-9_-]{3,20}$/.test(codeClean)) {
      return res.status(400).json({ message: 'Room ID must be 3–20 characters (letters, numbers, - _).' });
    }

    const usernameClean = username.trim().slice(0, 30);
    if (!usernameClean) {
      return res.status(400).json({ message: 'Username cannot be empty.' });
    }

    const result = await createRoom({ code: codeClean, username: usernameClean });
    res.status(201).json(result);
  } catch (err) {
    // Duplicate room code
    if (err.code === 11000 || err.message?.includes('already exists')) {
      return res.status(409).json({ message: 'That Room ID is already taken. Choose a different one.' });
    }
    next(err);
  }
};

/**
 * POST /api/v1/rooms/:code/join
 * Join an existing room with a user-supplied username.
 */
const joinRoomHandler = async (req, res, next) => {
  try {
    const { code }     = req.params;
    const { username } = req.body;

    if (!username?.trim()) {
      return res.status(400).json({ message: 'Username is required.' });
    }

    const room = await findRoom(code.toUpperCase());
    if (!room) return res.status(404).json({ message: 'Room not found or expired.' });

    if (room.activeUsers.length >= room.maxUsers) {
      return res.status(429).json({ message: 'Room is full.' });
    }

    const usernameClean = username.trim().slice(0, 30);
    res.json({ roomCode: room.code, username: usernameClean });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/rooms/:code
 * Get room metadata (no messages).
 */
const getRoomHandler = async (req, res, next) => {
  try {
    const room = await findRoom(req.params.code.toUpperCase());
    if (!room) return res.status(404).json({ message: 'Room not found.' });
    res.json({
      code: room.code,
      hasPassword: !!room.passwordHash,
      activeUsers: room.activeUsers.length,
      maxUsers: room.maxUsers,
      selfDestruct: room.selfDestruct,
      selfDestructAfter: room.selfDestructAfter,
      expiresAt: room.expiresAt,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/rooms/:code/messages?page=1&limit=50
 * Paginated message history (requires joining first — no auth check here for simplicity).
 */
const getRoomMessagesHandler = async (req, res, next) => {
  try {
    const { code } = req.params;
    const limit  = Math.min(parseInt(req.query.limit) || 50, 100);
    const page   = parseInt(req.query.page) || 1;

    const room = await findRoom(code.toUpperCase());
    if (!room) return res.status(404).json({ message: 'Room not found.' });

    const Message = require('../models/Message');
    const messages = await Message.find({ roomCode: code.toUpperCase() })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({ messages: messages.reverse(), page, limit });
  } catch (err) {
    next(err);
  }
};

module.exports = { createRoomHandler, joinRoomHandler, getRoomHandler, getRoomMessagesHandler };
