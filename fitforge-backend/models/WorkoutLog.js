const mongoose = require('mongoose');

const SetSchema = new mongoose.Schema({
  reps: { type: Number, default: 0 },
  weight: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
}, { _id: false });

const WorkoutLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  exerciseId: { type: String, default: null },
  exerciseName: { type: String, required: true },
  sets: { type: [SetSchema], default: [] },
  durationMin: { type: Number, default: 0 },
  caloriesBurned: { type: Number, default: 0 },
  notes: { type: String, default: '' },
}, { timestamps: true });

// completedAt mapped from createdAt so the frontend doesn't need changes
WorkoutLogSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.completedAt = ret.createdAt;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('WorkoutLog', WorkoutLogSchema);
