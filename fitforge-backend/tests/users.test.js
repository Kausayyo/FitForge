const request = require('supertest');
const { setup, teardown } = require('./helpers/db');
const Booking = require('../models/Booking');

let app;
let user;

async function register(name, email, extra = {}) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'password123', ...extra });
  return { token: res.body.token, user: res.body.user };
}

const auth = (token) => ['Authorization', `Bearer ${token}`];

beforeAll(async () => {
  app = await setup();
  user = await register('Meera Iyer', 'meera@example.com', {
    age: '30',
    weight: '60',
    height: '165',
    city: 'Chennai',
  });
});

afterAll(async () => {
  await teardown();
});

describe('GET /api/users/me', () => {
  it('rejects without a token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid token', async () => {
    const res = await request(app).get('/api/users/me').set(...auth('not-a-real-token'));
    expect(res.status).toBe(401);
  });

  it('returns the current user profile', async () => {
    const res = await request(app).get('/api/users/me').set(...auth(user.token));
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('meera@example.com');
    expect(res.body.user.name).toBe('Meera Iyer');
    expect(res.body.user.password).toBeUndefined();
  });
});

describe('PUT /api/users/me', () => {
  it('updates whitelisted fields and coerces numeric types', async () => {
    const res = await request(app)
      .put('/api/users/me')
      .set(...auth(user.token))
      .send({
        name: 'Meera I.',
        age: '31',
        weight: '61.5',
        height: '166',
        city: 'Bengaluru',
        workType: 'moderate',
        fitnessGoal: 'weight_loss',
        habits: ['vegetarian'],
      });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Meera I.');
    expect(res.body.user.age).toBe(31);
    expect(res.body.user.weight).toBe(61.5);
    expect(res.body.user.height).toBe(166);
    expect(res.body.user.city).toBe('Bengaluru');
    expect(res.body.user.workType).toBe('moderate');
    expect(res.body.user.fitnessGoal).toBe('weight_loss');
    expect(res.body.user.habits).toEqual(['vegetarian']);
  });

  it('ignores fields outside the allowed whitelist', async () => {
    const res = await request(app)
      .put('/api/users/me')
      .set(...auth(user.token))
      .send({ email: 'hacked@example.com', isPremium: true });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('meera@example.com');
    expect(res.body.user.isPremium).toBe(false);
  });
});

describe('GET /api/users/bookings', () => {
  it('returns an empty list initially', async () => {
    const res = await request(app).get('/api/users/bookings').set(...auth(user.token));
    expect(res.status).toBe(200);
    expect(res.body.bookings).toEqual([]);
  });

  it("returns only the caller's bookings, newest first", async () => {
    const other = await register('Other User', 'other-bookings@example.com');
    const meId = (await request(app).get('/api/users/me').set(...auth(user.token))).body.user.id;
    const otherId = (await request(app).get('/api/users/me').set(...auth(other.token))).body.user
      .id;

    await Booking.create({ userId: otherId, trainerId: 't1', sessionDate: '2026-07-01', sessionType: 'online' });
    await Booking.create({ userId: meId, trainerId: 't1', sessionDate: '2026-07-02', sessionType: 'online' });
    await Booking.create({ userId: meId, trainerId: 't2', sessionDate: '2026-07-03', sessionType: 'in_person' });

    const res = await request(app).get('/api/users/bookings').set(...auth(user.token));
    expect(res.status).toBe(200);
    expect(res.body.bookings).toHaveLength(2);
    expect(res.body.bookings[0].trainerId).toBe('t2');
    expect(res.body.bookings[1].trainerId).toBe('t1');
    expect(res.body.bookings.every((b) => b.sessionDate)).toBe(true);
  });
});
