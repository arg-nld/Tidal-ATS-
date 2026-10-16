# TIDAL ATS — Deployment Readiness Audit

Audit date: 2026-10-16  
Scope: source code contained in the project ZIP provided for this task. This is not a penetration test and cannot certify the deployed Cloudflare account, database, DNS, email sender, or hosting environment.

## Status

**Not yet cleared for production.** The code changes below are applied, but live integrations and production configuration still require verification. The account-deletion and existing scoring/store reliability test suites passed (41 tests total), and the server-side JavaScript syntax checks passed. The frontend build, ESLint, and dependency-audit commands still need to be run in the delivery environment before release; they are not treated as passed by this audit.

## Code changes made

- User-facing API errors now use normal, readable messages. Status codes, internal error codes, request IDs, database messages, and provider details are not concatenated into error text shown in the app.
- The backend logs detailed errors and stacks for maintainers. The frontend does not receive stack traces. Email-verification tokens are redacted from request paths in server logs.
- API and non-API 404 responses are generic rather than echoing the requested URL and backend routing details.
- The public `/api/health` response no longer exposes database names, local storage paths, or backup-directory information.
- Production CORS ignores localhost entries even if they were accidentally left in `CORS_ORIGINS`; localhost origins are automatically permitted only in development.
- Production startup refuses to fall back to the local JSON store. `DATABASE_URL` is required when `NODE_ENV=production`.
- Production startup requires R2 to be selected and the bucket, endpoint, and S3 credentials to be present.
- A signed-in user can delete their account after re-entering their password and typing `DELETE`. Deletion attempts are rate-limited.
- Deleting an applicant removes that account's applications, associated database records, sessions, notifications, and linked original resume objects. It also handles legacy application records with no user ID when the email matches the account.
- Deleting an HR account removes that login and its sessions/notifications but preserves shared jobs, candidate records, and candidate resume files. The last HR account cannot be deleted.
- HR application deletion now preserves the application record if the corresponding resume object cannot be deleted, so HR can retry instead of silently leaving an orphaned object.
- Candidate offer responses now require the applicant to own the application; an authenticated user cannot respond to another candidate's offer by changing an application ID.
- Removed an unused Firebase configuration file with a hard-coded project identifier/API key. No code imported the file and Firebase was not a declared dependency.
- Added `npm run start` for a production Node/Express process.

## Personal actions required before production

### 1. Rotate credentials from the uploaded ZIP

The ZIP included a real `.env` file. Treat all credentials from that file as exposed and rotate them before production. This includes any R2 Access Key/Secret, R2 token, Gemini API key, Resend API key, Gmail App Password, and database credentials present in that file. Do not reuse the previously shared R2 secret. Do not include `.env` in future ZIPs or source-control commits.

### 2. Create the production environment variables

Set these in your hosting provider's **secret/environment settings**, not in frontend source code:

- `NODE_ENV=production`
- `DATABASE_URL` — hosted PostgreSQL connection string. URL-encode special characters in passwords.
- `PG_SSL=true` for a database provider that supports/requires TLS; keep `PG_SSL_REJECT_UNAUTHORIZED=true` unless the database host's documented certificate setup requires another secure configuration.
- `OBJECT_STORAGE_PROVIDER=s3`
- `S3_BUCKET=tidal-ats-resumes` (or your actual private bucket name)
- `S3_REGION=auto`
- `S3_ENDPOINT=https://<your-account-id>.r2.cloudflarestorage.com` — do not append the bucket name to this endpoint.
- `S3_FORCE_PATH_STYLE=false`
- `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` — newly generated R2 credentials, scoped only to the resume bucket with Object Read & Write permission.
- `APP_URL` and `FRONTEND_URL` — your real public HTTPS origin. These are used by email verification and password-reset links; localhost values must not be used in production.
- `CORS_ORIGINS` — comma-separated exact public frontend origins. Do not include localhost in production.
- Email configuration described below.
- `GEMINI_API_KEY` if you intend to offer AI resume parsing in production. Keep it server-side only.
- `TRUST_PROXY=true` only if your host places one trusted reverse proxy in front of Express. Match this to the actual hosting topology rather than enabling it blindly.

