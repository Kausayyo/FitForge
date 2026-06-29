const applyCors = require('../_lib/cors');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  // Stub — payment order creation not yet implemented in serverless
  res.json({
    message: 'Payment order creation coming soon',
    stub: true,
  });
};
