const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const connectDB = require('../_lib/db');
const applyCors = require('../_lib/cors');
const User = require('../_lib/models/User');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'fitforge_secret_key', {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  await connectDB();

  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(401).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: 'Invalid email or password' });

    // Auto-expire premium if past expiry date
    if (user.isPremium && user.premiumExpiresAt && new Date(user.premiumExpiresAt) < new Date()) {
      await User.findByIdAndUpdate(user.id, { isPremium: false, premiumExpiresAt: null });
      user.isPremium = false;
      user.premiumExpiresAt = null;
    }

    const token = generateToken(user.id);
    res.json({ message: 'Login successful', token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};
