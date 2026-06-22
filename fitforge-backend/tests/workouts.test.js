const request = require('supertest');
const { setup, teardown } = require('./helpers/db');
const WorkoutLog = require('../models/WorkoutLog');

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

describe('POST /api/workouts/log', () => {
  let user;

  beforeAll(async () => {
    user = await register('Workout User', 'workout-log@example.com');
  });

  it('rejects without a token', async () => {
    const res = await request(app).post('/api/workouts/log').send({ exerciseName: 'Squat' });
    expect(res.status).toBe(401);
  });

  it('rejects when neither exerciseName nor exerciseId is given', async () => {
    const res = await request(app)
      .post('/api/workouts/log')
      .set(...auth(user.token))
      .send({ durationMin: 10 });
    expect(res.status).toBe(400);
  });

  it('logs a full workout and returns it without internal fields', async () => {
    const res = await request(app)
      .post('/api/workouts/log')
      .set(...auth(user.token))
      .send({
        exerciseId: 'squat',
        exerciseName: 'Barbell Back Squat',
        sets: [{ reps: 10, weight: 60, completed: true }],
        durationMin: 45,
        caloriesBurned: 320,
        notes: 'Felt strong today',
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Workout logged!');

    const { log } = res.body;
    expect(log.exerciseId).toBe('squat');
    expect(log.exerciseName).toBe('Barbell Back Squat');
    expect(log.sets).toEqual([{ reps: 10, weight: 60, completed: true }]);
    expect(log.durationMin).toBe(45);
    expect(log.caloriesBurned).toBe(320);
    expect(log.notes).toBe('Felt strong today');
    expect(log.id).toBeTruthy();
    expect(log._id).toBeUndefined();
    expect(log.completedAt).toBeTruthy();
  });

  it('applies defaults when optional fields are omitted', async () => {
    const res = await request(app)
      .post('/api/workouts/log')
      .set(...auth(user.token))
      .send({ exerciseId: 'plank' });

    expect(res.status).toBe(201);
    const { log } = res.body;
    expect(log.exerciseId).toBe('plank');
    expect(log.exerciseName).toBe('Unknown');
    expect(log.sets).toEqual([]);
    expect(log.durationMin).toBe(0);
    expect(log.caloriesBurned).toBe(0);
    expect(log.notes).toBe('');
  });

  it('coerces numeric strings for durationMin and caloriesBurned', async () => {
    const res = await request(app)
      .post('/api/workouts/log')
      .set(...auth(user.token))
      .send({ exerciseName: 'Push Up', durationMin: '15.5', caloriesBurned: '120' });

    expect(res.status).toBe(201);
    expect(res.body.log.durationMin).toBe(15.5);
    expect(res.body.log.caloriesBurned).toBe(120);
    expect(res.body.log.exerciseId).toBeNull();
  });
});

describe('GET /api/workouts', () => {
  let userA;
  let userB;

  beforeAll(async () => {
    userA = await register('History User A', 'workout-history-a@example.com');
    userB = await register('History User B', 'workout-history-b@example.com');

    const wait = () => new Promise((r) => setTimeout(r, 10));

    await WorkoutLog.create({ userId: userA.user.id, exerciseName: 'Squat' });
    await wait();
    await WorkoutLog.create({ userId: userA.user.id, exerciseName: 'Bench Press' });
    await wait();
    await WorkoutLog.create({ userId: userA.user.id, exerciseName: 'Deadlift' });
    await wait();
    await WorkoutLog.create({ userId: userB.user.id, exerciseName: 'Plank' });
  });

  it('rejects without a token', async () => {
    const res = await request(app).get('/api/workouts');
    expect(res.status).toBe(401);
  });

  it("returns only the caller's logs, newest first", async () => {
    const res = await request(app).get('/api/workouts').set(...auth(userA.token));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.logs.map((l) => l.exerciseName)).toEqual(['Deadlift', 'Bench Press', 'Squat']);
    expect(res.body.logs.every((l) => l.exerciseName !== 'Plank')).toBe(true);
    expect(res.body.logs.every((l) => l.id && l._id === undefined)).toBe(true);
  });

  it('respects the limit query param', async () => {
    const res = await request(app).get('/api/workouts?limit=2').set(...auth(userA.token));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.logs.map((l) => l.exerciseName)).toEqual(['Deadlift', 'Bench Press']);
  });
});

describe('GET /api/workouts/stats', () => {
  it('rejects without a token', async () => {
    const res = await request(app).get('/api/workouts/stats');
    expect(res.status).toBe(401);
  });

  it('returns zeroed stats for a user with no workouts', async () => {
    const u = await register('No Workouts', 'no-workouts@example.com');
    const res = await request(app).get('/api/workouts/stats').set(...auth(u.token));

    expect(res.status).toBe(200);
    expect(res.body.stats).toEqual({
      totalWorkouts: 0,
      totalCalories: 0,
      totalMinutes: 0,
      last7Days: 0,
    });
  });

  it('aggregates totals and counts recent workouts', async () => {
    const u = await register('Stats User', 'workout-stats@example.com');

    await WorkoutLog.create({ userId: u.user.id, exerciseName: 'Squat', durationMin: 30, caloriesBurned: 200 });
    await WorkoutLog.create({ userId: u.user.id, exerciseName: 'Bench', durationMin: 45, caloriesBurned: 300 });
    await WorkoutLog.create({ userId: u.user.id, exerciseName: 'Row', durationMin: 20, caloriesBurned: 150 });

    const res = await request(app).get('/api/workouts/stats').set(...auth(u.token));
    expect(res.status).toBe(200);
    expect(res.body.stats).toEqual({
      totalWorkouts: 3,
      totalCalories: 650,
      totalMinutes: 95,
      last7Days: 3,
    });
  });
});
