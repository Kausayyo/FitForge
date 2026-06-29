const applyCors = require('../_lib/cors');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  // Stub — partner sync cycle not yet implemented in serverless
  res.json({
    synced: false,
    stub: true,
    message: 'Partner sync cycle coming soon',
  });
};
