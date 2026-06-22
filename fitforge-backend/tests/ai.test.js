const mockGenerateContent = jest.fn();

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn(() => ({ generateContent: mockGenerateContent })),
  })),
}));

process.env.GEMINI_API_KEY = 'test-gemini-key';

const request = require('supertest');
const { setup, teardown } = require('./helpers/db');

let app;
let user;

async function register(name, email, extra = {}) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'password123', ...extra });
  return { token: res.body.token, user: res.body.user };
}

const auth = (token) => ['Authorization', `Bearer ${token}`];

const textResponse = (text) => ({ response: { text: () => text } });

beforeAll(async () => {
  app = await setup();
  user = await register('Asha Rao', 'ai-user@example.com', {
    fitnessGoal: 'muscle_gain',
    age: '28',
    workType: 'moderate',
  });
});

afterAll(async () => {
  await teardown();
});

beforeEach(() => {
  mockGenerateContent.mockReset();
});

describe('POST /api/ai/scan-gym', () => {
  const validBody = { images: ['base64imagedata'] };

  it('rejects without a token', async () => {
    const res = await request(app).post('/api/ai/scan-gym').send(validBody);
    expect(res.status).toBe(401);
  });

  it('rejects when images is missing', async () => {
    const res = await request(app)
      .post('/api/ai/scan-gym')
      .set(...auth(user.token))
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects an empty images array', async () => {
    const res = await request(app)
      .post('/api/ai/scan-gym')
      .set(...auth(user.token))
      .send({ images: [] });
    expect(res.status).toBe(400);
  });

  it('rejects more than 4 images', async () => {
    const res = await request(app)
      .post('/api/ai/scan-gym')
      .set(...auth(user.token))
      .send({ images: ['a', 'b', 'c', 'd', 'e'] });
    expect(res.status).toBe(400);
  });

  it('returns 500 when GEMINI_API_KEY is not configured', async () => {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const res = await request(app)
        .post('/api/ai/scan-gym')
        .set(...auth(user.token))
        .send(validBody);

      expect(res.status).toBe(500);
      expect(res.body.message).toContain('GEMINI_API_KEY');
    } finally {
      process.env.GEMINI_API_KEY = original;
    }
  });

  it('parses a raw JSON response and returns the scan with the user profile', async () => {
    const scanJson = {
      equipment: [{ name: 'Barbell', category: 'free_weights', confidence: 'high', exercises_enabled: ['Squat'] }],
      gym_score: { variety: 8, completeness: 7, summary: 'Solid setup.' },
    };
    mockGenerateContent.mockResolvedValueOnce(textResponse(JSON.stringify(scanJson)));

    const res = await request(app)
      .post('/api/ai/scan-gym')
      .set(...auth(user.token))
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.scan).toEqual(scanJson);
    expect(res.body.scannedAt).toEqual(expect.any(String));
    expect(res.body.userProfile).toEqual({
      fitnessGoal: 'muscle_gain',
      age: 28,
      workType: 'moderate',
      name: 'Asha',
    });
  });

  it('strips markdown code fences before parsing', async () => {
    const scanJson = { equipment: [], gym_score: { variety: 5, completeness: 5, summary: 'OK' } };
    mockGenerateContent.mockResolvedValueOnce(
      textResponse('```json\n' + JSON.stringify(scanJson) + '\n```')
    );

    const res = await request(app)
      .post('/api/ai/scan-gym')
      .set(...auth(user.token))
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.scan).toEqual(scanJson);
  });

  it('returns 500 when the AI response is not valid JSON', async () => {
    mockGenerateContent.mockResolvedValueOnce(textResponse('Sorry, I cannot help with that.'));

    const res = await request(app)
      .post('/api/ai/scan-gym')
      .set(...auth(user.token))
      .send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('AI returned malformed response. Please try again.');
  });
});

describe('POST /api/ai/chat', () => {
  it('rejects without a token', async () => {
    const res = await request(app).post('/api/ai/chat').send({ message: 'Hi' });
    expect(res.status).toBe(401);
  });

  it('rejects when message is missing', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set(...auth(user.token))
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects a non-string message', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set(...auth(user.token))
      .send({ message: 12345 });
    expect(res.status).toBe(400);
  });

  it('returns 500 when GEMINI_API_KEY is not configured', async () => {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const res = await request(app)
        .post('/api/ai/chat')
        .set(...auth(user.token))
        .send({ message: 'How much protein do I need?' });

      expect(res.status).toBe(500);
      expect(res.body.message).toContain('GEMINI_API_KEY');
    } finally {
      process.env.GEMINI_API_KEY = original;
    }
  });

  it('returns the trimmed model reply for a simple message', async () => {
    mockGenerateContent.mockResolvedValueOnce(textResponse('  Eat more **protein**, around 150g/day.  '));

    const res = await request(app)
      .post('/api/ai/chat')
      .set(...auth(user.token))
      .send({ message: 'How much protein do I need?' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Eat more **protein**, around 150g/day.');
  });

  it('maps history roles, strips HTML, and ignores malformed entries', async () => {
    mockGenerateContent.mockResolvedValueOnce(textResponse('Sure thing!'));

    const history = [
      { role: 'user', text: 'What should I eat <b>today</b>?' },
      { role: 'ai', text: '<p>Try dal and rice.</p>' },
      { role: 'system', text: 'should be ignored' },
      { role: 'user', text: '' },
      { role: 'user' },
    ];

    const res = await request(app)
      .post('/api/ai/chat')
      .set(...auth(user.token))
      .send({ message: 'Anything else?', history });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Sure thing!');

    const callArg = mockGenerateContent.mock.calls[0][0];
    expect(callArg.contents).toEqual([
      { role: 'user', parts: [{ text: 'What should I eat today?' }] },
      { role: 'model', parts: [{ text: 'Try dal and rice.' }] },
      { role: 'user', parts: [{ text: 'Anything else?' }] },
    ]);
  });
});
