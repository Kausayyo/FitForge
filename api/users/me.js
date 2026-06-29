const connectDB = require('../_lib/db');
const applyCors = require('../_lib/cors');
const { requireAuthWithUser } = require('../_lib/auth');
const User = require('../_lib/models/User');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;

  await connectDB();
  const user = await requireAuthWithUser(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    return res.json({ user });
  }

  if (req.method === 'PUT') {
    try {
      const allowedFields = ['name', 'age', 'weight', 'height', 'city', 'workType', 'habits', 'fitnessGoal', 'gender'];
      const updates = {};
      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      });

      if (updates.age) updates.age = parseInt(updates.age);
      if (updates.weight) updates.weight = parseFloat(updates.weight);
      if (updates.height) updates.height = parseFloat(updates.height);

      const updated = await User.findByIdAndUpdate(user.id, updates, { new: true }).select('-password');
      return res.json({ message: 'Profile updated', user: updated });
    } catch (error) {
      console.error('Update user error:', error);
      return res.status(500).json({ message: 'Failed to update profile' });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
};
