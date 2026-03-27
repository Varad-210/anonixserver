const Admin   = require('../models/Admin');
const Room    = require('../models/Room');
const Message = require('../models/Message');
const { getAdminStats } = require('../services/roomService');

/**
 * POST /api/v1/admin/login
 */
const adminLogin = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password required.' });

    const admin = await Admin.findOne({ username });
    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    res.json({ token: admin.generateToken(), username: admin.username, role: admin.role });
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/admin/stats
 */
const getStats = async (req, res, next) => {
  try {
    const stats = await getAdminStats();
    res.json(stats);
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/admin/rooms?page=1&limit=20&search=
 */
const listRooms = async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
    const page   = parseInt(req.query.page) || 1;
    const search = req.query.search;

    const filter = search ? { code: { $regex: search.toUpperCase() } } : {};
    const [rooms, total] = await Promise.all([
      Room.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Room.countDocuments(filter),
    ]);

    res.json({ rooms, total, page, limit });
  } catch (err) { next(err); }
};

/**
 * DELETE /api/v1/admin/rooms/:code
 */
const deleteRoom = async (req, res, next) => {
  try {
    const { code } = req.params;
    await Promise.all([
      Room.deleteOne({ code: code.toUpperCase() }),
      Message.deleteMany({ roomCode: code.toUpperCase() }),
    ]);
    res.json({ message: `Room ${code} and its messages deleted.` });
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/admin/messages?roomCode=&page=1
 */
const listMessages = async (req, res, next) => {
  try {
    const { roomCode } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const page  = parseInt(req.query.page) || 1;
    const filter = roomCode ? { roomCode: roomCode.toUpperCase(), type: { $ne: 'system' } } : { type: { $ne: 'system' } };

    const [messages, total] = await Promise.all([
      Message.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Message.countDocuments(filter),
    ]);

    res.json({ messages, total, page, limit });
  } catch (err) { next(err); }
};

/**
 * DELETE /api/v1/admin/messages/:id
 */
const deleteMessage = async (req, res, next) => {
  try {
    await Message.deleteOne({ _id: req.params.id });
    res.json({ message: 'Message deleted.' });
  } catch (err) { next(err); }
};

module.exports = { adminLogin, getStats, listRooms, deleteRoom, listMessages, deleteMessage };
