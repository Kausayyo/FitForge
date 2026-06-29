const applyCors = require('../_lib/cors');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'PUT') return res.status(405).json({ message: 'Method not allowed' });

  // Stub — partner sharing toggle not yet implemented in serverless
  res.json({
    message: 'Partner sharing toggle coming soon',
    stub: true,
  });
};
