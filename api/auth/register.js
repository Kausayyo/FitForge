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
    const { name, email, password, age, weight, height, city, workType, habits, fitnessGoal } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email and password are required' });

    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(409).json({ message: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      age: age ? parseInt(age) : null,
      weight: weight ? parseFloat(weight) : null,
      height: height ? parseFloat(height) : null,
      city: city || null,
      workType: workType || 'sedentary',
      habits: habits || [],
      fitnessGoal: fitnessGoal || 'general_fitness',
    });

    const token = generateToken(user.id);
    res.status(201).json({ message: 'Account created successfully', token, user });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};
