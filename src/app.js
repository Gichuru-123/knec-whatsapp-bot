const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const requestLogger = require('./middleware/requestLogger');
const healthRoutes = require('./routes/healthRoutes');

const app = express();

// Security headers via Helmet (Helmet v7+)
app.use(helmet({
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: false
}));

// CORS Configuration
app.use(cors({
  origin: config.allowedOrigins,
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-request-id']
}));

// Body parsing middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Correlation ID & Request Logging
app.use(requestLogger);

// Public Health Check Endpoint
app.use('/', healthRoutes);

module.exports = app;
