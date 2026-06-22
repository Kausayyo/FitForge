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

describe('GET /api/groceries', () => {
  it('rejects without a token', async () => {
    const res = await request(app).get('/api/groceries');
    expect(res.status).toBe(401);
  });

  it('defaults to Hyderabad when the user has no city set', async () => {
    const u = await register('No City', 'no-city@example.com');
    const res = await request(app).get('/api/groceries').set(...auth(u.token));

    expect(res.status).toBe(200);
    expect(res.body.city).toBe('Hyderabad');
    expect(res.body.totalWeeklyInr).toBe(1000);
    expect(res.body.availableCities).toEqual(['Hyderabad', 'Mumbai']);
    expect(res.body.grocery.Protein).toHaveLength(3);
    expect(res.body.grocery.Carbs).toHaveLength(3);
    expect(res.body.grocery.Fats).toHaveLength(2);
    expect(res.body.grocery.Vegetables).toHaveLength(3);
    expect(res.body.grocery.Protein[0]).toEqual({
      item: 'Chicken breast',
      quantity: '500g/wk',
      price_inr: 120,
    });
  });

  it("uses the user's saved city when no ?city query is given", async () => {
    const u = await register('Mumbai User', 'mumbai-user@example.com', { city: 'Mumbai' });
    const res = await request(app).get('/api/groceries').set(...auth(u.token));

    expect(res.status).toBe(200);
    expect(res.body.city).toBe('Mumbai');
    expect(res.body.totalWeeklyInr).toBe(920);
    expect(res.body.grocery.Protein).toHaveLength(3);
    expect(res.body.grocery.Fats).toHaveLength(1);
  });

  it('lets a ?city query override the saved city', async () => {
    const u = await register('Override City', 'override-city@example.com', { city: 'Mumbai' });
    const res = await request(app).get('/api/groceries?city=Hyderabad').set(...auth(u.token));

    expect(res.status).toBe(200);
    expect(res.body.city).toBe('Hyderabad');
    expect(res.body.totalWeeklyInr).toBe(1000);
  });

  it('falls back to the Hyderabad list for an unrecognized city', async () => {
    const u = await register('Unknown City', 'unknown-city@example.com');
    const res = await request(app).get('/api/groceries?city=Chennai').set(...auth(u.token));

    expect(res.status).toBe(200);
    expect(res.body.city).toBe('Chennai');
    expect(res.body.totalWeeklyInr).toBe(1000); // falls back to Hyderabad's list
  });
});
