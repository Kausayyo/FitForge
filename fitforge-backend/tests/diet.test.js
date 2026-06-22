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

describe('GET /api/diet/plan', () => {
  it('rejects without a token', async () => {
    const res = await request(app).get('/api/diet/plan');
    expect(res.status).toBe(401);
  });

  it('uses default profile values (70kg/170cm/25yo/sedentary/general_fitness)', async () => {
    const u = await register('Default Profile', 'default-diet@example.com');
    const res = await request(app).get('/api/diet/plan').set(...auth(u.token));

    expect(res.status).toBe(200);
    // BMR = 10*70 + 6.25*170 - 5*25 + 5 = 1642.5; TDEE = round(1642.5*1.2) = 1971
    expect(res.body.macros.tdee).toBe(1971);
    expect(res.body.macros.calories).toBe(1971); // general_fitness: no adjustment
    expect(res.body.macros.protein).toBe(140); // 70 * 2
    expect(res.body.macros.fats).toBe(61);
    expect(res.body.macros.carbs).toBe(216);

    expect(res.body.meals).toHaveLength(4);
    const [breakfast, lunch, preworkout, dinner] = res.body.meals;
    expect(breakfast.name).toBe('Breakfast');
    expect(breakfast.calories).toBe(493);
    expect(breakfast.protein).toBe(35);
    expect(breakfast.foods).toContain('3 boiled eggs');
    expect(lunch.calories).toBe(690);
    expect(lunch.protein).toBe(49);
    expect(lunch.foods).toContain('Chicken breast 150g');
    expect(preworkout.calories).toBe(197);
    expect(preworkout.protein).toBe(14);
    expect(dinner.calories).toBe(591);
    expect(dinner.protein).toBe(42);
  });

  it('applies a -500 calorie deficit for weight_loss and a vegetarian menu', async () => {
    const u = await register('Weight Loss Veg', 'weightloss-veg@example.com', {
      age: '30',
      weight: '80',
      height: '175',
      workType: 'moderate',
      fitnessGoal: 'weight_loss',
      habits: ['vegetarian'],
    });
    const res = await request(app).get('/api/diet/plan').set(...auth(u.token));

    expect(res.status).toBe(200);
    // BMR = 10*80 + 6.25*175 - 5*30 + 5 = 1748.75; TDEE = round(1748.75*1.55) = 2711
    expect(res.body.macros.tdee).toBe(2711);
    expect(res.body.macros.calories).toBe(2211); // 2711 - 500
    expect(res.body.macros.protein).toBe(160); // 80 * 2
    expect(res.body.macros.fats).toBe(69);
    expect(res.body.macros.carbs).toBe(238);

    const [breakfast, lunch, , dinner] = res.body.meals;
    expect(breakfast.foods).toContain('2 boiled eggs or paneer');
    expect(lunch.foods).toContain('Dal + rice');
    expect(dinner.foods).toContain('Paneer curry');
  });

  it('applies a +300 calorie surplus for muscle_gain with a heavy activity multiplier', async () => {
    const u = await register('Muscle Gain Heavy', 'musclegain-heavy@example.com', {
      age: '22',
      weight: '90',
      height: '180',
      workType: 'heavy',
      fitnessGoal: 'muscle_gain',
    });
    const res = await request(app).get('/api/diet/plan').set(...auth(u.token));

    expect(res.status).toBe(200);
    // BMR = 10*90 + 6.25*180 - 5*22 + 5 = 1920; TDEE = round(1920*1.725) = 3312
    expect(res.body.macros.tdee).toBe(3312);
    expect(res.body.macros.calories).toBe(3612); // 3312 + 300
    expect(res.body.macros.protein).toBe(180); // 90 * 2
    expect(res.body.macros.fats).toBe(112);
    expect(res.body.macros.carbs).toBe(471);
  });
});
