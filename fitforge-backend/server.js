require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const exerciseRoutes = require('./routes/exercises');
const dietRoutes = require('./routes/diet');
const groceryRoutes = require('./routes/groceries');
const trainerRoutes = require('./routes/trainers');
const paymentRoutes = require('./routes/payments');
const workoutRoutes = require('./routes/workouts');
const aiRoutes = require('./routes/ai');
const partnerRoutes = require('./routes/partner');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGODB_URI;

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'FitForge API is running 💪', version: '1.0.0' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/diet', dietRoutes);
app.use('/api/groceries', groceryRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/trainers', trainerRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/partner', partnerRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 FitForge Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/`);
  });
}

module.exports = app;
