import crypto from 'node:crypto';
import { store } from '../services/store.js';
import { sendVerificationEmail } from '../services/emailService.js';

function sanitizeUser(user) {
  if (!user) return null;
  const { password, passwordHash, emailVerificationToken, ...safe } = user;
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

  if (user.emailVerified === false) {
    return res.status(403).json({
      error: 'Please verify your email address before signing in.'
    });
  }

  const sessionHours = Number(process.env.SESSION_TTL_HOURS || 12);
  const ttlMs = (Number.isFinite(sessionHours) && sessionHours > 0 ? sessionHours : 12) * 60 * 60 * 1000;
  const token = store.createSession(user.id, ttlMs);

  return res.json({ user: sanitizeUser(user), token });
}

export async function register(req, res) {
  const {
    firstName,
    lastName,
    middleInitial,
    suffix,
    name,
    email,
    password,
    role,
    title,
    company,
    phone
  } = req.body;

  const normalizedFirst = String(firstName || '').trim();
  const normalizedLast = String(lastName || '').trim();
  const normalizedMiddle = String(middleInitial || '').trim().replace(/\.$/, '').slice(0, 1);
  const normalizedSuffix = String(suffix || '').trim();
  const derivedName = [
    normalizedFirst,
    normalizedMiddle ? `${normalizedMiddle}.` : '',
    normalizedLast,
    normalizedSuffix
  ].filter(Boolean).join(' ');

  const fullName = derivedName || String(name || '').trim();

  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'First name, last name, email, and password are required.' });
  }

  const requestedRole = String(role || 'applicant').trim().toLowerCase();
  if (requestedRole !== 'applicant') {
    return res.status(403).json({ error: 'HR accounts are invitation-only and cannot be created through public registration.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (password.length > 128) {
    return res.status(400).json({ error: 'Password must be 128 characters or fewer.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (store.getUserByEmail(normalizedEmail)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const emailVerificationToken = crypto.randomBytes(32).toString('hex');
  const newUser = store.createUser({
    name: fullName,
    firstName: normalizedFirst || fullName.split(' ')[0],
    lastName: normalizedLast || fullName.split(' ').slice(-1)[0],
    middleInitial: normalizedMiddle,
    suffix: normalizedSuffix,
    email: normalizedEmail,
    password,
    role: requestedRole,
    emailVerified: false,
    emailVerificationToken,
    emailVerificationCreatedAt: Date.now(),
    title: title || 'Candidate',
    company: company || undefined,
    phone: phone || undefined
  });

  try {
    await sendVerificationEmail({ user: newUser, token: emailVerificationToken });
  } catch (err) {
    console.error('[AuthController] Verification email failed:', err.message);
    store.deleteUser(newUser.id);

    const providerMessage = String(err?.message || '');
    const resendTestingMode = providerMessage.toLowerCase().includes('only send testing emails to your own email address');
    return res.status(503).json({
      error: resendTestingMode
        ? 'Resend is still in testing mode. With onboarding@resend.dev, verification emails can only be sent to the email address that owns your Resend account. To verify other users\' emails, verify your sending domain in Resend and set EMAIL_FROM to an address on that domain.'
        : 'The verification email could not be sent. Check RESEND_API_KEY, EMAIL_FROM, APP_URL, and your Resend sender/domain configuration, then try again.'
    });
  }

  return res.status(201).json({
    user: sanitizeUser(newUser),
    verificationRequired: true,
    emailSent: true,
    message: `Verification email sent to ${newUser.email}. Check your inbox before signing in.`
  });
}

export function verifyEmail(req, res) {
  const token = String(req.params.token || '').trim();
  const user = store.getUsers().find(u => u.emailVerificationToken === token);

  if (!user) {
    return res.status(400).json({ error: 'This verification link is invalid or has already been used.' });
  }

  const createdAt = Number(user.emailVerificationCreatedAt || 0);
  const maxAgeMs = 24 * 60 * 60 * 1000;
  if (createdAt && Date.now() - createdAt > maxAgeMs) {
    return res.status(400).json({ error: 'This verification link has expired. Please register again or request a new verification email.' });
  }

  const updated = store.updateUser?.(user.id, {
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationCreatedAt: null
  });

  return res.json({
    user: sanitizeUser(updated || user),
    message: 'Email verified successfully. You can now sign in.'
  });
}

export function logout(req, res) {
  if (req.authToken) store.deleteSession(req.authToken);
  return res.json({ message: 'Signed out successfully.' });
}

export function getCurrentUser(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  return res.json({ user: sanitizeUser(req.user) });
}
