const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { protect } = require('../middleware/auth');

const router = express.Router();

const GOAL_DESCRIPTIONS = {
  weight_loss: 'lose weight and burn fat',
  muscle_gain: 'build muscle and increase strength',
  general_fitness: 'improve overall fitness and health',
  endurance: 'build cardiovascular endurance and stamina',
};

const SCAN_SCHEMA = `{
  "equipment": [
    { "name": "string", "category": "free_weights|machines|cardio|bodyweight|cables|other", "confidence": "high|medium|low", "exercises_enabled": ["exercise1", "exercise2"] }
  ],
  "gym_score": { "variety": 1-10, "completeness": 1-10, "summary": "2 sentence gym assessment" },
  "workout_plan": {
    "split_type": "string",
    "days_per_week": 3,
    "days": [
      {
        "day_name": "string",
        "focus": "string",
        "exercises": [
          { "name": "string", "equipment_needed": "string", "sets": 3, "reps": "8-10", "rest_seconds": 60, "technique_tip": "string", "calories_burned": 50 }
        ],
        "total_duration_min": 45,
        "total_calories": 300
      }
    ]
  },
  "diet": {
    "daily_calories": 2000,
    "protein_g": 150,
    "carbs_g": 200,
    "fats_g": 65,
    "water_liters": 2.5,
    "meal_timing": "string",
    "meals": [
      { "name": "string", "time": "string", "foods": ["food1", "food2"], "calories": 400, "protein_g": 30 }
    ],
    "supplements": ["string"],
    "rationale": "string"
  },
  "grocery_list": [
    { "item": "string", "quantity": "string", "category": "protein|carbs|fats|vegetables|fruits|dairy|supplements", "weekly_cost_inr": 200, "why": "string" }
  ],
  "ai_insights": {
    "strengths": ["string"],
    "missing_equipment": ["string"],
    "pro_tip": "string",
    "motivation_message": "string"
  }
}`;

// @route  POST /api/ai/scan-gym
// @desc   Analyze gym photos with Gemini vision → equipment + personalized plan
// @access Protected
router.post('/scan-gym', protect, async (req, res) => {
  const { images, mimeType = 'image/jpeg' } = req.body;

  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ message: 'At least one image is required' });
  }
  if (images.length > 4) {
    return res.status(400).json({ message: 'Maximum 4 images allowed' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ message: 'AI service not configured. Please add GEMINI_API_KEY to .env' });
  }

  const user = req.user;
  const profile = {
    fitnessGoal: user.fitnessGoal || 'general_fitness',
    age: user.age || 25,
    workType: user.workType || 'sedentary',
    name: user.name?.split(' ')[0] || 'User',
  };

  const goalDesc = GOAL_DESCRIPTIONS[profile.fitnessGoal] || 'improve fitness';

  const prompt = `You are FitForge's elite AI fitness coach. When given gym photos, identify every piece of visible equipment, then create a complete personalized fitness plan using ONLY the available equipment.

This plan is for ${profile.name}, a ${profile.age}-year-old whose goal is to ${goalDesc}.

Respond with ONLY valid JSON — no markdown, no code blocks, no explanation. Use exactly this schema:

${SCAN_SCHEMA}`;

  const imageParts = images.map((base64) => ({
    inlineData: { data: base64, mimeType },
  }));

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent([prompt, ...imageParts]);
    const raw = result.response.text().trim();

    let parsed;
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    } catch {
      console.error('Gemini raw response:', raw.slice(0, 500));
      return res.status(500).json({ message: 'AI returned malformed response. Please try again.' });
    }

    res.json({
      success: true,
      scan: parsed,
      scannedAt: new Date().toISOString(),
      userProfile: profile,
    });
  } catch (err) {
    console.error('AI scan error:', err.message);
    if (err.message?.includes('API key') || err.message?.includes('API_KEY')) {
      return res.status(500).json({ message: 'Invalid Gemini API key. Check your GEMINI_API_KEY in .env' });
    }
    res.status(500).json({ message: 'AI analysis failed. Please try again.', error: err.message });
  }
});

// @route  POST /api/ai/chat
// @desc   Conversational fitness Q&A grounded in the user's profile
// @access Protected
router.post('/chat', protect, async (req, res) => {
  const { message, history } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ message: 'message is required' });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ message: 'AI service not configured. Please add GEMINI_API_KEY to .env' });
  }

  const user = req.user;
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
});

module.exports = router;
