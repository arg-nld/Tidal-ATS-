# Phase 2 Security / Reliability Changes

This build keeps the Phase 1 authentication design and hardens request handling, uploads, AI parsing, external links, and abuse protection.

## Rate limiting
- Added a broad API limit: 300 requests per 5 minutes per client IP.
- Login: 10 attempts per 15 minutes per client IP.
- Registration: 5 attempts per hour per client IP.
- Email verification: 10 attempts per 15 minutes per client IP.
- Resume parsing: 10 requests per 15 minutes per authenticated user.
- Candidate screening: 20 requests per 15 minutes per authenticated HR user.
- Resume application uploads: 10 per hour per authenticated applicant.
- Interview emails: 30 per hour per authenticated HR user.

The rate limiter is in-memory for this single-process build. A shared Redis-backed limiter is recommended before multi-instance production deployment.

## Input validation / mass-assignment protection
- Added length/type validation for authentication, registration, jobs, applications, notes, interviews, evaluations, and AI requests.
- Email addresses are normalized and validated.
- Meeting links are limited to `http://` or `https://`.
- Interview email subjects are single-line and length-limited.
- Job updates now use an explicit allow-list instead of accepting arbitrary request fields.
- Base64 AI inputs are size-checked and limited to supported MIME types.

## File upload security
- Resume uploads are held in memory until their contents are validated.
- PDF, DOCX, and TXT files are checked against their content signatures rather than trusting filename/extension alone.
- Resume filenames are sanitized and storage names are generated server-side with random UUIDs.
- Interview email attachments are restricted to PDF, DOCX, TXT, PNG, JPG/JPEG, and WEBP.
- Attachments are capped at 5 files and 20 MB combined.
- Resume path traversal is blocked when downloading/deleting stored files.

## XSS / unsafe output hardening
- API input control characters are removed where appropriate.
- Email HTML is generated only from HTML-escaped plain text.
- Meeting URLs cannot use `javascript:`, `data:`, `file:`, or other non-HTTP schemes.
- Resume download filenames are sanitized before being placed in response headers.

## AI hardening
- Resume/job content is explicitly treated as untrusted data in Gemini system instructions.
- AI resume responses are validated and normalized to the expected fields before being returned to the application.
- AI failures no longer expose provider/internal error details to the browser.
- Gemini calls have a 30-second timeout.

## HTTP hardening
- Disabled Express `X-Powered-By`.
- Added `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and `Cache-Control: no-store`.
- Added HSTS automatically when the backend is reached over HTTPS.
- Added Multer-specific 413/400 handling for upload errors.

## Manual production actions still required
- Rotate the Gemini API key from the original archive.
- Rotate the Resend API key from the original archive.
- Keep `.env` out of Git and deployment ZIPs.
- Set a production `CORS_ORIGINS`, `APP_URL`, and verified `EMAIL_FROM`.
- Use a shared rate-limit store (for example Redis) once multiple backend instances are deployed.
