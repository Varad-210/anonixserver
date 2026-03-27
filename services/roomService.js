const bcrypt  = require('bcryptjs');
const Room    = require('../models/Room');
const Message = require('../models/Message');
const { generateRoomCode, generateUsername } = require('../utils/generators');

/**
 * Create a new room with a user-supplied code and username.
 * Throws if the code already exists (duplicate key).
 */
const createRoom = async ({ code, username, selfDestruct = false, selfDestructAfter = 30, maxUsers = 50 } = {}) => {
  const exists = await Room.exists({ code });
  if (exists) {
    const err = new Error('Room ID already exists.');
    err.code = 11000;
    throw err;
  }

  await Room.create({ code, selfDestruct, selfDestructAfter, maxUsers });
  return { roomCode: code, username };
};

/**
 * Find a room by code — returns null if not found.
 */
const findRoom = async (code) => {
  return Room.findOne({ code: code.toUpperCase() });
};

/**
 * Validate room password — returns true if no password set OR match.
 */
const validateRoomPassword = async (room, password) => {
  if (!room.passwordHash) return true;
  if (!password) return false;
  return bcrypt.compare(password, room.passwordHash);
};

/**
 * Add a user to a room's activeUsers array (no duplicates).
 */
const addUserToRoom = async (code, sessionId, username) => {
  await Room.updateOne(
    { code, 'activeUsers.sessionId': { $ne: sessionId } },
    { $push: { activeUsers: { sessionId, username } } }
  );
};

/**
 * Remove a user from a room's activeUsers array.
 */
const removeUserFromRoom = async (code, sessionId) => {
  await Room.updateOne({ code }, { $pull: { activeUsers: { sessionId } } });
};

/**
 * Get last N messages from a room (newest first from DB, returned oldest-first).
 */
const getRoomHistory = async (code, limit = 50) => {
  return Message.find({ roomCode: code })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Save a message. Handles self-destruct timestamp calculation.
 */
const saveMessage = async ({ roomCode, sessionId, username, content, type = 'text', fileUrl = null, fileName = null, fileSize = null }) => {
  const room = await Room.findOne({ code: roomCode }).lean();

  let selfDestructAt = null;
  if (room?.selfDestruct && type !== 'system') {
    selfDestructAt = new Date(Date.now() + (room.selfDestructAfter || 30) * 1000);
  }

  const message = await Message.create({
    roomCode,
    sessionId,
    username,
    content,
    type,
    fileUrl,
    fileName,
    fileSize,
    selfDestructAt,
  });

  return message.toObject();
};

/**
 * Get analytics snapshot for admin dashboard.
 */
const getAdminStats = async () => {
  const [totalRooms, totalMessages, activeRooms] = await Promise.all([
    Room.countDocuments(),
    Message.countDocuments({ type: { $ne: 'system' } }),
    Room.countDocuments({ 'activeUsers.0': { $exists: true } }),
  ]);

  // DAU = distinct sessionIds in messages in last 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dauResult = await Message.aggregate([
    { $match: { createdAt: { $gte: since }, type: { $ne: 'system' } } },
    { $group: { _id: '$sessionId' } },
    { $count: 'dau' },
  ]);
  const dau = dauResult[0]?.dau || 0;

  return { totalRooms, totalMessages, activeRooms, dau };
};

module.exports = {
  createRoom,
  findRoom,
  validateRoomPassword,
  addUserToRoom,
  removeUserFromRoom,
  getRoomHistory,
  saveMessage,
  getAdminStats,
};
