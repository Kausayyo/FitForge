const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  age: { type: Number, default: null },
  weight: { type: Number, default: null },
  height: { type: Number, default: null },
  city: { type: String, default: null },
  workType: {
    type: String,
    enum: ['sedentary', 'light', 'moderate', 'heavy'],
    default: 'sedentary',
  },
  habits: { type: [String], default: [] },
  fitnessGoal: {
    type: String,
    enum: ['weight_loss', 'muscle_gain', 'general_fitness', 'endurance'],
    default: 'general_fitness',
  },
  isPremium: { type: Boolean, default: false },
  premiumExpiresAt: { type: Date, default: null },
  trialUsed: { type: Boolean, default: false },
}, { timestamps: true });

UserSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    return ret;
  },
});

module.exports = mongoose.model('User', UserSchema);
