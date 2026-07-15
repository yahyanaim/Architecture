import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './api/middleware/errorHandler';
import { requestId } from './api/middleware/requestId';

import { swaggerSpec } from './config/swagger';
import swaggerUi from 'swagger-ui-express';
import { userRoutes } from './api/routes/userRoutes';
import { authRoutes } from './api/routes/authRoutes';
import { profileRoutes } from './api/routes/profileRoutes';

const app = express();

app.set('trust proxy', 1);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }
});

app.use('/api', apiLimiter);

app.use(express.json());
app.use(cookieParser());
app.use(requestId);

const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:4000';
app.use(cors({ origin: allowedOrigin, credentials: true }));

app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production',
}));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

if (process.env.NODE_ENV !== 'production') {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/profile', profileRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

export { app };