Keep `.env.example` as a template. For local development, copy it to `.env`; never copy production secrets into a file served by Vite or included in a client build.

### 3. Choose and validate email delivery

The code supports **Resend** or **Gmail SMTP**:

- Resend: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and a verified sender in `EMAIL_FROM`.
- Gmail SMTP: `EMAIL_PROVIDER=gmail`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and `EMAIL_FROM`. Use an App Password, not your normal account password.

Set `FRONTEND_URL` so email action links lead to the deployed app. Verify domain DNS/authentication records with your email provider. Test registration verification, forgot password, password reset, interview emails, and status-change emails using a non-production test account.

If `EMAIL_DELIVERY_MODE=queue`, run `npm run worker:email` as a separate long-running process and confirm worker restarts/monitoring. Queue mode requires PostgreSQL. `direct` mode does not require the worker.

### 4. Database and data migration

- Use a managed/persistent PostgreSQL service for production; do not use `server/data/db.json` as production storage.
- Decide whether to migrate your current records. Back up the source database and resumes before migrating.
- The local JSON store contains demo seed records for development. Do **not** migrate sample/demo users, candidates, jobs, or notifications into production. Review `server/scripts/migrateToPostgres.js` input and resulting database before enabling public traffic.
- Create at least two administrator-managed HR accounts before launch. The last HR account is protected from self-deletion, but that does not replace a documented administrator recovery process.
- Configure automated PostgreSQL backups and test restoration. Cloud object storage and relational database backups are separate responsibilities.

### 5. R2 privacy and file lifecycle

- Keep the bucket private. Do not enable the Public Development URL just to make resume previews work.
- Use an account token scoped to the ATS resume bucket only.
- Test upload, HR preview, applicant-owned preview, rejected cross-account access, deletion of an individual application, and applicant account deletion.
- Define a retention policy for resumes, backups, email logs, and deleted-user data. Object deletion is not a backup strategy; decide how accidental deletions will be recovered.
- Confirm that no resume is available anonymously and no signed credentials appear in browser network requests.

### 6. Browser/session security to decide before public launch

- The current frontend stores the bearer session token in `localStorage`. This works with the current API, but an XSS vulnerability could expose the token. For a public production ATS handling resumes and personal data, plan a move to `HttpOnly`, `Secure`, `SameSite` session cookies (with CSRF protection) before treating this as high-assurance production authentication.
- The server sets basic security headers, but a Content Security Policy (CSP) is not yet configured. Add and test a CSP against the actual built app and any external resources before enforcing it.
- Rate limiters are in-process memory maps. They reset on restart and are not shared across multiple backend instances. For horizontal scaling, use a shared store (such as Redis) and/or host-level rate limiting/WAF controls.
- Check the hosting platform's proxy configuration and set `TRUST_PROXY` appropriately so client IP rate limiting and HTTPS detection behave correctly.
- Restrict access to backend logs. Error stacks and provider details are logged server-side by design and must not be exposed through a public log viewer.

### 7. Build and release gate

From the project root, run these commands after installing dependencies in your own environment:

```bash
npm ci
npm run lint
npm run test:all
npm run build
npm audit
```

Review and resolve high/critical production dependency findings before release. Run the build on the same Node major/minor line used by your hosting platform. Deploy with `npm run start` (or `node server/server.js`), not `npm run dev`. Do not deploy Vite's development server.

Then test these manually on the staging deployment:

1. `/api/health` returns only basic service status.
2. Applicant registration + verification, login, logout, forgot password, and password reset work.
3. Applicants cannot read other candidates' applications, timelines, resumes, or respond to another candidate's offer.
4. HR routes are inaccessible to applicants.
5. Resume upload, parsing, HR preview, application deletion, and account deletion work with a private R2 bucket.
6. All emails use the production frontend URL and verified sender.
7. Reloads/direct links work for every frontend route, and the browser console shows no failed API requests.
8. Backups can actually be restored.

## Services/APIs to monitor

