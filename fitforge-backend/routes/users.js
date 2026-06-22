const express = require('express');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Booking = require('../models/Booking');

const router = express.Router();

// @route  GET /api/users/me
router.get('/me', protect, (req, res) => {
  res.json({ user: req.user });
});

// @route  PUT /api/users/me
router.put('/me', protect, async (req, res) => {
  try {
    const allowedFields = ['name', 'age', 'weight', 'height', 'city', 'workType', 'habits', 'fitnessGoal', 'gender'];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (updates.age) updates.age = parseInt(updates.age);
    if (updates.weight) updates.weight = parseFloat(updates.weight);
    if (updates.height) updates.height = parseFloat(updates.height);

    const updated = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
    res.json({ message: 'Profile updated', user: updated });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// @route  GET /api/users/bookings
router.get('/bookings', protect, async (req, res) => {
  const bookings = await Booking.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json({ bookings });
});

module.exports = router;
