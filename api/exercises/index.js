const applyCors = require('../_lib/cors');
const { exercises } = require('../_lib/data/exercises');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  const { category, difficulty, goal } = req.query;
  let result = [...exercises];

  if (category) result = result.filter((e) => e.category === category);
  if (difficulty) result = result.filter((e) => e.difficulty === difficulty);
  if (goal) result = result.filter((e) => e.goals.includes(goal));

  res.json({ exercises: result, total: result.length });
};
