const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomCode:         { type: String, required: true, index: true },
  sessionId:        { type: String, required: true },
  username:         { type: String, required: true },
  // AES-encrypted content (plaintext for system messages)
  content:          { type: String, required: true },
  // 'text' | 'image' | 'video' | 'file' | 'audio' | 'system'
  type:             { type: String, default: 'text', enum: ['text','image','video','file','audio','system'] },
  // Cloudinary URL for media messages
  fileUrl:          { type: String, default: null },
  fileName:         { type: String, default: null },
  fileSize:         { type: Number, default: null },
  // delivery status
  status:           { type: String, default: 'sent', enum: ['sent','delivered','seen'] },
  // self-destruct: ISO timestamp after which message should be deleted
  selfDestructAt:   { type: Date, default: null },
  createdAt:        { type: Date, default: Date.now },
  // room TTL — messages expire with the room
  expiresAt:        { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
}, { timestamps: false });

messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Self-destruct TTL index (MongoDB will delete automatically)
messageSchema.index({ selfDestructAt: 1 }, { expireAfterSeconds: 0, sparse: true });

module.exports = mongoose.model('Message', messageSchema);
