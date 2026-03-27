const jwt = require('jsonwebtoken');

const adminAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing admin token.' });
  }
  try {
    const token   = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired admin token.' });
  }
};

module.exports = adminAuth;
