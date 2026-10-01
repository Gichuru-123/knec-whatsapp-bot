const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const port = parseInt(process.env.PORT, 10) || 3000;
const nodeEnv = process.env.NODE_ENV || 'development';
const logLevel = process.env.LOG_LEVEL || 'info';

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) 
  : ['http://localhost:3000'];

const enableDevInspectionRoutes = process.env.ENABLE_DEV_INSPECTION_ROUTES 
  ? process.env.ENABLE_DEV_INSPECTION_ROUTES === 'true'
  : nodeEnv !== 'production';

module.exports = {
  port,
  nodeEnv,
  logLevel,
  allowedOrigins,
  enableDevInspectionRoutes,
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    verifyToken: process.env.VERIFY_TOKEN || ''
  }
};
