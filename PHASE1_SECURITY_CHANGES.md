# Phase 1 Security Changes

This build hardens the ATS authentication and authorization layer without requiring an external authentication service.

## Authentication

- Replaced user-ID-as-token authentication with cryptographically random server-issued session tokens.
- Session tokens are stored server-side as SHA-256 hashes and expire after `SESSION_TTL_HOURS` (default: 12 hours).
- Added `POST /api/auth/logout` to invalidate the current session.
- Removed trust in `X-User-Id` and `X-User-Role` headers.
- Roles are taken only from the authenticated server-side user record.
- Cached browser user data is no longer trusted before `/api/auth/me` validates the session.

## Passwords

- Replaced plaintext passwords with Node.js built-in `scrypt` password hashes.
- Legacy `password` fields are automatically migrated to `passwordHash` when the server starts.
- Registration now requires passwords between 8 and 128 characters.

## Registration

- Public registration is applicant-only.
- HR/recruiter account creation through the public registration endpoint is blocked.
- HR accounts must be created by an administrator/invitation workflow in a future phase.

## Resource protection

- Resume parsing now requires authentication.
- Application submission now requires an authenticated applicant account.
- Application submission must use the signed-in applicant's email address.
- Notifications are matched by `recipientUserId` instead of email-only fallback.
- Removed the unused public `/api/auth/users` endpoint.

## API/configuration

- Removed `X-User-Id` and `X-User-Role` from CORS allowed headers.
- CORS is restricted to `CORS_ORIGINS` (default development origin: `http://localhost:5173`).
- Reduced normal JSON request limits from 30 MB to 1 MB.
- Production server errors no longer expose internal error messages for 500-level failures.
- Removed the unused Firebase configuration/dependency.
- Development scripts no longer fail just because `.env` is absent; `dotenv` loads it when present.

## Important manual actions

1. Rotate the Gemini API key that was included in the original project archive.
2. Rotate the Resend API key that was included in the original project archive.
3. Keep `.env` out of Git and project ZIPs. Use `.env.example` as the template.
4. For production, set `CORS_ORIGINS` to the actual frontend origin and configure `EMAIL_FROM` with a verified Resend domain.
