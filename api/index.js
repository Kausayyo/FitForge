/**
 * Single Vercel serverless function that routes all /api/* requests.
 * Consolidates 25 functions → 1 to fit Vercel Hobby plan (12-function limit).
 */

const applyCors = require('./_lib/cors');
const rateLimit = require('./_lib/rateLimit');

// ── Lazy DB / auth helpers ────────────────────────────────────────────────────
let _connectDB, _User, _WorkoutLog, _getUser, _requireAuthWithUser, _generateToken;

function lazyLoad() {
  if (_connectDB) return;
  try {
    _connectDB = require('./_lib/db');
    _User = require('./_lib/models/User');
    _WorkoutLog = require('./_lib/models/WorkoutLog');
    const auth = require('./_lib/auth');
    _getUser = auth.getUser;
    _requireAuthWithUser = auth.requireAuthWithUser;
    const jwt = require('jsonwebtoken');
    const bcrypt = require('bcryptjs');
    _generateToken = (id) =>
      jwt.sign({ id }, process.env.JWT_SECRET || 'fitforge_dev_secret', { expiresIn: '30d' });
  } catch (e) {
    console.warn('DB/auth libs not available:', e.message);
  }
}

async function connectDB() {
  lazyLoad();
  if (_connectDB) await _connectDB();
}

async function getUser(req) {
  await connectDB();
  return _getUser ? _getUser(req) : null;
}

async function requireAuth(req, res) {
  lazyLoad();
  if (!_requireAuthWithUser) {
    res.status(503).json({ message: 'Auth not configured — add MONGODB_URI to Vercel env vars.' });
    return null;
  }
  return _requireAuthWithUser(req, res);
}

// ── Route handlers ────────────────────────────────────────────────────────────

async function handleRegister(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  lazyLoad();
  if (!_User) return res.status(503).json({ message: 'Database not configured.' });
  await connectDB();
  const bcrypt = require('bcryptjs');
  const { name, email, password, age, weight, height, city, workType, habits, fitnessGoal } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
  const existing = await _User.findOne({ email: email.toLowerCase() });
  if (existing) return res.status(409).json({ message: 'Email already registered' });
  const hashed = await bcrypt.hash(password, 10);
  const user = await _User.create({
    name, email: email.toLowerCase(), password: hashed,
    age: age ? parseInt(age) : null, weight: weight ? parseFloat(weight) : null,
    height: height ? parseFloat(height) : null, city: city || null,
    workType: workType || 'sedentary', habits: habits || [],
    fitnessGoal: fitnessGoal || 'general_fitness',
  });
  res.status(201).json({ message: 'Account created', token: _generateToken(user.id), user });
}

async function handleLogin(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  lazyLoad();
  if (!_User) return res.status(503).json({ message: 'Database not configured.' });
  await connectDB();
  const bcrypt = require('bcryptjs');
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
  const user = await _User.findOne({ email: email.toLowerCase() });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ message: 'Invalid email or password' });
  if (user.isPremium && user.premiumExpiresAt && new Date(user.premiumExpiresAt) < new Date()) {
    await _User.findByIdAndUpdate(user.id, { isPremium: false, premiumExpiresAt: null });
    user.isPremium = false;
  }
  res.json({ message: 'Login successful', token: _generateToken(user.id), user });
}

async function handleUserMe(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  if (req.method === 'GET') return res.json({ user });
  if (req.method === 'PUT') {
    const allowed = ['name','age','weight','height','city','workType','habits','fitnessGoal','gender','diet','foods','target','targetBodyFat','workoutDaysPerWeek','equipmentAccess','lastPeriod','cycleLength','macros'];
    const updates = {};
    allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (updates.age) updates.age = parseInt(updates.age);
    if (updates.weight) updates.weight = parseFloat(updates.weight);
    if (updates.height) updates.height = parseFloat(updates.height);
    const updated = await _User.findByIdAndUpdate(user.id, updates, { new: true }).select('-password');
    return res.json({ message: 'Profile updated', user: updated });
  }
  res.status(405).json({ message: 'Method not allowed' });
}

