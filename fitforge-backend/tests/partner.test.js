const request = require('supertest');
const { setup, teardown } = require('./helpers/db');

let app;
let her;
let him;
let stranger;

async function register(name, email) {
  const res = await request(app).post('/api/auth/register').send({
    name,
    email,
    password: 'password123',
  });
  return { token: res.body.token, user: res.body.user };
}

beforeAll(async () => {
  app = await setup();
  her = await register('Priya', 'priya@example.com');
  him = await register('Rahul', 'rahul@example.com');
  stranger = await register('Stranger', 'stranger@example.com');
});

afterAll(async () => {
  await teardown();
});

const auth = (token) => ['Authorization', `Bearer ${token}`];

describe('POST /api/partner/invite — validation', () => {
  it('rejects an invalid email', async () => {
    const res = await request(app)
      .post('/api/partner/invite')
      .set(...auth(her.token))
      .send({ partnerEmail: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('rejects inviting yourself', async () => {
    const res = await request(app)
      .post('/api/partner/invite')
      .set(...auth(her.token))
      .send({ partnerEmail: her.user.email });
    expect(res.status).toBe(400);
  });
});

describe('Invite -> decline -> re-invite -> accept flow', () => {
  let firstLinkId;

  it('sends an invite (pending)', async () => {
    const res = await request(app)
      .post('/api/partner/invite')
      .set(...auth(her.token))
      .send({ partnerEmail: him.user.email });
    expect(res.status).toBe(201);
    expect(res.body.link.status).toBe('pending');
    expect(res.body.link.partnerEmail).toBe(him.user.email.toLowerCase());
    firstLinkId = res.body.link.id;
    expect(firstLinkId).toBeTruthy();
  });

  it('blocks a second invite while one is active', async () => {
    const res = await request(app)
      .post('/api/partner/invite')
      .set(...auth(her.token))
      .send({ partnerEmail: stranger.user.email });
    expect(res.status).toBe(400);
  });

  it('shows the pending invite to the recipient via GET /', async () => {
    const res = await request(app).get('/api/partner').set(...auth(him.token));
    expect(res.status).toBe(200);
    expect(res.body.asRecipient).toHaveLength(1);
    expect(res.body.asRecipient[0].id).toBe(firstLinkId);
    expect(res.body.asRecipient[0].status).toBe('pending');
  });

  it('shows the outgoing link to the sharer via GET /', async () => {
    const res = await request(app).get('/api/partner').set(...auth(her.token));
    expect(res.status).toBe(200);
    expect(res.body.asSharer.id).toBe(firstLinkId);
    expect(res.body.asSharer.status).toBe('pending');
  });

  it('rejects respond from someone other than the invited partner', async () => {
    const res = await request(app)
      .post('/api/partner/respond')
      .set(...auth(stranger.token))
      .send({ linkId: firstLinkId, accept: true });
    expect(res.status).toBe(404);
  });

  it('lets the partner decline', async () => {
    const res = await request(app)
      .post('/api/partner/respond')
      .set(...auth(him.token))
      .send({ linkId: firstLinkId, accept: false });
    expect(res.status).toBe(200);
    expect(res.body.link.status).toBe('declined');
  });

  it('allows a fresh invite after a decline (old link is cleaned up)', async () => {
    const res = await request(app)
      .post('/api/partner/invite')
      .set(...auth(her.token))
      .send({ partnerEmail: him.user.email });
    expect(res.status).toBe(201);
    expect(res.body.link.id).not.toBe(firstLinkId);
    firstLinkId = res.body.link.id;
  });

  it('lets the partner accept', async () => {
    const res = await request(app)
      .post('/api/partner/respond')
      .set(...auth(him.token))
      .send({ linkId: firstLinkId, accept: true });
    expect(res.status).toBe(200);
    expect(res.body.link.status).toBe('accepted');
  });
});

describe('Cycle prediction sync + privacy controls', () => {
  it('reports linked:false before any sync', async () => {
    const res = await request(app).get('/api/partner/cycle-status').set(...auth(him.token));
    expect(res.status).toBe(200);
    expect(res.body.linked).toBe(false);
  });

  it('rejects sync-cycle with an invalid phase', async () => {
    const res = await request(app)
      .post('/api/partner/sync-cycle')
      .set(...auth(her.token))
      .send({ nextPeriodDate: '2026-07-01', currentPhase: 'bogus' });
    expect(res.status).toBe(400);
  });

  it('syncs a valid prediction', async () => {
    const res = await request(app)
      .post('/api/partner/sync-cycle')
      .set(...auth(her.token))
      .send({ nextPeriodDate: '2026-07-01', currentPhase: 'luteal' });
    expect(res.status).toBe(200);
    expect(res.body.synced).toBe(true);
  });

  it('exposes the synced prediction to the partner', async () => {
    const res = await request(app).get('/api/partner/cycle-status').set(...auth(him.token));
    expect(res.status).toBe(200);
    expect(res.body.linked).toBe(true);
    expect(res.body.partnerName).toBe('Priya');
    expect(res.body.currentPhase).toBe('luteal');
    expect(new Date(res.body.nextPeriodDate).toISOString().slice(0, 10)).toBe('2026-07-01');
  });

  it('never exposes raw cycle fields to the partner', async () => {
    const res = await request(app).get('/api/partner/cycle-status').set(...auth(him.token));
    const keys = Object.keys(res.body);
    expect(keys).not.toContain('lastPeriod');
    expect(keys).not.toContain('cycleLength');
    expect(keys.sort()).toEqual(['currentPhase', 'linked', 'nextPeriodDate', 'partnerName', 'updatedAt'].sort());
  });

  it('turning sharing off wipes the stored prediction', async () => {
    const toggle = await request(app)
      .put('/api/partner/sharing')
      .set(...auth(her.token))
      .send({ enabled: false });
    expect(toggle.status).toBe(200);
    expect(toggle.body.link.cyclePrediction.currentPhase).toBeNull();

    const status = await request(app).get('/api/partner/cycle-status').set(...auth(him.token));
    expect(status.body.linked).toBe(false);
  });

  it('sync-cycle no-ops while sharing is off', async () => {
    const res = await request(app)
      .post('/api/partner/sync-cycle')
      .set(...auth(her.token))
      .send({ nextPeriodDate: '2026-07-05', currentPhase: 'menstrual' });
    expect(res.status).toBe(200);
    expect(res.body.synced).toBe(false);

    const status = await request(app).get('/api/partner/cycle-status').set(...auth(him.token));
    expect(status.body.linked).toBe(false);
  });

  it('re-enabling sharing and syncing restores partner visibility', async () => {
    await request(app).put('/api/partner/sharing').set(...auth(her.token)).send({ enabled: true });
    await request(app)
      .post('/api/partner/sync-cycle')
      .set(...auth(her.token))
      .send({ nextPeriodDate: '2026-07-05', currentPhase: 'menstrual' });

    const status = await request(app).get('/api/partner/cycle-status').set(...auth(him.token));
    expect(status.body.linked).toBe(true);
    expect(status.body.currentPhase).toBe('menstrual');
  });
});

describe('DELETE /api/partner/:linkId — unlink', () => {
  let linkId;

  beforeAll(async () => {
    const res = await request(app).get('/api/partner').set(...auth(her.token));
    linkId = res.body.asSharer.id;
  });

  it('forbids unlink by an unrelated user', async () => {
    const res = await request(app).delete(`/api/partner/${linkId}`).set(...auth(stranger.token));
    expect(res.status).toBe(403);
  });

  it('allows the sharer to unlink', async () => {
    const res = await request(app).delete(`/api/partner/${linkId}`).set(...auth(her.token));
    expect(res.status).toBe(200);
  });

  it('clears the link for both sides', async () => {
    const sharer = await request(app).get('/api/partner').set(...auth(her.token));
    expect(sharer.body.asSharer).toBeNull();

    const partner = await request(app).get('/api/partner').set(...auth(him.token));
    expect(partner.body.asRecipient.find((l) => l.id === linkId)).toBeUndefined();

    const status = await request(app).get('/api/partner/cycle-status').set(...auth(him.token));
    expect(status.body.linked).toBe(false);
  });

  it('allows inviting again after unlink', async () => {
    const res = await request(app)
      .post('/api/partner/invite')
      .set(...auth(her.token))
      .send({ partnerEmail: him.user.email });
    expect(res.status).toBe(201);
  });
});
