const trainers = [
  { id: 't1', name: 'Rajesh Kumar', photo: '🏋️', specializations: ['Strength', 'Powerlifting'], rating: 4.9, totalSessions: 850, hourlyRate: 800, trialRate: 400, city: 'Hyderabad', bio: 'NSCA-CSCS certified strength coach with 5 years experience. Specialises in barbell training and progressive overload programming for serious lifters.', certifications: ['NSCA-CSCS', 'ACE Personal Trainer'], sessionTypes: ['Online', 'In-Person'] },
  { id: 't2', name: 'Priya Sharma', photo: '🥗', specializations: ['Fat Loss', 'Nutrition'], rating: 4.8, totalSessions: 1200, hourlyRate: 900, trialRate: 450, city: 'Mumbai', bio: 'Precision Nutrition certified coach helping clients lose fat sustainably without crash diets. Expert in Indian food macros and meal timing.', certifications: ['Precision Nutrition L2', 'ACE Personal Trainer'], sessionTypes: ['Online'] },
  { id: 't3', name: 'Arjun Mehta', photo: '⚡', specializations: ['HIIT', 'Athletic Performance'], rating: 4.7, totalSessions: 960, hourlyRate: 750, trialRate: 375, city: 'Bangalore', bio: 'Former national-level sprinter turned performance coach. Designs science-backed HIIT protocols that deliver results in half the gym time.', certifications: ['ACSM Certified', 'Sports Performance Specialist'], sessionTypes: ['Online', 'In-Person'] },
  { id: 't4', name: 'Kavya Nair', photo: '🌟', specializations: ["Women's Fitness", 'Hormonal Health'], rating: 4.9, totalSessions: 740, hourlyRate: 1000, trialRate: 500, city: 'Hyderabad', bio: "India's top women's fitness coach, specialising in cycle-synced training and hormonal balance. Trusted by 700+ women for sustainable transformation.", certifications: ['NASM-CPT', "Women's Fitness Specialist"], sessionTypes: ['Online'] },
  { id: 't5', name: 'Vikram Singh', photo: '🦁', specializations: ['Bodybuilding', 'Aesthetics'], rating: 4.8, totalSessions: 1100, hourlyRate: 1200, trialRate: 600, city: 'Delhi', bio: 'Mr. India finalist and top-ranked bodybuilding coach. Knows exactly how to structure training and diet for stage-ready physiques.', certifications: ['IFBB Pro Card', 'ACE Certified'], sessionTypes: ['Online', 'In-Person'] },
  { id: 't6', name: 'Ananya Krishnan', photo: '🧘', specializations: ['Yoga', 'Mind-Body Fitness'], rating: 4.8, totalSessions: 890, hourlyRate: 700, trialRate: 350, city: 'Chennai', bio: 'RYT-500 certified yoga therapist blending classical yoga with modern strength principles. Ideal for stress, flexibility, and sustainable long-term health.', certifications: ['RYT-500', 'Yoga Therapy Certification'], sessionTypes: ['Online', 'In-Person'] },
];

function getTrainers({ city, specialization, maxRate, sessionType } = {}) {
  let result = [...trainers];
  if (city) result = result.filter(t => t.city.toLowerCase() === city.toLowerCase() || t.sessionTypes.includes('Online'));
  if (specialization) result = result.filter(t => t.specializations.some(s => s.toLowerCase().includes(specialization.toLowerCase())));
  if (maxRate) result = result.filter(t => t.hourlyRate <= maxRate);
  if (sessionType) result = result.filter(t => t.sessionTypes.includes(sessionType));
  return result;
}

function getTrainerById(id) {
  return trainers.find(t => t.id === id) || null;
}

module.exports = { trainers, getTrainers, getTrainerById };
