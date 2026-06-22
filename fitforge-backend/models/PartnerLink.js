const mongoose = require('mongoose');

const PartnerLinkSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  partnerEmail: { type: String, required: true, lowercase: true, trim: true },
  partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending',
  },
  sharingEnabled: { type: Boolean, default: true },
  cyclePrediction: {
    nextPeriodDate: { type: Date, default: null },
    currentPhase: {
      type: String,
      enum: ['menstrual', 'follicular', 'ovulatory', 'luteal', null],
      default: null,
    },
    updatedAt: { type: Date, default: null },
  },
}, { timestamps: true });

PartnerLinkSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    // Unlike other models, the frontend needs a stable id to call
    // /respond and DELETE /:linkId, so expose _id as `id` rather than dropping it.
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('PartnerLink', PartnerLinkSchema);
