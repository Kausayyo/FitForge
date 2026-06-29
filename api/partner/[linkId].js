const applyCors = require('../_lib/cors');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'DELETE') return res.status(405).json({ message: 'Method not allowed' });

  // Stub — partner unlink not yet implemented in serverless
  res.json({
    message: 'Partner unlink coming soon',
    stub: true,
  });
};
