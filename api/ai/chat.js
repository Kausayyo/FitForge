const { GoogleGenerativeAI } = require('@google/generative-ai');
const connectDB = require('../_lib/db');
const applyCors = require('../_lib/cors');
const { requireAuthWithUser } = require('../_lib/auth');

const GOAL_DESCRIPTIONS = {
  weight_loss: 'lose weight and burn fat',
  muscle_gain: 'build muscle and increase strength',
  general_fitness: 'improve overall fitness and health',
  endurance: 'build cardiovascular endurance and stamina',
};

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  await connectDB();
  const user = await requireAuthWithUser(req, res);
  if (!user) return;

  const { message, history } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ message: 'message is required' });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ message: 'AI service not configured. Please add GEMINI_API_KEY to .env' });
  }

  const goalDesc = GOAL_DESCRIPTIONS[user.fitnessGoal] || 'improve fitness';

  const profileLines = [`Name: ${user.name?.split(' ')[0] || 'User'}`, `Goal: ${goalDesc}`];
  if (user.weight) profileLines.push(`Weight: ${user.weight}kg`);
  if (user.height) profileLines.push(`Height: ${user.height}cm`);
  if (user.age) profileLines.push(`Age: ${user.age}`);
  if (user.workType) profileLines.push(`Activity level: ${user.workType}`);
  if (user.habits?.length) profileLines.push(`Diet habits: ${user.habits.join(', ')}`);
  if (user.city) profileLines.push(`City: ${user.city}`);
  if (user.macros) profileLines.push(`Daily macro targets: ${JSON.stringify(user.macros)}`);
  if (user.diet) profileLines.push(`Diet type: ${user.diet}`);

  const systemPrompt = `You are FitForge's AI fitness coach — friendly, motivating, and concise (2-4 short paragraphs max). Use **bold** for key numbers and terms. Give practical, evidence-based advice on workouts, nutrition, supplements, and recovery, tailored for an Indian fitness audience (reference Indian foods and brands where relevant).

User profile:
${profileLines.join('\n')}

Never ask about, reference, or speculate about menstrual cycle / period data — FitForge keeps that strictly on-device and it is never shared with you.`;

  const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, '').trim();

  const contents = (Array.isArray(history) ? history : [])
    .filter((h) => h && h.text && (h.role === 'user' || h.role === 'ai'))
    .map((h) => ({ role: h.role === 'ai' ? 'model' : 'user', parts: [{ text: stripHtml(h.text) }] }))
    .filter((c) => c.parts[0].text);

  contents.push({ role: 'user', parts: [{ text: message }] });

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite', systemInstruction: systemPrompt });

    const result = await model.generateContent({ contents });
    const reply = result.response.text().trim();

    res.json({ reply });
  } catch (err) {
    console.error('AI chat error:', err.message);
    if (err.message?.includes('API key') || err.message?.includes('API_KEY')) {
      return res.status(500).json({ message: 'Invalid Gemini API key. Check your GEMINI_API_KEY in .env' });
    }
    res.status(500).json({ message: 'AI chat failed. Please try again.', error: err.message });
  }
};
