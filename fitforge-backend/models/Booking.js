const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  trainerId: { type: String, required: true },
  sessionDate: { type: String },
  sessionType: { type: String, enum: ['online', 'in_person'], default: 'online' },
  status: { type: String, default: 'confirmed' },
}, { timestamps: true });

BookingSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Booking', BookingSchema);
