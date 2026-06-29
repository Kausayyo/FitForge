const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  razorpayOrderId: { type: String, unique: true, sparse: true },
  razorpayPaymentId: { type: String, default: null },
  amount: { type: Number },
  currency: { type: String, default: 'INR' },
  status: { type: String, default: 'pending' },
  planType: { type: String, default: 'trial' },
  paidAt: { type: Date, default: null },
}, { timestamps: true });

PaymentSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);
