const mongoose = require('mongoose');

const activeUserSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  username:  { type: String, required: true },
  joinedAt:  { type: Date, default: Date.now },
}, { _id: false });

const roomSchema = new mongoose.Schema({
  code:            { type: String, required: true, unique: true, uppercase: true, trim: true },
  passwordHash:    { type: String, default: null },      // bcrypt hash; null = no password
  activeUsers:     { type: [activeUserSchema], default: [] },
  maxUsers:        { type: Number, default: 50 },
  selfDestruct:    { type: Boolean, default: false },    // delete messages after read
  selfDestructAfter: { type: Number, default: 30 },     // seconds until message vanishes
  createdAt:       { type: Date, default: Date.now },
  expiresAt:       { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
}, { timestamps: false });

// TTL index — MongoDB deletes room 24h after creation automatically
roomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Room', roomSchema);
