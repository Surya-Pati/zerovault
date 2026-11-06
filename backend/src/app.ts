import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './auth/auth.routes';
import adminRoutes from './admin/admin.routes';
import listingsRoutes from './listings/listings.routes';
import escrowRoutes from './routes/escrow.routes';

const app = express();

app.use((req, res, next) => { console.log(`[API] ${req.method} ${req.url}`); next(); });

// ─── Security Headers ───────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'http://localhost:3001'],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow cross-origin requests from frontend
}));

// ─── CORS — restrict to known origins ───────────────────────────────
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS: Origin not allowed'));
  },
  credentials: true,
}));

// ─── Body parsing with size limit ───────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ─── Rate Limiting ──────────────────────────────────────────────────
// General API rate limit
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 5000, // Very high in dev to prevent blocking HMR/testing
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Auth rate limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 5000, // Very high in dev to prevent blocking testing
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

app.use('/api/', generalLimiter);
app.use('/api/auth/verify-siwe', authLimiter);

// ─── Routes ─────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/escrow', escrowRoutes);

// ─── Global Error Handler ───────────────────────────────────────────
// Catches unhandled errors and prevents stack trace leakage
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // CORS errors
  if (err.message.includes('CORS')) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  
  console.error('[GlobalErrorHandler]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
