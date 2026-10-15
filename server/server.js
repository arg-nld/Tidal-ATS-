import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import authRoutes from './routes/authRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import applicationRoutes from './routes/applicationRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import { authenticate } from './middleware/authMiddleware.js';
import { globalRateLimiter } from './middleware/rateLimit.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import multer from 'multer';
import fs from 'fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { store } from './services/store.js';
import { logger, requestLogger } from './services/logger.js';


const app = express();
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendDistPath = path.join(projectRoot, 'dist');
const PORT = process.env.BACKEND_PORT || process.env.PORT || 5000;
fs.mkdirSync('server/data/uploads', { recursive: true });

// Middleware
const configuredOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...(process.env.APP_URL ? [process.env.APP_URL.trim()] : [])
];

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...configuredOrigins]));

const isDevLocalOrigin = (origin) => {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
};

app.disable('x-powered-by');
app.set('trust proxy', String(process.env.TRUST_PROXY || '').toLowerCase() === 'true' ? 1 : false);
app.use(securityHeaders);
app.use((req, _res, next) => { req.requestId = crypto.randomUUID(); next(); });
app.use(requestLogger);

app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin/non-browser requests or local development origins
    if (!origin || allowedOrigins.includes(origin) || isDevLocalOrigin(origin)) {
      return callback(null, true);
    }
    const error = new Error('Origin is not allowed by CORS.');
    error.status = 403;
    return callback(error);
  },
  credentials: true,
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
app.use('/api/analytics', analyticsRoutes);

// Log key route registrations at startup so a mismatched/old backend is easier
// to spot in the terminal when diagnosing forgot-password requests.
logger.info('server.api_routes_registered', {
  routes: [
    'POST /api/auth/forgot-password',
    'POST /api/auth/reset-password',
    'GET /api/health'
  ]
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Tidal ATS Backend API',
    version: '3.0.0',
    persistence: await store.getPersistenceStatus()
  });
});

// In a single-service production deployment, serve the built React app from
// this Express process. The same-origin /api base then works without a public
// frontend API URL or any reference to localhost in the production bundle.
if (fs.existsSync(path.join(frontendDistPath, 'index.html'))) {
  app.use(express.static(frontendDistPath));
  app.get(/^(?!\/api(?:\/|$)).*/, (req, res, next) => {
    if (!req.accepts('html')) return next();
    return res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
  logger.info('server.frontend_dist_served', { directory: frontendDistPath });
}

// Explicit API 404 handler. Express's default HTML 404 made it hard to tell
// whether a route was missing or a controller could not find a record.
app.use('/api', (req, res) => {
  const code = 'API_ROUTE_NOT_FOUND';
  logger.warn('http.route_not_found', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl
  });
  return res.status(404).json({
    error: `No API route matches ${req.method} ${req.originalUrl}.`,
    code,
    requestId: req.requestId,
    diagnostic: {
      layer: 'routing',
      method: req.method,
      path: req.originalUrl,
      hint: 'Confirm the frontend URL, HTTP method, server port, and route mount in server/server.js.'
    }
  });
});

// Explicit non-API 404 handler (for mistyped backend URLs).
app.use((req, res) => {
  return res.status(404).json({
    error: `No backend route matches ${req.method} ${req.originalUrl}.`,
    code: 'BACKEND_ROUTE_NOT_FOUND',
    requestId: req.requestId,
    diagnostic: { layer: 'routing', method: req.method, path: req.originalUrl }
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  let status = Number(err.status) || 500;
  let code = err.code || (status >= 500 ? 'INTERNAL_SERVER_ERROR' : status === 403 ? 'REQUEST_FORBIDDEN' : status === 401 ? 'AUTHENTICATION_REQUIRED' : status === 400 ? 'INVALID_REQUEST' : 'REQUEST_FAILED');
  let message = status >= 500 ? 'The server encountered an unexpected error.' : (err.message || 'Request failed.');

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      status = 413;
      code = 'UPLOAD_FILE_TOO_LARGE';
      message = 'Uploaded file exceeds the allowed size limit.';
    } else if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      status = 400;
      code = 'UPLOAD_FILE_COUNT_INVALID';
      message = 'Too many files or an unsupported file field was provided.';
    } else {
      status = 400;
      code = 'UPLOAD_PROCESSING_FAILED';
      message = 'The uploaded file could not be processed.';
    }
  } else if (err.message === 'Origin is not allowed by CORS.') {
    code = 'CORS_ORIGIN_REJECTED';
    message = 'This frontend origin is not allowed by the backend CORS configuration.';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    code = 'REQUEST_BODY_TOO_LARGE';
    message = 'Request body exceeds the allowed size limit.';
  }

  logger.error('http.error', { requestId: req.requestId, code, status, error: err });
  return res.status(status).json({
    error: message,
    code,
    requestId: req.requestId,
    ...(process.env.NODE_ENV !== 'production' ? { diagnostic: { method: req.method, path: req.originalUrl } } : {})
  });
});

await store.ready?.();

const httpServer = app.listen(PORT, () => {
  logger.info('server.started', { port: PORT, persistence: process.env.DATABASE_URL ? 'postgresql' : 'json' });
  
});

async function shutdown(signal) {
  logger.info('server.shutdown', { signal });
  try {
    await store.save?.();
  } catch (err) {
    logger.error('server.shutdown.save_failed', { error: err });
  }
  try {
    await store.close?.();
  } catch (err) {
    logger.error('server.shutdown.close_failed', { error: err });
  }
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

export default app;
