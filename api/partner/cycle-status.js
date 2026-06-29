const applyCors = require('../_lib/cors');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  // Stub — partner cycle status not yet implemented in serverless
  res.json({
    linked: false,
    stub: true,
    message: 'Partner cycle status coming soon',
  });
};
