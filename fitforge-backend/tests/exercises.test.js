const request = require('supertest');
const { setup, teardown } = require('./helpers/db');

let app;

async function register(name, email, extra = {}) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'password123', ...extra });
  return { token: res.body.token, user: res.body.user };
}

const auth = (token) => ['Authorization', `Bearer ${token}`];

beforeAll(async () => {
  app = await setup();
});

afterAll(async () => {
  await teardown();
});

describe('GET /api/exercises', () => {
  it('returns all exercises by default (public)', async () => {
    const res = await request(app).get('/api/exercises');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(10);
    expect(res.body.exercises).toHaveLength(10);
  });

  it('filters by category', async () => {
    const res = await request(app).get('/api/exercises?category=push');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.exercises.every((e) => e.category === 'push')).toBe(true);
  });

  it('filters by difficulty', async () => {
    const res = await request(app).get('/api/exercises?difficulty=beginner');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.exercises.every((e) => e.difficulty === 'beginner')).toBe(true);
  });

  it('filters by goal', async () => {
    const res = await request(app).get('/api/exercises?goal=endurance');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.exercises[0].id).toBe('plank');
  });

  it('combines filters', async () => {
    const res = await request(app).get('/api/exercises?category=pull&difficulty=advanced');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.exercises[0].id).toBe('deadlift');
  });
});

describe('GET /api/exercises/:id', () => {
  it('returns a single exercise by id', async () => {
    const res = await request(app).get('/api/exercises/squat');
    expect(res.status).toBe(200);
    expect(res.body.exercise.name).toBe('Barbell Back Squat');
  });

  it('404s for an unknown id', async () => {
    const res = await request(app).get('/api/exercises/does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/exercises/recommended', () => {
  it('rejects without a token', async () => {
    const res = await request(app).get('/api/exercises/recommended');
    expect(res.status).toBe(401);
  });

  it('filters to weight_loss exercises for a weight_loss goal', async () => {
    const u = await register('WL User', 'wl@example.com', {
      fitnessGoal: 'weight_loss',
      age: '25',
      workType: 'moderate',
    });
    const res = await request(app).get('/api/exercises/recommended').set(...auth(u.token));
    expect(res.status).toBe(200);
    expect(res.body.basedOn).toEqual({ fitnessGoal: 'weight_loss', workType: 'moderate', age: 25 });
    expect(res.body.exercises.length).toBeGreaterThan(0);
    expect(res.body.exercises.every((e) => e.goals.includes('weight_loss'))).toBe(true);
  });

  it('excludes advanced exercises for users over 50', async () => {
    const u = await register('MG Older User', 'mg-older@example.com', {
      fitnessGoal: 'muscle_gain',
      age: '60',
      workType: 'moderate',
    });
    const res = await request(app).get('/api/exercises/recommended').set(...auth(u.token));
    expect(res.status).toBe(200);
    expect(res.body.exercises.find((e) => e.difficulty === 'advanced')).toBeUndefined();
    expect(res.body.exercises.find((e) => e.id === 'deadlift')).toBeUndefined();
  });

  it('excludes advanced exercises for sedentary users and caps results at 8', async () => {
    const u = await register('GF Sedentary', 'gf-sedentary@example.com', {
      fitnessGoal: 'general_fitness',
      age: '30',
      workType: 'sedentary',
    });
    const res = await request(app).get('/api/exercises/recommended').set(...auth(u.token));
    expect(res.status).toBe(200);
    expect(res.body.total).toBeLessThanOrEqual(8);
    expect(res.body.exercises.find((e) => e.id === 'deadlift')).toBeUndefined();
  });

  it('defaults profile values when age/workType/fitnessGoal are unset', async () => {
    const u = await register('Bare Profile', 'bare-profile@example.com');
    const res = await request(app).get('/api/exercises/recommended').set(...auth(u.token));
    expect(res.status).toBe(200);
    expect(res.body.basedOn).toEqual({ fitnessGoal: 'general_fitness', workType: 'sedentary', age: 30 });
  });
});
