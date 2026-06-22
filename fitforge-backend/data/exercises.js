const exercises = [
  { id: 'bench-press', name: 'Barbell Bench Press', category: 'push', difficulty: 'intermediate', goals: ['muscle_gain', 'general_fitness'], muscles: ['chest', 'shoulders', 'triceps'], equipment: 'barbell', sets: 4, reps: '8-10' },
  { id: 'squat', name: 'Barbell Back Squat', category: 'legs', difficulty: 'intermediate', goals: ['muscle_gain', 'general_fitness', 'weight_loss'], muscles: ['quads', 'glutes', 'hamstrings'], equipment: 'barbell', sets: 4, reps: '6-8' },
  { id: 'deadlift', name: 'Conventional Deadlift', category: 'pull', difficulty: 'advanced', goals: ['muscle_gain', 'general_fitness'], muscles: ['back', 'hamstrings', 'glutes'], equipment: 'barbell', sets: 4, reps: '5' },
  { id: 'ohp', name: 'Overhead Press', category: 'push', difficulty: 'intermediate', goals: ['muscle_gain', 'general_fitness'], muscles: ['shoulders', 'triceps'], equipment: 'barbell', sets: 4, reps: '8-10' },
  { id: 'row', name: 'Barbell Bent-Over Row', category: 'pull', difficulty: 'intermediate', goals: ['muscle_gain', 'general_fitness'], muscles: ['back', 'biceps'], equipment: 'barbell', sets: 4, reps: '8-10' },
  { id: 'pullup', name: 'Pull-Ups', category: 'pull', difficulty: 'intermediate', goals: ['muscle_gain', 'weight_loss', 'general_fitness'], muscles: ['back', 'biceps'], equipment: 'bodyweight', sets: 4, reps: 'max' },
  { id: 'pushup', name: 'Push-Ups', category: 'push', difficulty: 'beginner', goals: ['general_fitness', 'weight_loss'], muscles: ['chest', 'shoulders', 'triceps'], equipment: 'bodyweight', sets: 3, reps: '15-20' },
  { id: 'lunges', name: 'Walking Lunges', category: 'legs', difficulty: 'beginner', goals: ['weight_loss', 'general_fitness'], muscles: ['quads', 'glutes'], equipment: 'bodyweight', sets: 3, reps: '12/leg' },
  { id: 'plank', name: 'Plank Hold', category: 'core', difficulty: 'beginner', goals: ['general_fitness', 'weight_loss', 'endurance'], muscles: ['core'], equipment: 'bodyweight', sets: 3, reps: '60s' },
  { id: 'cable-row', name: 'Cable Seated Row', category: 'pull', difficulty: 'beginner', goals: ['muscle_gain', 'general_fitness'], muscles: ['back', 'biceps'], equipment: 'cable', sets: 3, reps: '12' },
];

function getRecommendedExercises({ fitnessGoal, workType, age }) {
  let result = [...exercises];
  if (fitnessGoal === 'weight_loss') result = result.filter(e => e.goals.includes('weight_loss'));
  else if (fitnessGoal === 'muscle_gain') result = result.filter(e => e.goals.includes('muscle_gain'));
  if (age > 50) result = result.filter(e => e.difficulty !== 'advanced');
  if (workType === 'sedentary') result = result.filter(e => e.difficulty !== 'advanced');
  return result.slice(0, 8);
}

module.exports = { exercises, getRecommendedExercises };
