import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import applicationRoutes from './routes/applicationRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { authenticate } from './middleware/authMiddleware.js';
import { globalRateLimiter } from './middleware/rateLimit.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import multer from 'multer';
import fs from 'fs';
import { store } from './services/store.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
fs.mkdirSync('server/data/uploads', { recursive: true });

// Middleware
const allowedOrigins = String(process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.set('trust proxy', String(process.env.TRUST_PROXY || '').toLowerCase() === 'true' ? 1 : false);
app.use(securityHeaders);

app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin/non-browser requests with no Origin header.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    const error = new Error('Origin is not allowed by CORS.');
    error.status = 403;
    return callback(error);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Resolve the server-side session before rate limiting endpoints that can use an account key.
app.use(authenticate);

// Broad abuse protection. Sensitive routes apply tighter limits below.
app.use('/api', globalRateLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Tidal ATS Backend API',
    version: '3.0.0',
    persistence: store.getPersistenceStatus()
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.stack || err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Uploaded file exceeds the allowed size limit.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Too many files or an unsupported file field was provided.' });
    }
    return res.status(400).json({ error: 'The uploaded file could not be processed.' });
  }

  const status = Number(err.status) || 500;
  return res.status(status).json({
    error: status >= 500 ? 'Internal Server Error' : (err.message || 'Request failed.')
  });
});

const httpServer = app.listen(PORT, () => {
  console.log(`\n🚀 Tidal ATS Backend Server listening at http://localhost:${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health\n`);
});

function shutdown(signal) {
  console.log(`[Server] ${signal} received. Saving data before shutdown...`);
  try { store.save(); } catch (err) { console.error('[Server] Final database save failed:', err.message); }
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

export default app;
