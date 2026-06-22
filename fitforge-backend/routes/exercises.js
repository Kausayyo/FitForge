const express = require('express');
const { protect } = require('../middleware/auth');
const { exercises, getRecommendedExercises } = require('../data/exercises');

const router = express.Router();

// @route  GET /api/exercises
// @desc   Get all exercises (public)
router.get('/', (req, res) => {
  const { category, difficulty, goal } = req.query;
  let result = [...exercises];

  if (category) result = result.filter((e) => e.category === category);
  if (difficulty) result = result.filter((e) => e.difficulty === difficulty);
  if (goal) result = result.filter((e) => e.goals.includes(goal));

  res.json({ exercises: result, total: result.length });
});

// @route  GET /api/exercises/recommended
// @desc   Get recommended exercises based on logged-in user's profile
router.get('/recommended', protect, (req, res) => {
  const user = req.user;
  const profile = {
    fitnessGoal: user.fitnessGoal || 'general_fitness',
    workType: user.workType || 'sedentary',
    age: user.age || 30,
  };

  const recommended = getRecommendedExercises(profile);
  res.json({
    exercises: recommended,
    total: recommended.length,
    basedOn: profile,
  });
});

// @route  GET /api/exercises/:id
// @desc   Get single exercise by ID (public)
router.get('/:id', (req, res) => {
  const exercise = exercises.find((e) => e.id === req.params.id);
  if (!exercise) {
    return res.status(404).json({ message: 'Exercise not found' });
  }
  res.json({ exercise });
});

module.exports = router;