async function handleWorkoutLog(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  lazyLoad();
  if (!_WorkoutLog) return res.status(503).json({ message: 'Database not configured.' });
  const user = await requireAuth(req, res);
  if (!user) return;
  const { exerciseName, exerciseId, sets, durationMin, caloriesBurned, notes } = req.body || {};
  if (!exerciseName && !exerciseId) return res.status(400).json({ message: 'exerciseName is required' });
  const log = await _WorkoutLog.create({
    userId: user._id, exerciseId: exerciseId || null,
    exerciseName: exerciseName || 'Unknown',
    sets: Array.isArray(sets) ? sets : [],
    durationMin: parseFloat(durationMin) || 0,
    caloriesBurned: parseFloat(caloriesBurned) || 0,
    notes: String(notes || ''),
  });
  res.status(201).json({ message: 'Workout logged!', log });
}

async function handleWorkoutStats(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
  lazyLoad();
  if (!_WorkoutLog) return res.status(503).json({ message: 'Database not configured.' });
  const user = await requireAuth(req, res);
  if (!user) return;
  const logs = await _WorkoutLog.find({ userId: user._id }).sort({ createdAt: -1 }).limit(100);
  const totalWorkouts = logs.length;
  const totalCalories = logs.reduce((s, l) => s + (l.caloriesBurned || 0), 0);
  const totalMinutes = logs.reduce((s, l) => s + (l.durationMin || 0), 0);
  res.json({ stats: { totalWorkouts, totalCalories, totalMinutes }, logs });
}

async function handleAIChat(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  if (rateLimit(req, res, { windowMs: 60_000, max: 30 })) return;
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ message: 'AI not configured. Add GEMINI_API_KEY to Vercel environment variables.' });

  const { message, history, userProfile } = req.body || {};
  if (!message?.trim()) return res.status(400).json({ message: 'message is required' });

  let user = null;
  try { user = await getUser(req); } catch (_) {}

  const p = user ? {
    name: user.name?.split(' ')[0] || 'there', goal: user.fitnessGoal || 'general_fitness',
    weight: user.weight, height: user.height, age: user.age, activity: user.workType,
    diet: user.diet, city: user.city, macros: user.macros, habits: user.habits,
  } : {
    name: userProfile?.name || 'there', goal: userProfile?.goal || 'general_fitness',
    weight: userProfile?.weight, height: userProfile?.height, age: userProfile?.age,
    activity: userProfile?.activity, diet: userProfile?.diet, city: userProfile?.city || 'India',
    macros: userProfile?.macros,
  };

  const goalMap = { weight_loss:'lose weight', muscle_gain:'build muscle', general_fitness:'improve fitness', endurance:'build endurance' };
  const lines = [`Name: ${p.name}`, `Goal: ${goalMap[p.goal] || 'improve fitness'}`];
  if (p.weight) lines.push(`Weight: ${p.weight}kg`);
  if (p.height) lines.push(`Height: ${p.height}cm`);
  if (p.age) lines.push(`Age: ${p.age}`);
  if (p.activity) lines.push(`Activity: ${p.activity}`);
  if (p.diet) lines.push(`Diet: ${p.diet}`);
  if (p.city) lines.push(`City: ${p.city}`);
  if (p.macros) lines.push(`Targets: ${p.macros.calories}kcal, ${p.macros.protein}g protein`);
  if (p.habits?.length) lines.push(`Foods: ${p.habits.join(', ')}`);

  const systemPrompt = `You are FitForge AI — an evidence-based fitness and nutrition coach for India. Be direct, specific, and concise (under 150 words). Use **bold** for key numbers. Give India-specific food recommendations (dal, paneer, eggs, rajma, curd, etc.). Prices in INR. Never diagnose medical conditions.\n\nUser profile:\n${lines.join('\n')}`;

  const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').trim();
  const contents = (Array.isArray(history) ? history : []).filter(h => h?.text && (h.role === 'user' || h.role === 'ai')).slice(-12)
    .map(h => ({ role: h.role === 'ai' ? 'model' : 'user', parts: [{ text: stripHtml(h.text) }] }))
    .filter(c => c.parts[0].text);
  contents.push({ role: 'user', parts: [{ text: stripHtml(message) }] });

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction: systemPrompt });
    const result = await model.generateContent({ contents });
    res.json({ reply: result.response.text().trim() });
  } catch (err) {
    console.error('AI chat error:', err.message);
    res.status(500).json({ message: 'AI temporarily unavailable. Please try again.' });
  }
}

