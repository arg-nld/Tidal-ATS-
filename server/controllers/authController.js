import { store } from '../services/store.js';

/** Strip password before sending user to client */
function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

export function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = store.getUserByEmailAndPassword(email, password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  return res.json({
    user: sanitizeUser(user),
    token: user.id
  });
}

export function register(req, res) {
  const { name, email, password, role, title, company, phone } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required.' });
  }

  if (!['hr', 'applicant'].includes(role)) {
    return res.status(400).json({ error: 'Role must be "hr" or "applicant".' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const existing = store.getUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const newUser = store.createUser({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password,
    role,
    title: title || (role === 'hr' ? 'HR Recruiter' : 'Candidate'),
    company: company || (role === 'hr' ? 'Tidal Technologies' : undefined),
    phone: phone || undefined
  });

  return res.status(201).json({
    user: sanitizeUser(newUser),
    token: newUser.id
  });
}

export function getCurrentUser(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return res.json({ user: sanitizeUser(req.user) });
}

export function getUsers(req, res) {
  const users = store.getUsers().map(sanitizeUser);
  return res.json({ users });
}
