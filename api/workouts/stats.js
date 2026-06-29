const connectDB = require('../_lib/db');
const applyCors = require('../_lib/cors');
const { requireAuthWithUser } = require('../_lib/auth');
const WorkoutLog = require('../_lib/models/WorkoutLog');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  await connectDB();
  const user = await requireAuthWithUser(req, res);
  if (!user) return;

  try {
    const logs = await WorkoutLog.find({ userId: user._id });
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
};
