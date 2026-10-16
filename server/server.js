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
if (String(process.env.OBJECT_STORAGE_PROVIDER || 'local').toLowerCase() !== 's3') {
  fs.mkdirSync(path.resolve(projectRoot, process.env.LOCAL_UPLOAD_ROOT || 'server/data/uploads'), { recursive: true });
}

// Middleware
const configuredOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
if (isProduction) {
  const requiredStorageSettings = [
    'S3_BUCKET', 'S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'
  ];
  const missingStorageSettings = requiredStorageSettings.filter(key => !String(process.env[key] || '').trim());
  if (String(process.env.OBJECT_STORAGE_PROVIDER || '').toLowerCase() !== 's3' || missingStorageSettings.length) {
    throw new Error(`Production requires Cloudflare R2 storage. Configure OBJECT_STORAGE_PROVIDER=s3 and: ${missingStorageSettings.join(', ') || 'OBJECT_STORAGE_PROVIDER'}.`);
  }
}
const developmentOrigins = isProduction ? [] : [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];
const defaultAllowedOrigins = [
  ...developmentOrigins,
  ...(process.env.APP_URL ? [process.env.APP_URL.trim()] : [])
];

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...configuredOrigins]))
  .filter(origin => !isProduction || !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));

const isDevLocalOrigin = (origin) => !isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

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
    version: '3.0.0'
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
    path: req.path.replace(/(\/verify-email\/)[^/]+/ig, '$1[redacted]')
  });
  return res.status(404).json({
    error: 'This feature could not be found. Refresh the page and try again.',
    code,
    requestId: req.requestId
  });
});

// Explicit non-API 404 handler (for mistyped backend URLs).
app.use((req, res) => {
  return res.status(404).json({
    error: 'The requested page could not be found.',
    code: 'BACKEND_ROUTE_NOT_FOUND',
    requestId: req.requestId
  });
});

// Centralized error handler: useful diagnostics are written to backend logs;
// clients receive human-readable messages without stacks, database details, or
// Cloudflare/S3 error text.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  let status = Number(err.status) || 500;
  if (!Number.isInteger(status) || status < 400 || status > 599) status = 500;
  let code = err.code || (status >= 500 ? 'INTERNAL_SERVER_ERROR' : status === 403 ? 'REQUEST_FORBIDDEN' : status === 401 ? 'AUTHENTICATION_REQUIRED' : status === 400 ? 'INVALID_REQUEST' : status === 413 ? 'REQUEST_TOO_LARGE' : 'REQUEST_FAILED');
  let message = status >= 500
    ? 'Something went wrong. Please try again later.'
    : status === 413
      ? 'The uploaded file or request is too large.'
      : status === 401
        ? 'Please sign in again to continue.'
        : status === 403
          ? 'You do not have permission to perform this action.'
          : status === 404
            ? 'The requested item could not be found.'
            : status === 429
              ? 'Too many attempts. Please wait and try again.'
              : 'We could not process that request. Please check your information and try again.';

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      status = 413;
      code = 'UPLOAD_FILE_TOO_LARGE';
      message = 'The uploaded file is too large. Choose a smaller file and try again.';
    } else if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      status = 400;
      code = 'UPLOAD_FILE_COUNT_INVALID';
      message = 'Please upload one supported file at a time.';
    } else {
      status = 400;
      code = 'UPLOAD_PROCESSING_FAILED';
      message = 'The uploaded file could not be processed. Please try again.';
    }
  } else if (err.type === 'entity.too.large') {
    status = 413;
    code = 'REQUEST_BODY_TOO_LARGE';
    message = 'The submitted information is too large. Please shorten it and try again.';
  }

  logger.error('http.error', {
    requestId: req.requestId,
    method: req.method,
    path: req.path.replace(/(\/verify-email\/)[^/]+/ig, '$1[redacted]'),
    code,
    status,
    error: err
  });
  return res.status(status).json({ error: message, code, requestId: req.requestId });
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
