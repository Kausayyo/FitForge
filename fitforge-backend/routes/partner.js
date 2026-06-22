const express = require('express');
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const PartnerLink = require('../models/PartnerLink');

const router = express.Router();

const VALID_PHASES = ['menstrual', 'follicular', 'ovulatory', 'luteal'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// @route  POST /api/partner/invite
// @desc   Invite a partner (by email) to receive cycle predictions
// @access Protected
router.post('/invite', protect, async (req, res) => {
  try {
    const { partnerEmail } = req.body;
    if (!partnerEmail || !EMAIL_RE.test(partnerEmail)) {
      return res.status(400).json({ message: 'A valid partner email is required' });
    }

    const email = partnerEmail.toLowerCase().trim();
    if (email === req.user.email.toLowerCase()) {
      return res.status(400).json({ message: 'You cannot invite yourself' });
    }

    const existing = await PartnerLink.findOne({
      userId: req.user._id,
      status: { $in: ['pending', 'accepted'] },
    });
    if (existing) {
      return res.status(400).json({ message: 'You already have an active partner link. Unlink first to invite someone new.' });
    }

    // Clean up any previously-declined link before creating a fresh one.
    await PartnerLink.deleteMany({ userId: req.user._id, status: 'declined' });

    const link = await PartnerLink.create({ userId: req.user._id, partnerEmail: email });
    res.status(201).json({ message: 'Invite sent', link });
  } catch (error) {
    console.error('Partner invite error:', error);
    res.status(500).json({ message: 'Server error sending invite' });
  }
});

// @route  GET /api/partner
// @desc   Get the caller's outgoing link (as sharer) and incoming invites (as recipient)
// @access Protected
router.get('/', protect, async (req, res) => {
  try {
    const asSharer = await PartnerLink.findOne({ userId: req.user._id }).populate('partnerId', 'name email');
    const asRecipient = await PartnerLink.find({ partnerEmail: req.user.email.toLowerCase() }).populate('userId', 'name email');
    res.json({ asSharer, asRecipient });
  } catch (error) {
    console.error('Partner fetch error:', error);
    res.status(500).json({ message: 'Server error fetching partner data' });
  }
});

// @route  POST /api/partner/respond
// @desc   Accept or decline an incoming partner invite
// @access Protected
router.post('/respond', protect, async (req, res) => {
  try {
    const { linkId, accept } = req.body;
    if (!linkId || !mongoose.Types.ObjectId.isValid(linkId)) {
      return res.status(404).json({ message: 'Invite not found' });
    }

    const link = await PartnerLink.findById(linkId);
    if (!link || link.partnerEmail !== req.user.email.toLowerCase() || link.status !== 'pending') {
      return res.status(404).json({ message: 'Invite not found' });
    }

    link.status = accept ? 'accepted' : 'declined';
    if (accept) link.partnerId = req.user._id;
    await link.save();

    res.json({ message: accept ? 'Connected' : 'Invite declined', link });
  } catch (error) {
    console.error('Partner respond error:', error);
    res.status(500).json({ message: 'Server error responding to invite' });
  }
});

// @route  PUT /api/partner/sharing
// @desc   Toggle whether cycle predictions are shared with the linked partner
// @access Protected
router.put('/sharing', protect, async (req, res) => {
  try {
    const link = await PartnerLink.findOne({ userId: req.user._id, status: 'accepted' });
    if (!link) {
      return res.status(404).json({ message: 'No active partner link' });
    }

    link.sharingEnabled = !!req.body.enabled;
    if (!link.sharingEnabled) {
      // Privacy: stop sharing means the partner immediately loses visibility —
      // wipe the stored prediction rather than leaving a stale snapshot.
      link.cyclePrediction = { nextPeriodDate: null, currentPhase: null, updatedAt: null };
    }
    await link.save();

    res.json({ message: 'Updated', link });
  } catch (error) {
    console.error('Partner sharing toggle error:', error);
    res.status(500).json({ message: 'Server error updating sharing preference' });
  }
});

// @route  POST /api/partner/sync-cycle
// @desc   Push the latest predicted next-period date + current phase to the partner link
// @access Protected
router.post('/sync-cycle', protect, async (req, res) => {
  try {
    const { nextPeriodDate, currentPhase } = req.body;
    if (!VALID_PHASES.includes(currentPhase) || isNaN(Date.parse(nextPeriodDate))) {
      return res.status(400).json({ message: 'Invalid prediction data' });
    }

    const link = await PartnerLink.findOne({ userId: req.user._id, status: 'accepted', sharingEnabled: true });
    if (!link) {
      return res.json({ synced: false });
    }

    link.cyclePrediction = {
      nextPeriodDate: new Date(nextPeriodDate),
      currentPhase,
      updatedAt: new Date(),
    };
    await link.save();

    res.json({ synced: true });
  } catch (error) {
    console.error('Partner sync-cycle error:', error);
    res.status(500).json({ message: 'Server error syncing cycle prediction' });
  }
});

// @route  GET /api/partner/cycle-status
// @desc   Get the linked partner's shared cycle prediction (if sharing is enabled)
// @access Protected
router.get('/cycle-status', protect, async (req, res) => {
  try {
    const link = await PartnerLink.findOne({ partnerId: req.user._id, status: 'accepted' }).populate('userId', 'name');
    if (!link || !link.cyclePrediction?.currentPhase) {
      return res.json({ linked: false });
    }

    res.json({
      linked: true,
      partnerName: link.userId?.name || 'Your partner',
      nextPeriodDate: link.cyclePrediction.nextPeriodDate,
      currentPhase: link.cyclePrediction.currentPhase,
      updatedAt: link.cyclePrediction.updatedAt,
    });
  } catch (error) {
    console.error('Partner cycle-status error:', error);
    res.status(500).json({ message: 'Server error fetching partner cycle status' });
  }
});

// @route  DELETE /api/partner/:linkId
// @desc   Unlink a partner connection (either side may unlink)
// @access Protected
router.delete('/:linkId', protect, async (req, res) => {
  try {
    const { linkId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(linkId)) {
      return res.status(404).json({ message: 'Link not found' });
    }

    const link = await PartnerLink.findById(linkId);
    if (!link) {
      return res.status(404).json({ message: 'Link not found' });
    }

    const isSharer = String(link.userId) === String(req.user._id);
    const isPartner = link.partnerId && String(link.partnerId) === String(req.user._id);
    if (!isSharer && !isPartner) {
      return res.status(403).json({ message: 'Not authorized to unlink this connection' });
    }

    await link.deleteOne();
    res.json({ message: 'Unlinked' });
  } catch (error) {
    console.error('Partner unlink error:', error);
    res.status(500).json({ message: 'Server error unlinking partner' });
  }
});

module.exports = router;
