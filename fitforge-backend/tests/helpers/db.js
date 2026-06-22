const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;

// Spins up an in-memory MongoDB, points the app at it via env vars BEFORE
// requiring server.js, and returns the Express app once connected.
async function setup() {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';

  const app = require('../../server');
  await mongoose.connection.asPromise();
  return app;
}

async function teardown() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
}

module.exports = { setup, teardown };
