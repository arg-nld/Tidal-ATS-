import crypto from 'node:crypto';
import { store } from '../services/store.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService.js';
import { matchesExistingPassword, verifyPassword } from '../services/passwordService.js';
import { deleteResume } from '../services/storageService.js';
import { logger } from '../services/logger.js';

const EMAIL_VERIFICATION_TTL_MS = 15 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 5 * 60 * 1000;

function sanitizeUser(user) {
  if (!user) return null;
  const { password, passwordHash, emailVerificationToken, passwordResetToken, passwordResetCreatedAt, ...safe } = user;
  return safe;
}

export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = await store.getUserByEmailAndPassword(email, password);
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
  const token = await store.createSession(user.id, ttlMs);

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

  const normalizedFirst = String(firstName || '').trim().replace(/\s+/g, ' ').toUpperCase();
  const normalizedLast = String(lastName || '').trim().replace(/\s+/g, ' ').toUpperCase();
  const normalizedMiddle = String(middleInitial || '').trim().replace(/\.$/, '').slice(0, 1).toUpperCase();
  const normalizedSuffix = String(suffix || '').trim();
  const validSuffixes = new Set(['', 'Jr.', 'Sr.', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']);
  const derivedName = [
    normalizedFirst,
    normalizedMiddle ? `${normalizedMiddle}.` : '',
    normalizedLast,
    normalizedSuffix
  ].filter(Boolean).join(' ');

  const fullName = derivedName || String(name || '').trim();
  const validName = value => /^[\p{L}\p{M}]+(?:\s+[\p{L}\p{M}]+)*$/u.test(value);

  if (!validName(normalizedFirst) || !validName(normalizedLast)) {
    return res.status(400).json({ error: 'First and last names may contain letters and spaces only.' });
  }
  if (normalizedMiddle && !/^[\p{L}\p{M}]$/u.test(normalizedMiddle)) {
    return res.status(400).json({ error: 'Middle initial must be one letter only.' });
  }
  if (!validSuffixes.has(normalizedSuffix)) {
    return res.status(400).json({ error: 'Please select a valid suffix.' });
  }

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
  if (await store.getUserByEmail(normalizedEmail)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const emailVerificationToken = crypto.randomBytes(32).toString('hex');
  // Keep signups in a separate pending-registration store. No row is added to
  // the users table until the email verification link is successfully opened.
  const pendingRegistration = await store.createPendingRegistration({
    name: fullName,
    firstName: normalizedFirst || fullName.split(' ')[0],
    lastName: normalizedLast || fullName.split(' ').slice(-1)[0],
    middleInitial: normalizedMiddle,
    suffix: normalizedSuffix,
    email: normalizedEmail,
    password,
    role: requestedRole,
    emailVerificationToken,
    title: title || 'Candidate',
    company: company || undefined,
    phone: phone || undefined
  });

  try {
    await sendVerificationEmail({ user: pendingRegistration, token: emailVerificationToken });
  } catch (err) {
    console.error('[AuthController] Verification email failed:', err.message);
    await store.deletePendingRegistration(pendingRegistration.id);

    const providerMessage = String(err?.message || '');
    const resendTestingMode = providerMessage.toLowerCase().includes('only send testing emails to your own email address');
    return res.status(503).json({
      error: resendTestingMode
        ? "Resend is still in testing mode. With onboarding@resend.dev, verification emails can only be sent to the email address that owns your Resend account. To verify other users' emails, verify your sending domain in Resend and set EMAIL_FROM to an address on that domain."
        : 'The verification email could not be sent. Check EMAIL_PROVIDER, your Gmail App Password or Resend credentials, EMAIL_FROM, and APP_URL, then try again.'
    });
  }

  return res.status(201).json({
    verificationRequired: true,
    emailSent: true,
    message: `Verification email sent to ${normalizedEmail}. Check your inbox. The link expires in 15 minutes.`
  });
}

export async function verifyEmail(req, res) {
  const token = String(req.params.token || '').trim();
  if (!token) {
    return res.status(400).json({ error: 'This verification link is invalid or has already been used.' });
  }

  const pending = await store.getPendingRegistrationByToken(token);
  if (pending) {
    const createdAt = Number(pending.emailVerificationCreatedAt || pending.createdAt || 0);
    if (!createdAt || Date.now() - createdAt >= EMAIL_VERIFICATION_TTL_MS) {
      await store.deletePendingRegistration(pending.id);
      return res.status(400).json({ error: 'This verification link has expired. Verification links are valid for 15 minutes. Please register again.' });
    }

    const existingUser = await store.getUserByEmail(pending.email);
    if (existingUser) {
      await store.deletePendingRegistration(pending.id);
      if (existingUser.emailVerified !== false) {
        return res.json({ message: 'This email address is already verified. You can sign in.' });
      }
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in or use its verification email.' });
    }

    const profile = { ...pending };
    const pendingId = profile.id;
    const passwordHash = profile.passwordHash;
    delete profile.id;
    delete profile.createdAt;
    delete profile.emailVerificationToken;
    delete profile.emailVerificationCreatedAt;
    delete profile.passwordHash;
    const verifiedUser = await store.createUser({
      ...profile,
      passwordHash,
      emailVerified: true
    });
    await store.deletePendingRegistration(pendingId);

    return res.json({
      user: sanitizeUser(verifiedUser),
      message: 'Email verified successfully. Your account is now active. You can sign in.'
    });
  }

  // Continue to recognize unverified users created by older versions of the
  // app, while enforcing the new 15-minute expiry on their outstanding tokens.
  const users = await store.getUsers();
  const legacyUser = users.find(item => item.emailVerificationToken === token);
  if (!legacyUser) {
    return res.status(400).json({ error: 'This verification link is invalid or has already been used.' });
  }

  const createdAt = Number(legacyUser.emailVerificationCreatedAt || 0);
  if (!createdAt || Date.now() - createdAt >= EMAIL_VERIFICATION_TTL_MS) {
    await store.updateUser(legacyUser.id, {
      emailVerificationToken: null,
      emailVerificationCreatedAt: null
    });
    return res.status(400).json({ error: 'This verification link has expired. Verification links are valid for 15 minutes. Please request a new one.' });
  }

  const updated = await store.updateUser(legacyUser.id, {
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationCreatedAt: null
  });

  return res.json({
    user: sanitizeUser(updated || legacyUser),
    message: 'Email verified successfully. You can now sign in.'
  });
}

export async function requestPasswordReset(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email address is required.' });

  // Always return the same response to avoid revealing which emails have accounts.
  const user = await store.getUserByEmail(email);
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    await store.updateUser(user.id, {
      passwordResetToken: token,
      passwordResetCreatedAt: Date.now()
    });
    try {
      await sendPasswordResetEmail({ user, token });
    } catch (err) {
      console.error('[AuthController] Password reset email failed:', err.message);
      await store.updateUser(user.id, { passwordResetToken: null, passwordResetCreatedAt: null });
      return res.status(503).json({ error: 'The password reset email could not be sent. Check your email provider configuration.' });
    }
  }
  return res.json({ message: 'If an account exists for that email, a password reset link has been sent.' });
}

export async function resetPassword(req, res) {
  const token = String(req.body?.token || '').trim();
  const password = String(req.body?.password || '');
  if (!token || !password) return res.status(400).json({ error: 'Reset token and new password are required.' });
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
  }

  const user = (await store.getUsers()).find(item => item.passwordResetToken === token);
  if (!user) return res.status(400).json({ error: 'This password reset link is invalid or has already been used.' });
  const createdAt = Number(user.passwordResetCreatedAt || 0);
  if (!createdAt || Date.now() - createdAt >= PASSWORD_RESET_TTL_MS) {
    await store.updateUser(user.id, { passwordResetToken: null, passwordResetCreatedAt: null });
    return res.status(400).json({ error: 'This password reset link has expired. Please request another one.' });
  }

  // Require a genuinely new password. Enforce this on the server so callers
  // cannot bypass the rule by submitting directly to the API.
  const passwordHistory = Array.isArray(user.passwordHistory) ? user.passwordHistory.filter(Boolean) : [];
  const matchesPasswordHistory = passwordHistory.some(previousHash => verifyPassword(password, previousHash));
  if (matchesExistingPassword(password, user) || matchesPasswordHistory) {
    return res.status(400).json({ error: 'You cannot reuse any previous password. Choose a password you have never used on this account.' });
  }

  // Preserve every prior password hash, including the current one, so future resets
  // can reject reuse without storing plaintext passwords.
  const nextPasswordHistory = [...passwordHistory];
  if (user.passwordHash && !nextPasswordHistory.includes(user.passwordHash)) nextPasswordHistory.push(user.passwordHash);
  await store.updateUser(user.id, {
    password,
    passwordHistory: nextPasswordHistory,
    passwordResetToken: null,
    passwordResetCreatedAt: null
  });
  await store.deleteSessionsForUser?.(user.id);
  return res.json({ message: 'Password reset successfully. You can now sign in.' });
}

