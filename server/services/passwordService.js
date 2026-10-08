import crypto from 'node:crypto';

const KEY_LENGTH = 64;
const DEFAULT_N = 16384;
const DEFAULT_R = 8;
const DEFAULT_P = 1;
const MAXMEM = 32 * 1024 * 1024;

/**
 * Password hashing uses Node's built-in scrypt so the ATS does not need an
 * additional native dependency just for authentication.
 */
export function hashPassword(password) {
  const value = String(password ?? '');
  if (!value) throw new Error('Password cannot be empty.');

  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(
    value,
    salt,
    KEY_LENGTH,
    { N: DEFAULT_N, r: DEFAULT_R, p: DEFAULT_P, maxmem: MAXMEM }
  ).toString('hex');

  return `scrypt$${DEFAULT_N}$${DEFAULT_R}$${DEFAULT_P}$${salt}$${derivedKey}`;
}

export function isPasswordHash(value) {
  return typeof value === 'string' && value.startsWith('scrypt$');
}

export function verifyPassword(password, storedHash) {
  if (!password || !isPasswordHash(storedHash)) return false;

  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, n, r, p, salt, expectedHex] = parts;
  const N = Number(n);
  const R = Number(r);
  const P = Number(p);

  if (!Number.isInteger(N) || !Number.isInteger(R) || !Number.isInteger(P)) return false;
  if (!salt || !expectedHex || expectedHex.length % 2 !== 0) return false;

  try {
    const expected = Buffer.from(expectedHex, 'hex');
    const derived = crypto.scryptSync(
      String(password),
      salt,
      expected.length,
      { N, r: R, p: P, maxmem: MAXMEM }
    );

    return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}
