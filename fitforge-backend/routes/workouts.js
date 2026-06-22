const express = require('express');
const { protect } = require('../middleware/auth');
const WorkoutLog = require('../models/WorkoutLog');

const router = express.Router();

// @route  POST /api/workouts/log
router.post('/log', protect, async (req, res) => {
  try {
    const { exerciseId, exerciseName, sets, durationMin, caloriesBurned, notes } = req.body;

    if (!exerciseName && !exerciseId)
      return res.status(400).json({ message: 'exerciseName or exerciseId is required' });

    const log = await WorkoutLog.create({
      userId: req.user._id,
      exerciseId: exerciseId || null,
      exerciseName: exerciseName || 'Unknown',
      sets: Array.isArray(sets) ? sets : [],
      durationMin: typeof durationMin === 'number' ? durationMin : parseFloat(durationMin) || 0,
      caloriesBurned: typeof caloriesBurned === 'number' ? caloriesBurned : parseFloat(caloriesBurned) || 0,
      notes: typeof notes === 'string' ? notes : '',
    });

    res.status(201).json({ message: 'Workout logged!', log });
  } catch (error) {
    console.error('Log workout error:', error);
    res.status(500).json({ message: 'Failed to log workout' });
  }
});

// @route  GET /api/workouts
router.get('/', protect, async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 20;
  const logs = await WorkoutLog.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(limit);
  res.json({ logs, total: logs.length });
});

// @route  GET /api/workouts/stats
router.get('/stats', protect, async (req, res) => {
  try {
    const logs = await WorkoutLog.find({ userId: req.user._id });
    const totalWorkouts = logs.length;
    const totalCalories = logs.reduce((s, l) => s + l.caloriesBurned, 0);
    const totalMinutes = logs.reduce((s, l) => s + l.durationMin, 0);
    const last7Days = logs.filter(
      (l) => Date.now() - new Date(l.createdAt) <= 7 * 24 * 60 * 60 * 1000
    ).length;
    res.json({ stats: { totalWorkouts, totalCalories, totalMinutes, last7Days } });
  } catch (error) {
    console.error('Workout stats error:', error);
    res.status(500).json({ message: 'Failed to compute stats' });
  }
});

module.exports = router;
