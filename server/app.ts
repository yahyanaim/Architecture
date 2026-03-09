import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './api/middlewares/errorHandler';

import { swaggerSpec } from './config/swagger';
import swaggerUi from 'swagger-ui-express';
import { userRoutes } from './api/routes/userRoutes';

const app = express();

// needed so req.ip works behind a proxy
app.set('trust proxy', 1);

// 100 reqs / 15 min per IP
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
app.use(cors());
app.use(helmet({
  contentSecurityPolicy: false, // off for vite dev
}));

app.use(morgan('dev'));

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/users', userRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// must be last
app.use(errorHandler);

export { app };
