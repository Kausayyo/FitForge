const applyCors = require('../../_lib/cors');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  // Stub — trainer booking not yet implemented in serverless
  res.json({
    message: 'Trainer booking coming soon',
    stub: true,
  });
};