export async function logout(req, res) {
  if (req.authToken) await store.deleteSession(req.authToken);
  return res.json({ message: 'Signed out successfully.' });
}

export async function deleteCurrentAccount(req, res) {
  const password = String(req.body?.password || '');
  const confirmation = String(req.body?.confirmation || '');
  if (!password) {
    return res.status(400).json({ error: 'Enter your password to confirm account deletion.' });
  }
  if (password.length > 128) {
    return res.status(400).json({ error: 'The password is invalid. Please try again.' });
  }
  if (confirmation !== 'DELETE') {
    return res.status(400).json({ error: 'Type DELETE to confirm account deletion.' });
  }

  const user = await store.getUserById(req.user.id);
  if (!user || !matchesExistingPassword(password, user)) {
    return res.status(401).json({ error: 'Your password could not be verified. Your account has not been deleted.' });
  }

  // Avoid locking the organization out of its own ATS.
  if (user.role === 'hr') {
    const hrUsers = await store.getUsersByRole('hr');
    if (hrUsers.length <= 1) {
      return res.status(409).json({ error: 'This is the only HR account. Create another HR account before deleting it.' });
    }
  }

  const applications = user.role === 'applicant'
    ? await (store.getApplicationsForAccountDeletion
      ? store.getApplicationsForAccountDeletion(user.id, user.email)
      : store.getApplicationsByUserId(user.id))
    : [];
  const cleanupFailures = [];
  for (const application of applications) {
    if (!application.resumeFile) continue;
    try {
      await deleteResume(application.resumeFile);
    } catch (error) {
      cleanupFailures.push(application.id);
      logger.error('account.delete_resume_failed', {
        requestId: req.requestId,
        userId: user.id,
        applicationId: application.id,
        error
      });
    }
  }

  // Do not remove the account/database records until storage cleanup succeeds.
  // DeleteObject is safe to retry, so any partial cleanup can be completed by
  // submitting the same request again after the underlying storage issue clears.
  if (cleanupFailures.length) {
    return res.status(503).json({
      error: 'We could not remove all files linked to your account. Your account is still active; please try again later.',
      code: 'ACCOUNT_FILE_CLEANUP_FAILED'
    });
  }

  const result = await store.deleteAccount(user.id, user.email);
  if (!result?.deleted) return res.status(404).json({ error: 'This account could not be found.' });

  logger.info('account.deleted', {
    requestId: req.requestId,
    userId: user.id,
    role: user.role,
    deletedApplicationCount: applications.length,
    deletedResumeCount: applications.filter(application => !!application.resumeFile).length
  });
  return res.json({
    message: user.role === 'applicant'
      ? 'Your account, applications, and associated resume files have been deleted.'
      : 'Your HR account has been deleted. Shared jobs and candidate records were preserved.'
  });
}

export async function getCurrentUser(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  return res.json({ user: sanitizeUser(req.user) });
}
