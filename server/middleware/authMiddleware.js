import { store } from '../services/store.js';

/**
 * Extracts the Bearer session token and resolves it against the server-side
 * session store. The client no longer controls user IDs or roles through
 * custom headers.
 */
export function authenticate(req, res, next) {
  const authHeader = String(req.headers.authorization || '');

  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return next();
  }

  const token = authHeader.slice(7).trim();
  if (!token || token.length < 40) {
    return next();
  }

  const user = store.getUserBySessionToken(token);
  if (user) {
    req.user = user;
    req.authToken = token;
  }

  next();
}

/**
 * Require any authenticated user.
 */
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required. Please sign in to access this resource.'
    });
  }
  next();
}

/**
 * Require one of the supplied server-side roles.
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Access denied for this account.'
      });
    }

    next();
  };
}