async function handleAIScanGym(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  if (rateLimit(req, res, { windowMs: 10 * 60_000, max: 3 })) return;
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ message: 'AI not configured. Add GEMINI_API_KEY to Vercel environment variables.' });

  const { images, mimeType = 'image/jpeg', userProfile } = req.body || {};
  if (!images?.length) return res.status(400).json({ message: 'At least one image is required' });
  if (images.length > 4) return res.status(400).json({ message: 'Maximum 4 images' });

  let user = null;
  try { user = await getUser(req); } catch (_) {}
  const name = user?.name?.split(' ')[0] || userProfile?.name || 'User';
  const age = user?.age || userProfile?.age || 25;
  const goal = user?.fitnessGoal || userProfile?.goal || 'general_fitness';

  const SCHEMA = `{"equipment":[{"name":"string","category":"free_weights|machines|cardio|cables|bodyweight|other","confidence":"high|medium|low","exercises_enabled":["ex1","ex2"]}],"gym_score":{"variety":1,"completeness":1,"summary":"string"},"workout_plan":{"split_type":"string","days_per_week":3,"days":[{"day_name":"string","focus":"string","exercises":[{"name":"string","equipment_needed":"string","sets":3,"reps":"8-10","rest_seconds":60,"technique_tip":"string","calories_burned":50}],"total_duration_min":45,"total_calories":300}]},"diet":{"daily_calories":2000,"protein_g":150,"carbs_g":200,"fats_g":65,"water_liters":2.5,"meal_timing":"string","meals":[{"name":"string","time":"string","foods":["food1"],"calories":400,"protein_g":30}],"supplements":["string"],"rationale":"string"},"grocery_list":[{"item":"string","quantity":"string","category":"protein|carbs|fats|vegetables|dairy|supplements","weekly_cost_inr":200,"why":"string"}],"ai_insights":{"strengths":["string"],"missing_equipment":["string"],"pro_tip":"string","motivation_message":"string"}}`;

  const prompt = `You are FitForge's AI fitness coach. Identify all visible gym equipment and create a complete personalised plan for ${name}, age ${age}, goal: ${goal}. Respond ONLY with valid JSON using this schema:\n${SCHEMA}`;

  const imageParts = images.map(b => ({ inlineData: { data: b, mimeType } }));

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent([prompt, ...imageParts]);
    const raw = result.response.text().trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    res.json({ success: true, scan: parsed, scannedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Scan error:', err.message);
    res.status(500).json({ message: 'AI scan failed. Please try again.' });
  }
}

function handleDietPlan(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });
  res.json({ message: 'Diet plans are calculated client-side for speed. Use the app Diet tab.' });
}

function handleExercises(req, res) {
  res.json({ message: 'Exercise data is bundled in the app for offline use.' });
}

function handlePaymentsCreateOrder(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  // Razorpay integration — add RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET to Vercel env vars
  if (!process.env.RAZORPAY_KEY_ID) {
    return res.status(503).json({ message: 'Payments not configured yet. Coming soon!' });
  }
  res.json({ message: 'Order created', orderId: `order_demo_${Date.now()}` });
}

// ── Main router ───────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;

  // Strip /api prefix
  const path = (req.url || '').replace(/^\/api/, '').split('?')[0];
  const method = req.method;

  try {
    if (path === '/auth/register') return await handleRegister(req, res);
    if (path === '/auth/login') return await handleLogin(req, res);
    if (path === '/users/me') return await handleUserMe(req, res);
    if (path === '/workouts/log') return await handleWorkoutLog(req, res);
    if (path === '/workouts/stats') return await handleWorkoutStats(req, res);
    if (path === '/ai/chat') return await handleAIChat(req, res);
    if (path === '/ai/scan-gym') return await handleAIScanGym(req, res);
    if (path === '/diet/plan') return handleDietPlan(req, res);
    if (path === '/exercises' || path === '/exercises/') return handleExercises(req, res);
    if (path === '/payments/create-order') return handlePaymentsCreateOrder(req, res);
    if (path === '/health' || path === '') return res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });

    res.status(404).json({ message: `API route ${path} not found` });
  } catch (err) {
    console.error('API error:', err.message, err.stack);
    res.status(500).json({ message: 'Internal server error', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
};
