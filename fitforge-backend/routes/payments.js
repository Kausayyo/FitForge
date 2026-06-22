const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Payment = require('../models/Payment');

const router = express.Router();

const getRazorpayInstance = () => new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_PLACEHOLDER',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret',
});

const TRIAL_PRICE_PAISE = parseInt(process.env.TRIAL_PRICE_PAISE || '99900');
const TRIAL_DAYS = parseInt(process.env.TRIAL_DURATION_DAYS || '30');

// @route  POST /api/payments/create-order
router.post('/create-order', protect, async (req, res) => {
  try {
    if (req.user.isPremium)
      return res.status(400).json({ message: 'You already have an active premium subscription' });

    if (req.user.trialUsed)
      return res.status(400).json({
        message: 'Trial already used. Please purchase a full subscription.',
        trialUsed: true,
      });

    const { planType = 'trial' } = req.body;
    const amount = TRIAL_PRICE_PAISE;
    const razorpay = getRazorpayInstance();

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `fitforge_${req.user.id}_${Date.now()}`,
      notes: { userId: req.user.id, planType, userName: req.user.name, userEmail: req.user.email },
    });

    await Payment.create({
      userId: req.user._id,
      razorpayOrderId: order.id,
      amount,
      currency: 'INR',
      status: 'pending',
      planType,
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_PLACEHOLDER',
      userName: req.user.name,
      userEmail: req.user.email,
      description: `FitForge Premium – ${TRIAL_DAYS}-Day Trial`,
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Failed to create payment order', error: error.message });
  }
});

// @route  POST /api/payments/verify
router.post('/verify', protect, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature)
      return res.status(400).json({ message: 'Missing payment verification fields' });

    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret';
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== razorpaySignature)
      return res.status(400).json({ message: 'Payment verification failed: invalid signature' });

    const premiumExpiresAt = new Date();
    premiumExpiresAt.setDate(premiumExpiresAt.getDate() + TRIAL_DAYS);

    await User.findByIdAndUpdate(req.user.id, {
      isPremium: true,
      premiumExpiresAt,
      trialUsed: true,
    });

    await Payment.findOneAndUpdate(
      { razorpayOrderId },
      { status: 'paid', razorpayPaymentId, paidAt: new Date() }
    );

    res.json({
      message: 'Payment verified! Premium activated.',
      premiumExpiresAt: premiumExpiresAt.toISOString(),
      trialDays: TRIAL_DAYS,
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ message: 'Payment verification failed', error: error.message });
  }
});

// @route  GET /api/payments/status
router.get('/status', protect, (req, res) => {
  const { isPremium, premiumExpiresAt, trialUsed } = req.user;
  const now = new Date();
  const expiry = premiumExpiresAt ? new Date(premiumExpiresAt) : null;
  const daysLeft = expiry ? Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))) : 0;

  res.json({
    isPremium: isPremium && expiry && expiry > now,
    premiumExpiresAt,
    daysLeft,
    trialUsed,
    trialPrice: TRIAL_PRICE_PAISE / 100,
    currency: '₹',
  });
});

module.exports = router;
