const crypto = require('crypto');

/**
 * Generate a random 5-char uppercase alphanumeric room code.
 */
const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return code;
};

/**
 * Generate an anonymous username like ghost_X7K9
 */
const generateUsername = () => {
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `ghost_${suffix}`;
};

/**
 * Generate a unique session ID
 */
const generateSessionId = () => crypto.randomUUID();

module.exports = { generateRoomCode, generateUsername, generateSessionId };
