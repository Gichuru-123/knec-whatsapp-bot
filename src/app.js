const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const notFoundHandler = require('./middleware/notFoundHandler');
const healthRoutes = require('./routes/healthRoutes');
const kbRoutes = require('./routes/kbRoutes');

const app = express();

// Security headers via Helmet
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

// Routes
app.use('/', healthRoutes);
app.use('/api/v1', kbRoutes);

// 404 and Centralized Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
