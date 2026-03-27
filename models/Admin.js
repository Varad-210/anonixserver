const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

const adminSchema = new mongoose.Schema({
  username:     { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role:         { type: String, default: 'admin', enum: ['admin', 'superadmin'] },
  createdAt:    { type: Date, default: Date.now },
});

adminSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

adminSchema.methods.generateToken = function () {
  return jwt.sign(
    { id: this._id, username: this.username, role: this.role },
    process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
};

adminSchema.statics.hashPassword = (plain) => bcrypt.hash(plain, 12);

module.exports = mongoose.model('Admin', adminSchema);
