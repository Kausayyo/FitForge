const jwt = require('jsonwebtoken');
const User = require('./models/User');

function getUser(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET || 'fitforge_secret_key');
  } catch (e) {
    return null;
  }
}

function requireAuth(req, res) {
  const user = getUser(req);
  if (!user) { res.status(401).json({ message: 'Unauthorized' }); return null; }
  return user;
}

/**
 * Full auth check that also loads the user document from MongoDB.
 * Returns the user document (minus password) or null (after sending 401).
 */
async function requireAuthWithUser(req, res) {
  const decoded = getUser(req);
  if (!decoded) { res.status(401).json({ message: 'Not authorized, no token' }); return null; }
  try {
    const user = await User.findById(decoded.id).select('-password');
    if (!user) { res.status(401).json({ message: 'User not found' }); return null; }
    return user;
  } catch (e) {
    res.status(401).json({ message: 'Not authorized, token failed' });
    return null;
  }
}

module.exports = { getUser, requireAuth, requireAuthWithUser };
