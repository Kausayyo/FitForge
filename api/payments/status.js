const applyCors = require('../_lib/cors');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

  // Stub — payment status not yet implemented in serverless
  res.json({
    isPremium: false,
    daysLeft: 0,
    trialUsed: false,
    trialPrice: 999,
    currency: '₹',
    stub: true,
    message: 'Payment status coming soon',
  });
};
