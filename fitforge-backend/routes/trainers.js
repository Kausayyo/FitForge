const express = require('express');
const { protect, premiumOnly } = require('../middleware/auth');
const { getTrainers, getTrainerById } = require('../data/trainers');
const Booking = require('../models/Booking');

const router = express.Router();

// @route  GET /api/trainers
router.get('/', protect, (req, res) => {
  const { city, specialization, maxRate, sessionType } = req.query;

  const filters = { city, specialization, maxRate: maxRate ? parseInt(maxRate) : null, sessionType };
  if (!filters.city && req.user.city) filters.city = req.user.city;

  const allTrainers = getTrainers(filters);

  if (!req.user.isPremium) {
    return res.json({
      trainers: allTrainers.slice(0, 3).map((t) => ({
        ...t,
        bio: t.bio.substring(0, 80) + '…',
      })),
      total: allTrainers.length,
      isPremiumRequired: true,
      previewOnly: true,
      message: 'Upgrade to Premium to see all trainers and book sessions',
    });
  }

  res.json({ trainers: allTrainers, total: allTrainers.length, isPremiumRequired: false });
});

// @route  GET /api/trainers/:id
router.get('/:id', protect, (req, res) => {
  const trainer = getTrainerById(req.params.id);
  if (!trainer) return res.status(404).json({ message: 'Trainer not found' });

  if (!req.user.isPremium) {
    return res.json({
      trainer: {
        id: trainer.id,
        name: trainer.name,
        photo: trainer.photo,
        specializations: trainer.specializations,
        rating: trainer.rating,
        bio: trainer.bio.substring(0, 100) + '…',
        city: trainer.city,
        sessionTypes: trainer.sessionTypes,
        hourlyRate: trainer.hourlyRate,
        trialRate: trainer.trialRate,
      },
      isPremiumRequired: true,
      message: 'Upgrade to Premium to view full profile and book',
    });
  }

  res.json({ trainer, isPremiumRequired: false });
});

// @route  POST /api/trainers/:id/book
router.post('/:id/book', protect, premiumOnly, async (req, res) => {
  const trainer = getTrainerById(req.params.id);
  if (!trainer) return res.status(404).json({ message: 'Trainer not found' });

  const { sessionDate, sessionType } = req.body;
  if (!sessionDate || !sessionType)
    return res.status(400).json({ message: 'Session date and type are required' });

  if (!trainer.sessionTypes.includes(sessionType))
    return res.status(400).json({ message: `Trainer only offers: ${trainer.sessionTypes.join(', ')} sessions` });

  const booking = await Booking.create({
    userId: req.user._id,
    trainerId: trainer.id,
    sessionDate,
    sessionType: sessionType.toLowerCase().replace(/-/g, '_'),
  });

  res.status(201).json({
    message: 'Session booked successfully!',
    booking: {
      ...booking.toJSON(),
      trainerName: trainer.name,
      trainerPhoto: trainer.photo,
      sessionType,
      sessionDate,
    },
  });
});

module.exports = router;
