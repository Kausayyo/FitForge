const express = require('express');
const { protect } = require('../middleware/auth');
const router = express.Router();

// @route  GET /api/diet/plan
// @desc   Get personalized diet plan based on user profile
// @access Protected
router.get('/plan', protect, (req, res) => {
  const u = req.user;
  const weight = u.weight || 70;
  const height = u.height || 170;
  const age = u.age || 25;
  const gender = u.gender || 'male';
  const activity = u.workType || 'sedentary';
  const goal = u.fitnessGoal || 'general_fitness';

  const bmr = 10 * weight + 6.25 * height - 5 * age + (gender === 'male' ? 5 : -161);
  const mult = { sedentary: 1.2, light: 1.375, moderate: 1.55, heavy: 1.725 }[activity] || 1.3;
  const tdee = Math.round(bmr * mult);
  const calories = goal === 'weight_loss' ? tdee - 500 : goal === 'muscle_gain' ? tdee + 300 : tdee;
  const protein = Math.round(weight * 2);
  const fats = Math.round((calories * 0.28) / 9);
  const carbs = Math.round((calories - protein * 4 - fats * 9) / 4);

  const isVeg = (u.habits || []).includes('vegetarian');

  res.json({
    macros: { calories, protein, carbs, fats, tdee },
    meals: [
      { time: '8:00 AM', name: 'Breakfast', foods: isVeg ? ['Oats with milk', '2 boiled eggs or paneer', 'Black coffee'] : ['3 boiled eggs', 'Oats with milk', 'Black coffee'], calories: Math.round(calories * 0.25), protein: Math.round(protein * 0.25) },
      { time: '1:00 PM', name: 'Lunch', foods: isVeg ? ['Dal + rice', 'Curd', 'Salad'] : ['Chicken breast 150g', 'Rice', 'Salad'], calories: Math.round(calories * 0.35), protein: Math.round(protein * 0.35) },
      { time: '4:00 PM', name: 'Pre-Workout Snack', foods: isVeg ? ['Banana', 'Handful peanuts'] : ['Banana', 'Handful peanuts'], calories: Math.round(calories * 0.1), protein: Math.round(protein * 0.1) },
      { time: '8:00 PM', name: 'Dinner', foods: isVeg ? ['Paneer curry', '2 chapati', 'Vegetables'] : ['Fish or chicken 150g', '2 chapati', 'Vegetables'], calories: Math.round(calories * 0.3), protein: Math.round(protein * 0.3) },
    ],
  });
});

module.exports = router;
