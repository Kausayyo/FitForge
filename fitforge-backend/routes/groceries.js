const express = require('express');
const { protect } = require('../middleware/auth');
const router = express.Router();

const GROCERY_LISTS = {
  Hyderabad: [
    { category: 'Protein', item: 'Chicken breast', qty: '500g/wk', price: 120 },
    { category: 'Protein', item: 'Eggs (30 pack)', qty: '30/wk', price: 200 },
    { category: 'Protein', item: 'Paneer', qty: '400g/wk', price: 150 },
    { category: 'Carbs', item: 'Basmati rice', qty: '1kg/wk', price: 85 },
    { category: 'Carbs', item: 'Oats', qty: '500g', price: 75 },
    { category: 'Carbs', item: 'Whole wheat bread', qty: '1 loaf', price: 40 },
    { category: 'Fats', item: 'Walnuts', qty: '200g', price: 110 },
    { category: 'Fats', item: 'Groundnut oil', qty: '500ml', price: 70 },
    { category: 'Vegetables', item: 'Mixed vegetables', qty: '1kg/wk', price: 75 },
    { category: 'Vegetables', item: 'Spinach', qty: '250g', price: 25 },
    { category: 'Vegetables', item: 'Tomatoes + Onions', qty: '500g each', price: 50 },
  ],
  Mumbai: [
    { category: 'Protein', item: 'Chicken breast', qty: '500g/wk', price: 135 },
    { category: 'Protein', item: 'Eggs (30 pack)', qty: '30/wk', price: 215 },
    { category: 'Protein', item: 'Paneer', qty: '400g/wk', price: 165 },
    { category: 'Carbs', item: 'Basmati rice', qty: '1kg/wk', price: 95 },
    { category: 'Carbs', item: 'Oats', qty: '500g', price: 80 },
    { category: 'Fats', item: 'Almonds', qty: '200g', price: 140 },
    { category: 'Vegetables', item: 'Mixed vegetables', qty: '1kg/wk', price: 90 },
  ],
};

// @route  GET /api/groceries
// @access Protected
router.get('/', protect, (req, res) => {
  const city = req.query.city || req.user.city || 'Hyderabad';
  const list = GROCERY_LISTS[city] || GROCERY_LISTS.Hyderabad;

  const byCat = {};
  list.forEach(({ category, item, qty, price }) => {
    if (!byCat[category]) byCat[category] = [];
    byCat[category].push({ item, quantity: qty, price_inr: price });
  });

  const totalWeekly = list.reduce((s, i) => s + i.price, 0);
  res.json({ city, grocery: byCat, totalWeeklyInr: totalWeekly, availableCities: Object.keys(GROCERY_LISTS) });
});

module.exports = router;
