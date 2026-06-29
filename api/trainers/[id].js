const applyCors = require('../_lib/cors');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  const { id } = req.query;

  // Stub — returns mock trainer detail
  res.json({
    trainer: { id, name: 'Trainer', specializations: [], rating: 0, city: 'Unknown' },
    stub: true,
    message: 'Full trainer details coming soon',
  });
};
