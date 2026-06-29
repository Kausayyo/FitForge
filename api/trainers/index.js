const applyCors = require('../_lib/cors');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  // Stub — returns mock trainer list
  res.json({
    trainers: [
      { id: 't1', name: 'Rajesh Kumar', specializations: ['Strength', 'Powerlifting'], rating: 4.9, city: 'Hyderabad', hourlyRate: 800 },
      { id: 't2', name: 'Priya Sharma', specializations: ['Fat Loss', 'Nutrition'], rating: 4.8, city: 'Mumbai', hourlyRate: 900 },
      { id: 't3', name: 'Arjun Mehta', specializations: ['HIIT', 'Athletic Performance'], rating: 4.7, city: 'Bangalore', hourlyRate: 750 },
    ],
    total: 3,
    stub: true,
    message: 'Full trainer listing coming soon',
  });
};
