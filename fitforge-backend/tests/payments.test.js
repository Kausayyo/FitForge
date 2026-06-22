process.env.RAZORPAY_KEY_ID = 'rzp_test_123';
process.env.RAZORPAY_KEY_SECRET = 'test_secret';

jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockResolvedValue({
        id: 'order_test123',
        amount: 99900,
        currency: 'INR',
        status: 'created',
      }),
    },
  }));
});

const request = require('supertest');
const crypto = require('crypto');
const { setup, teardown } = require('./helpers/db');
const User = require('../models/User');
const Payment = require('../models/Payment');

let app;
let userA;
let userB;
let userC;

async function register(name, email) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'password123' });
  return { token: res.body.token, user: res.body.user };
}

const auth = (token) => ['Authorization', `Bearer ${token}`];

beforeAll(async () => {
  app = await setup();
  userA = await register('Trial User', 'trial@example.com');
  userB = await register('Already Premium', 'already-premium@example.com');
  userC = await register('Trial Used', 'trial-used@example.com');

  const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  await User.findByIdAndUpdate(userB.user.id, { isPremium: true, premiumExpiresAt: future });
  await User.findByIdAndUpdate(userC.user.id, { trialUsed: true });
});

afterAll(async () => {
  await teardown();
});

describe('GET /api/payments/status', () => {
  it('rejects without a token', async () => {
    const res = await request(app).get('/api/payments/status');
    expect(res.status).toBe(401);
  });

  it('returns trial-not-used status for a new user', async () => {
    const res = await request(app).get('/api/payments/status').set(...auth(userA.token));
    expect(res.status).toBe(200);
    expect(res.body.isPremium).toBe(false);
    expect(res.body.trialUsed).toBe(false);
    expect(res.body.daysLeft).toBe(0);
    expect(res.body.trialPrice).toBe(999); // 99900 paise / 100
    expect(res.body.currency).toBe('₹');
  });
});

describe('POST /api/payments/create-order', () => {
  it('rejects a user who already has active premium', async () => {
    const res = await request(app)
      .post('/api/payments/create-order')
      .set(...auth(userB.token))
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects a user who has already used their trial', async () => {
    const res = await request(app)
      .post('/api/payments/create-order')
      .set(...auth(userC.token))
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.trialUsed).toBe(true);
  });

  it('creates a Razorpay order and a pending Payment record', async () => {
    const res = await request(app)
      .post('/api/payments/create-order')
      .set(...auth(userA.token))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.orderId).toBe('order_test123');
    expect(res.body.amount).toBe(99900);
    expect(res.body.currency).toBe('INR');
    expect(res.body.keyId).toBe('rzp_test_123');
    expect(res.body.userEmail).toBe('trial@example.com');
    expect(res.body.description).toContain('30-Day Trial');

    const payment = await Payment.findOne({ razorpayOrderId: 'order_test123' });
    expect(payment).toBeTruthy();
    expect(payment.status).toBe('pending');
    expect(payment.userId.toString()).toBe(userA.user.id);
  });
});

describe('POST /api/payments/verify', () => {
  it('rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/payments/verify')
      .set(...auth(userA.token))
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects an invalid signature', async () => {
    const res = await request(app)
      .post('/api/payments/verify')
      .set(...auth(userA.token))
      .send({
        razorpayOrderId: 'order_test123',
        razorpayPaymentId: 'pay_test123',
        razorpaySignature: 'bogus-signature',
      });
    expect(res.status).toBe(400);
  });

  it('activates premium and marks the payment paid with a valid signature', async () => {
    const expectedSignature = crypto
      .createHmac('sha256', 'test_secret')
      .update('order_test123|pay_test123')
      .digest('hex');

    const res = await request(app)
      .post('/api/payments/verify')
      .set(...auth(userA.token))
      .send({
        razorpayOrderId: 'order_test123',
        razorpayPaymentId: 'pay_test123',
        razorpaySignature: expectedSignature,
      });

    expect(res.status).toBe(200);
    expect(res.body.trialDays).toBe(30);
    expect(res.body.premiumExpiresAt).toBeTruthy();

    const me = await request(app).get('/api/users/me').set(...auth(userA.token));
    expect(me.body.user.isPremium).toBe(true);
    expect(me.body.user.trialUsed).toBe(true);

    const payment = await Payment.findOne({ razorpayOrderId: 'order_test123' });
    expect(payment.status).toBe('paid');
    expect(payment.razorpayPaymentId).toBe('pay_test123');
    expect(payment.paidAt).toBeTruthy();
  });

  it('reflects the new premium status via GET /status', async () => {
    const res = await request(app).get('/api/payments/status').set(...auth(userA.token));
    expect(res.status).toBe(200);
    expect(res.body.isPremium).toBe(true);
    expect(res.body.trialUsed).toBe(true);
    expect(res.body.daysLeft).toBeGreaterThanOrEqual(29);
    expect(res.body.daysLeft).toBeLessThanOrEqual(30);
  });

  it('rejects creating a new order now that the user is premium', async () => {
    const res = await request(app)
      .post('/api/payments/create-order')
      .set(...auth(userA.token))
      .send({});
    expect(res.status).toBe(400);
  });
});