| Service/API | What it powers | Credentials/config to track | What to watch |
|---|---|---|---|
| **Cloudflare R2 S3 API** — `https://<account-id>.r2.cloudflarestorage.com` | Original resume uploads, previews, and deletion | `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` | AccessDenied/403, upload/delete failures, object counts, storage/operation usage, bucket privacy, credential rotation |
| **Google Gemini API** — `https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent` | AI resume parsing | `GEMINI_API_KEY`, `GEMINI_MODEL` | Quota/rate limits, model availability, invalid-key errors, latency, spend/usage limits |
| **Resend API** — `https://api.resend.com/emails` **or Gmail SMTP** | Verification, reset, interview, offer, and status-change email | Resend: `RESEND_API_KEY`, `EMAIL_FROM`; Gmail: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_FROM` | Delivery/rejection/bounce status, sender-domain verification, quota, provider outages, reset/verification email success |
| **PostgreSQL service** | User accounts, sessions, jobs, applications, notifications, screening data, and email queue | `DATABASE_URL`, `PG_SSL`, `PG_SSL_REJECT_UNAUTHORIZED`, `PG_POOL_MAX` | Availability, connection pool saturation, query latency, disk/storage, backups, restore tests, slow queries |
| **Hosting/runtime** | Express API and built React app | `NODE_ENV`, host `PORT`, `APP_URL`, `FRONTEND_URL`, `CORS_ORIGINS`, `TRUST_PROXY` | Process restarts, memory/CPU, `/api/health`, failed requests, logs, TLS/HTTPS, expired certificates |
| **Domain/DNS** | Public application URL and email links | Your domain DNS and HTTPS certificate; email DNS records | DNS resolution, TLS expiry, redirect loops, incorrect email links, sender authentication |

### Internal ATS endpoint groups

The external services above are the keys/providers that need account-level monitoring. These are the app's own backend routes (not third-party API subscriptions). Protect them with uptime/error-rate monitoring and alert on unexpected 4xx/5xx spikes:

- `GET /api/health`
- Auth: `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/verify-email/:token`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET /api/auth/me`, `POST /api/auth/logout`, `DELETE /api/auth/me`.
- Jobs: `GET /api/jobs`, `GET /api/jobs/:id`, `POST /api/jobs`, `PUT /api/jobs/:id`, `DELETE /api/jobs/:id`.
- Applications: `GET|POST /api/applications`, `GET /api/applications/availability`, `GET /api/applications/duplicates/all`, `POST /api/applications/merge`, `GET /api/applications/:id`, `GET /api/applications/:id/resume`, `PATCH /api/applications/:id/stage`, `PATCH /api/applications/:id/notes`, `POST /api/applications/:id/interview`, `POST /api/applications/:id/evaluation`, `GET|POST /api/applications/:id/scorecards`, `GET /api/applications/:id/timeline`, `GET /api/applications/:id/duplicates`, `POST /api/applications/:id/offer`, `POST /api/applications/:id/offer/approve`, `POST /api/applications/:id/offer/send`, `POST /api/applications/:id/offer/respond`, `POST /api/applications/:id/offer/withdraw`, `DELETE /api/applications/:id`.
- AI: `POST /api/ai/screen/:id`, `POST /api/ai/parse-resume`.
- Notifications: `GET|DELETE /api/notifications`, `PATCH /api/notifications/:id/read`, `DELETE /api/notifications/:id`, `POST /api/notifications/:id/retry-email`.
- Analytics: `GET /api/analytics`, `GET /api/analytics/csv`.

Endpoint access is role-protected in the route/controller layer; still run the staging authorization tests in this audit after deploying, especially for application ID ownership and original resume retrieval.

## Verification completed for this code revision

- `node --check` passed for the modified server/controller/store/API JavaScript files checked during the change.
- `node --test server/tests/accountDeletion.test.js server/tests/scoring.test.js server/tests/storeReliability.test.js`: 41 tests passed, including applicant/HR account deletion, scoring, and local-store reliability.
- The test suites and syntax checks listed above passed. The Vite build, ESLint, `npm audit`, and live R2/PostgreSQL/email integration tests were not verified in this audit run. Run the release-gate commands above before deploying.
