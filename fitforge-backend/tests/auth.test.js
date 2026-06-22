const request = require('supertest');
const { setup, teardown } = require('./helpers/db');
const User = require('../models/User');

let app;

beforeAll(async () => {
  app = await setup();
});

afterAll(async () => {
  await teardown();
});

describe('POST /api/auth/register', () => {
  it('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@example.com', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('rejects passwords shorter than 6 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Short Pass', email: 'short@example.com', password: '123' });
    expect(res.status).toBe(400);
  });

  it('creates a user with defaults and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Asha Rao', email: 'Asha@Example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('asha@example.com');
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user.workType).toBe('sedentary');
    expect(res.body.user.fitnessGoal).toBe('general_fitness');
    expect(res.body.user.habits).toEqual([]);
    expect(res.body.user.isPremium).toBe(false);
    expect(res.body.user.id).toBeTruthy();
  });

  it('rejects duplicate email registration (case-insensitive)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Asha Again', email: 'ASHA@example.com', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('accepts optional profile fields and coerces numeric types', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Vikram Patel',
        email: 'vikram@example.com',
        password: 'password123',
        age: '28',
        weight: '75.5',
        height: '180',
        city: 'Hyderabad',
        workType: 'heavy',
        fitnessGoal: 'muscle_gain',
        habits: ['vegetarian'],
      });

    expect(res.status).toBe(201);
    expect(res.body.user.age).toBe(28);
    expect(res.body.user.weight).toBe(75.5);
    expect(res.body.user.height).toBe(180);
    expect(res.body.user.city).toBe('Hyderabad');
    expect(res.body.user.workType).toBe('heavy');
    expect(res.body.user.fitnessGoal).toBe('muscle_gain');
    expect(res.body.user.habits).toEqual(['vegetarian']);
  });
});

describe('POST /api/auth/login', () => {
  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'asha@example.com' });
    expect(res.status).toBe(400);
  });

  it('rejects an unregistered email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });
    expect(res.status).toBe(401);
  });

  it('rejects an incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'asha@example.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('logs in with correct credentials (case-insensitive email)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ASHA@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('asha@example.com');
  });

  it('auto-expires premium status on login if past expiry', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Expired Premium', email: 'expired@example.com', password: 'password123' });
    const userId = reg.body.user.id;

    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await User.findByIdAndUpdate(userId, { isPremium: true, premiumExpiresAt: past });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'expired@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.user.isPremium).toBe(false);
    expect(res.body.user.premiumExpiresAt).toBeNull();

    const stored = await User.findById(userId);
    expect(stored.isPremium).toBe(false);
    expect(stored.premiumExpiresAt).toBeNull();
  });

  it('keeps premium active when expiry is in the future', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Active Premium', email: 'active-premium@example.com', password: 'password123' });
    const userId = reg.body.user.id;

    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await User.findByIdAndUpdate(userId, { isPremium: true, premiumExpiresAt: future });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'active-premium@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.user.isPremium).toBe(true);
    expect(res.body.user.premiumExpiresAt).toBeTruthy();
  });
});
