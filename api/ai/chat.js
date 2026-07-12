const { GoogleGenerativeAI } = require('@google/generative-ai');
const applyCors = require('../_lib/cors');
const rateLimit = require('../_lib/rateLimit');

// Try to load auth + DB — not required, used for personalization when available
let getUser;
try {
  const auth = require('../_lib/auth');
  const connectDB = require('../_lib/db');
  getUser = async (req) => {
    await connectDB();
    return auth.getUser(req);
  };
} catch (_) {
  getUser = async () => null;
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  // 30 AI messages per minute per IP (generous for real users, blocks bots)
  if (rateLimit(req, res, { windowMs: 60_000, max: 30, message: 'AI rate limit reached. Please wait a moment.' })) return;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ message: 'AI service not configured on the server.' });
  }

  const { message, history, userProfile } = req.body;
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ message: 'message is required' });
  }

  // Try to get logged-in user for richer personalization
  let user = null;
  try { user = await getUser(req); } catch (_) {}

  // Build profile from DB user, or fall back to client-sent profile
  const profile = user
    ? {
        name: user.name?.split(' ')[0] || 'there',
        goal: user.fitnessGoal || 'general_fitness',
        weight: user.weight,
        height: user.height,
        age: user.age,
        activity: user.workType,
        diet: user.diet,
        habits: user.habits,
        city: user.city,
        macros: user.macros,
      }
    : {
        name: userProfile?.name || 'there',
        goal: userProfile?.goal || 'general_fitness',
        weight: userProfile?.weight,
        height: userProfile?.height,
        age: userProfile?.age,
        activity: userProfile?.activity,
        diet: userProfile?.diet,
        city: userProfile?.city || 'India',
        macros: userProfile?.macros,
      };

  const goalMap = {
    weight_loss: 'lose weight and burn fat',
    muscle_gain: 'build muscle and increase strength',
    general_fitness: 'improve overall fitness',
    endurance: 'build cardiovascular endurance',
  };

  const profileLines = [`Name: ${profile.name}`, `Goal: ${goalMap[profile.goal] || 'improve fitness'}`];
  if (profile.weight) profileLines.push(`Weight: ${profile.weight}kg`);
  if (profile.height) profileLines.push(`Height: ${profile.height}cm`);
  if (profile.age) profileLines.push(`Age: ${profile.age}`);
  if (profile.activity) profileLines.push(`Activity level: ${profile.activity}`);
  if (profile.diet) profileLines.push(`Diet: ${profile.diet}`);
  if (profile.city) profileLines.push(`City: ${profile.city}`);
  if (profile.macros) profileLines.push(`Daily targets: ${profile.macros.calories}kcal, ${profile.macros.protein}g protein`);
  if (profile.habits?.length) profileLines.push(`Food habits: ${profile.habits.join(', ')}`);

  const systemPrompt = `You are FitForge AI — a knowledgeable, evidence-based fitness and nutrition coach for India. You speak directly and concisely. You give specific, actionable advice. Use **bold** for key numbers and important terms. Keep answers under 150 words unless the question truly needs more depth.

User profile:
${profileLines.join('\n')}

Rules:
- Give India-specific food recommendations (dal, paneer, eggs, chicken, rajma, curd, roti, etc.)
- Mention prices in INR when relevant.
- If asked something outside fitness/nutrition/health, politely redirect.
- Never diagnose medical conditions — recommend consulting a doctor for medical issues.
- Be conversational but information-dense. No filler.`;

  const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').trim();

  const contents = (Array.isArray(history) ? history : [])
    .filter((h) => h && h.text && (h.role === 'user' || h.role === 'ai'))
    .slice(-12)
    .map((h) => ({ role: h.role === 'ai' ? 'model' : 'user', parts: [{ text: stripHtml(h.text) }] }))
    .filter((c) => c.parts[0].text);

  contents.push({ role: 'user', parts: [{ text: stripHtml(message) }] });

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent({ contents });
    const reply = result.response.text().trim();
    res.json({ reply });
  } catch (err) {
    console.error('AI chat error:', err.message);
    res.status(500).json({ message: 'AI temporarily unavailable. Please try again.', error: err.message });
  }
};
