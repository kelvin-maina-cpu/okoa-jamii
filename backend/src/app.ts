import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { authRoutes } from './routes/authRoutes.js';
import { incidentRoutes } from './routes/incidentRoutes.js';
import { alertRoutes } from './routes/alertRoutes.js';
import { analyticsRoutes } from './routes/analyticsRoutes.js';
import { auditRoutes } from './routes/auditRoutes.js';
import { notificationRoutes } from './routes/notificationRoutes.js';
import { apiRateLimiter } from './middleware/rateLimiters.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((origin) => origin.trim()).filter(Boolean);
  app.use(cors({ origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Origin is not allowed by CORS'));
  } }));
  app.use('/api', apiRateLimiter);
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'Okoa Jamii API', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/incidents', incidentRoutes);
  app.use('/api/alerts', alertRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/notifications', notificationRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
