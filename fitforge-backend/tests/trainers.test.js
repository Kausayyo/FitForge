const request = require('supertest');
const { setup, teardown } = require('./helpers/db');
const User = require('../models/User');

let app;
let free;
let premium;

async function register(name, email, extra = {}) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'password123', ...extra });
  return { token: res.body.token, user: res.body.user };
}

const auth = (token) => ['Authorization', `Bearer ${token}`];

beforeAll(async () => {
  app = await setup();
  free = await register('Free User', 'free-trainers@example.com');
  premium = await register('Premium User', 'premium-trainers@example.com');

  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await User.findByIdAndUpdate(premium.user.id, { isPremium: true, premiumExpiresAt: future });
});

afterAll(async () => {
  await teardown();
});

describe('GET /api/trainers', () => {
  it('rejects without a token', async () => {
    const res = await request(app).get('/api/trainers');
    expect(res.status).toBe(401);
  });

  it('returns a truncated preview of 3 trainers for non-premium users', async () => {
    const res = await request(app).get('/api/trainers').set(...auth(free.token));
    expect(res.status).toBe(200);
    expect(res.body.isPremiumRequired).toBe(true);
    expect(res.body.previewOnly).toBe(true);
    expect(res.body.total).toBe(6);
    expect(res.body.trainers).toHaveLength(3);
    res.body.trainers.forEach((t) => {
      expect(t.bio.endsWith('…')).toBe(true);
      expect(t.bio.length).toBe(81); // 80 chars + ellipsis
    });
  });

  it('returns all trainers untruncated for premium users', async () => {
    const res = await request(app).get('/api/trainers').set(...auth(premium.token));
    expect(res.status).toBe(200);
    expect(res.body.isPremiumRequired).toBe(false);
    expect(res.body.total).toBe(6);
    expect(res.body.trainers).toHaveLength(6);
    expect(res.body.trainers.every((t) => !t.bio.endsWith('…'))).toBe(true);
  });

  it('filters by maxRate', async () => {
    const res = await request(app).get('/api/trainers?maxRate=800').set(...auth(premium.token));
    expect(res.status).toBe(200);
    expect(res.body.trainers.every((t) => t.hourlyRate <= 800)).toBe(true);
    expect(res.body.trainers.map((t) => t.id).sort()).toEqual(['t1', 't3', 't6']);
  });

  it('filters by specialization (case-insensitive substring)', async () => {
    const res = await request(app)
      .get('/api/trainers?specialization=fitness')
      .set(...auth(premium.token));
    expect(res.status).toBe(200);
    expect(res.body.trainers.map((t) => t.id).sort()).toEqual(['t4', 't6']);
  });

  it('filters by sessionType', async () => {
    const res = await request(app)
      .get('/api/trainers?sessionType=In-Person')
      .set(...auth(premium.token));
    expect(res.status).toBe(200);
    expect(res.body.trainers.every((t) => t.sessionTypes.includes('In-Person'))).toBe(true);
    expect(res.body.trainers.map((t) => t.id).sort()).toEqual(['t1', 't3', 't5', 't6']);
  });
});

describe('GET /api/trainers/:id', () => {
  it('404s for an unknown trainer id', async () => {
    const res = await request(app).get('/api/trainers/t99').set(...auth(premium.token));
    expect(res.status).toBe(404);
  });

  it('returns a limited profile with a 100-char bio for non-premium users', async () => {
    const res = await request(app).get('/api/trainers/t1').set(...auth(free.token));
    expect(res.status).toBe(200);
    expect(res.body.isPremiumRequired).toBe(true);
    expect(res.body.trainer.id).toBe('t1');
    expect(res.body.trainer.bio.endsWith('…')).toBe(true);
    expect(res.body.trainer.bio.length).toBe(101); // 100 chars + ellipsis
    expect(res.body.trainer.certifications).toBeUndefined();
  });

  it('returns the full profile for premium users', async () => {
    const res = await request(app).get('/api/trainers/t1').set(...auth(premium.token));
    expect(res.status).toBe(200);
    expect(res.body.isPremiumRequired).toBe(false);
    expect(res.body.trainer.id).toBe('t1');
    expect(res.body.trainer.certifications).toEqual(['NSCA-CSCS', 'ACE Personal Trainer']);
    expect(res.body.trainer.bio.endsWith('…')).toBe(false);
  });
});

describe('POST /api/trainers/:id/book', () => {
  it('blocks non-premium users', async () => {
    const res = await request(app)
      .post('/api/trainers/t1/book')
      .set(...auth(free.token))
      .send({ sessionDate: '2026-07-10', sessionType: 'Online' });
    expect(res.status).toBe(403);
    expect(res.body.upgradeRequired).toBe(true);
  });

  it('404s for an unknown trainer id', async () => {
    const res = await request(app)
      .post('/api/trainers/t99/book')
      .set(...auth(premium.token))
      .send({ sessionDate: '2026-07-10', sessionType: 'Online' });
    expect(res.status).toBe(404);
  });

  it('rejects when sessionDate or sessionType is missing', async () => {
    const res = await request(app)
      .post('/api/trainers/t1/book')
      .set(...auth(premium.token))
      .send({ sessionDate: '2026-07-10' });
    expect(res.status).toBe(400);
  });

  it('rejects a sessionType the trainer does not offer', async () => {
    // t2 (Priya Sharma) only offers 'Online' sessions
    const res = await request(app)
      .post('/api/trainers/t2/book')
      .set(...auth(premium.token))
      .send({ sessionDate: '2026-07-10', sessionType: 'In-Person' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Online');
  });

  it('books a session and returns trainer details', async () => {
    const res = await request(app)
      .post('/api/trainers/t1/book')
      .set(...auth(premium.token))
      .send({ sessionDate: '2026-07-10', sessionType: 'Online' });
    expect(res.status).toBe(201);
    expect(res.body.booking.trainerId).toBe('t1');
    expect(res.body.booking.trainerName).toBe('Rajesh Kumar');
    expect(res.body.booking.trainerPhoto).toBe('🏋️');
    expect(res.body.booking.sessionType).toBe('Online');
    expect(res.body.booking.sessionDate).toBe('2026-07-10');

    const bookings = await request(app).get('/api/users/bookings').set(...auth(premium.token));
    expect(bookings.body.bookings.some((b) => b.trainerId === 't1')).toBe(true);
  });
});
