const connectDB = require('../_lib/db');
const applyCors = require('../_lib/cors');
const { requireAuthWithUser } = require('../_lib/auth');
const WorkoutLog = require('../_lib/models/WorkoutLog');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  await connectDB();
  const user = await requireAuthWithUser(req, res);
  if (!user) return;

  try {
    const { exerciseId, exerciseName, sets, durationMin, caloriesBurned, notes } = req.body;

    if (!exerciseName && !exerciseId)
      return res.status(400).json({ message: 'exerciseName or exerciseId is required' });

    const log = await WorkoutLog.create({
      userId: user._id,
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
};
