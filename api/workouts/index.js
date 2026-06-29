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

  const limit = parseInt(req.query.limit, 10) || 20;
  const logs = await WorkoutLog.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(limit);
  res.json({ logs, total: logs.length });
};
