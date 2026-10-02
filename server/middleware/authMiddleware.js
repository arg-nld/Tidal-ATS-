import { store } from '../services/store.js';

/**
 * Middleware to extract and verify user from headers
 * Accepts Authorization: Bearer <userId> or X-User-Id / X-User-Role
 */
export function authenticate(req, res, next) {
  let userId = null;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    userId = authHeader.substring(7).trim();
  }

  if (!userId) {
    userId = req.headers['x-user-id'];
  }

  if (userId) {
    const user = store.getUserById(userId);
    if (user) {
      req.user = user;
    }
  }

  // Fallback for demo convenience if header passes role
  if (!req.user && req.headers['x-user-role']) {
    const role = req.headers['x-user-role'];
    const users = store.getUsers();
    req.user = users.find(u => u.role === role) || null;
  }

  next();
}

/**
 * Require any authenticated user
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
 * Require specific role(s) ('hr', 'applicant')
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
        error: `Access denied. Requires one of [${allowedRoles.join(', ')}] role. Current role: ${req.user.role}`
      });
    }

    next();
  };
}
