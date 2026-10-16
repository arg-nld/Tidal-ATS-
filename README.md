# TIDAL Solutions Talent ATS

> Before deploying, follow [`DEPLOYMENT_READINESS_AUDIT.md`](./DEPLOYMENT_READINESS_AUDIT.md). It contains production environment setup, security notes, release gates, and APIs/services to monitor.

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` and set your own credentials:

```env
GEMINI_API_KEY=your_google_ai_studio_api_key
GEMINI_MODEL=gemini-2.5-flash
PORT=5000
APP_URL=http://localhost:5173
COMPANY_NAME=TIDAL Solutions
EMAIL_PROVIDER=gmail
GMAIL_USER=your-address@gmail.com
GMAIL_APP_PASSWORD=your-16-character-google-app-password
EMAIL_FROM=TIDAL Solutions <your-address@gmail.com>
```

Gmail SMTP uses a Google **App Password**, not your normal Google account password. Enable 2-Step Verification on the Google account, create an App Password in your Google Account security settings, then set `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and `EMAIL_FROM`. Keep credentials only in `.env`; never commit them.

Run:

```bash
npm run dev
```

## TIDAL Solutions theme and branding

- The ATS now opens in **Clean Ocean Light** by default, with pale blue surfaces, aqua accents, and the supplied TIDAL Solutions logo.
- Use the moon/sun button in the top header or sign-in screen to switch to **Deep Ocean Dark**. Your choice is saved in the browser and applied across the HR and applicant portals.
- Logo assets and the matching favicon live in `public/tidal-logo.png`, `public/tidal-logo-dark.png`, and `public/tidal-icon.png`.

## Latest changes

- Account email verification and forgot-password/reset-password flows using configurable Gmail SMTP or Resend delivery.
- Notifications are now linked to the applicant account by `userId`, with email matching retained only for legacy records.
- Candidate notifications now appear for the correct signed-in candidate.
- Application submission uses the signed-in applicant account email even when the uploaded resume contains a different email address.
- The active portal synchronizes with sign-in/sign-out changes made in another browser tab to prevent stale roles and tokens from becoming mismatched.
- The HR recruiting calendar includes a month/year picker for direct navigation.
- Notification drawer opening is protected from accidental backdrop/event bubbling; clicking `View email` opens the message instead of closing the drawer.
- Notifications are server-scoped to the signed-in user; unread state, individual removal, and `Clear all` are persisted by the backend.
- Notification list scroll position is restored after opening/closing a notification.
- Public registration is applicant-only. HR accounts are created locally by an administrator with `npm run create:hr`.
- Original resumes load automatically when the HR opens the Original Resume tab; local storage reads support legacy resume path formats.
- Interview time picker uses three vertical up/down controls for hour, minute, and AM/PM.
- Existing booked interview slots remain disabled and are checked by the server.
- Department filter/dropdown removed from the candidate job board.
- Department is not part of the new job publishing form.
- New jobs leave salary range and experience level blank.
- Candidate-facing Gemini/AI parsing language was removed from the applicant UI.
- Deterministic job scoring remains configurable and must total 100%.
- Password resets reject reuse of the current password, and the reset-link request button shows a loading state while sending.
- Applicant first and last names are normalized to uppercase and restricted to letters and spaces.
- Analytics exclude merged duplicate applications and do not invent time-to-hire, time-to-fill, or stage-duration values when recorded timestamps are missing. Source-level cost per hire remains unavailable until source-level spend is tracked.


## Email verification, Gmail SMTP, and password reset

New applicant registrations send an email verification link. Accounts cannot sign in until verified. Verification links expire after 15 minutes.

Forgot-password flow:
- The sign-in page has a **Forgot password?** link.
- A reset email is sent when an account matches the supplied address. The API response avoids disclosing whether an account exists.
- Reset links expire after 5 minutes and can only be used once.
- Successful password resets invalidate existing sessions.

### Gmail SMTP configuration

Set the following in `.env`:

```env
EMAIL_PROVIDER=gmail
GMAIL_USER=your-address@gmail.com
GMAIL_APP_PASSWORD=your-16-character-google-app-password
EMAIL_FROM=TIDAL Solutions <your-address@gmail.com>
APP_URL=http://localhost:5173
```

For Gmail, enable 2-Step Verification and create an App Password from your Google Account security settings. Use the generated App Password, not your normal Gmail password. If you prefer Resend, set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and a valid `EMAIL_FROM` sender instead.

## Phase 2 security hardening

This version includes the Phase 2 request, upload, AI, rate-limiting, and input-validation hardening. See `PHASE2_SECURITY_CHANGES.md` for details.

Run the security regression tests with:

```bash
npm run test:security
```

The distributed project intentionally does not include a real `.env` file. Copy `.env.example` to `.env` and add your rotated credentials locally.

## Phase 3 reliability commands

```bash
npm run test:all
npm run test:reliability
npm run backup:data
```

The server automatically maintains rolling JSON database backups in `server/data/backups/` and attempts recovery if `server/data/db.json` is corrupted.



### Resume files missing from an existing profile

Resume metadata is stored with each application, while the actual uploaded file is stored separately under `server/data/uploads/` (or in the configured S3 bucket). The project ZIP intentionally does not bundle uploaded resumes or your local database. The storage reader now checks the current local upload root and common legacy local paths to support older records.

If a resume still returns **“Resume file no longer exists in storage”**, the file itself is absent from every configured/legacy path or from the configured S3 bucket. Restore the original file from your previous project folder or backup, or correct `LOCAL_UPLOAD_ROOT` / S3 settings. The code cannot recreate the original PDF/DOCX from application metadata alone. For production, use persistent storage or S3 and back up both the database and uploaded files.

## Administrator HR accounts

Public registration does not allow HR accounts. A trusted server administrator can create an HR account from the project directory:

```bash
npm run create:hr
```

The command prompts for the HR user's name, email, and password. The password is hidden while entered and is hashed by the existing server-side password service before storage. Administrator-created HR accounts are marked as email-verified.

Do not expose or add a public HR registration form.

## Phase 4 scalability roadmap

The full Phase 4 scope now includes the following production scalability work:

```text
29. Replace db.json
30. Move to PostgreSQL
31. Move resume files to object storage
32. Separate application-related entities
33. Add email queue/worker
34. Add pagination
35. Add database indexes
36. Add structured logging
```

These are architecture/production upgrades and are not represented as completed merely by this Phase 4 package. See `PHASE4_CHANGES.md` for the implementation requirements and recommended order.


## Phase 4 — Scalability

The project now includes the production scalability foundation:

- PostgreSQL adapter with relational tables, foreign keys, connection pooling, and indexes.
- `npm run migrate:postgres` to migrate the existing `server/data/db.json`.
- S3-compatible object storage adapter for resumes via `OBJECT_STORAGE_PROVIDER=s3`.
- Database-backed email queue and separate worker: `npm run worker:email`.
- Optional API pagination for jobs, applications, and notifications using `page` and `limit`.
- Structured JSON request/server/error/worker logs with request IDs.
- Existing JSON storage remains available when `DATABASE_URL` is not configured so the Phase 1–3 regression suite continues to work.

See `PHASE4_SCALABILITY.md` and `.env.example` for configuration and rollout steps.

### PostgreSQL rollout

```bash
npm install
npm run migrate:postgres
npm run dev
```

For asynchronous email delivery, run the worker separately:

```bash
npm run worker:email
```

Do not commit `.env`, PostgreSQL credentials, S3 credentials, Resend keys, session tokens, or other secrets.

## Local development API connection

The React app uses the relative `/api` path. Vite proxies API requests to the local
Express backend during development, so the browser does not hard-code a backend
host or port. The development launcher runs this project's backend on port `5001` by default
so an older Node process on port `5000` cannot capture its requests. Vite proxies
`/api` to that backend; set `BACKEND_PORT` (or `VITE_DEV_API_PROXY_TARGET`) if you
need a different local port. This proxy is development-only and is not part of the
production build.

Start both services from the project root with:

```bash
npm install
npm run dev
```

Keep your actual `.env` file local and never include it in shared ZIP files. Copy
`.env.example` to `.env` and enter your own local credentials there.

## Deployment: no localhost API URL

`localhost` is only a development-machine address. Production API calls must point
to the deployed backend, not to your computer. Choose one of these setups:

**Option A — deploy the frontend and Express backend as one Node service (simplest).**
Build the React app and start Express from the project root:

```bash
npm ci
npm run build
npm run server
```

When `dist/index.html` exists, Express serves the built frontend and its client-side
routes as well as `/api`. Leave `VITE_API_BASE_URL` unset so the frontend calls the
same-origin `/api` endpoint. Set the host's production environment variables such as
`DATABASE_URL`, `APP_URL`, `CORS_ORIGINS`, and email/storage credentials in the host's
settings; do not upload your local `.env`.

**Option B — host the frontend and backend separately.** Set `VITE_API_BASE_URL`
in the frontend host's build environment to the public backend URL **including `/api`**,
for example `https://your-backend.example.com/api`, then rebuild/redeploy the frontend.
On the backend, set `APP_URL` to the public frontend URL and `CORS_ORIGINS` to that
exact origin. Do not set `VITE_API_BASE_URL` to `localhost` for a public deployment.

After deployment, test `https://your-backend.example.com/api/health` (use your real
backend domain). A healthy response should be JSON with `status: "ok"` and
`service: "Tidal ATS Backend API"`.

## API diagnostics and designated error codes

API errors now return JSON with `error`, `code`, and `requestId`. The browser's
error message includes the code and request ID; backend logs emit the same request
ID so a failing request can be found quickly.

Common codes:
- `API_CONNECTION_FAILED`: the browser could not connect to the configured API host.
- `API_ROUTE_NOT_FOUND`: the backend was reached, but no mounted API route matched the HTTP method/path.
- `APPLICATION_NOT_FOUND`: the requested application ID does not exist.
- `RESUME_NOT_ATTACHED`: the application exists but has no original resume metadata.
- `RESUME_STORAGE_OBJECT_MISSING`: resume metadata exists but the underlying file is missing from storage.
- `CORS_ORIGIN_REJECTED`: the backend rejected the frontend origin.
- `AUTHENTICATION_REQUIRED` / `REQUEST_FORBIDDEN`: authentication or authorization failed.
- `INTERNAL_SERVER_ERROR`: an unexpected server-side error occurred.

For a reproducible failure, copy the `code` and `requestId` from the browser message
and search the backend terminal output for that request ID. Never paste API keys,
passwords, access tokens, or reset tokens into bug reports.



## Troubleshooting: `Cannot POST /api/auth/forgot-password`

The HTML response `Cannot POST /api/auth/forgot-password` is Express's default
404 page. The current source registers this route in `server/routes/authRoutes.js`
and mounts it at `/api/auth` in `server/server.js`, so this response means the
configured API target is reaching a server that does not have this route. The
updated development launcher targets port 5001 by default to avoid a stale service
on port 5000.

1. Stop every terminal running this project (`Ctrl+C`).
2. The development launcher now uses port 5001 by default. If that port is also
   occupied, run `netstat -ano | findstr :5001` and identify the PID; stop the
   process only if you confirm it is stale.
3. From this extracted project's root, run `npm run dev`.
4. Open `http://localhost:5001/api/health`. It should return JSON with
   `service: "Tidal ATS Backend API"` and `version: "3.0.0"`.
5. Retry forgot-password. A structured JSON error such as `API_ROUTE_NOT_FOUND`
   or an email-provider error is expected if the request reaches the updated backend.

The frontend labels the default HTML Express 404 as
`WRONG_OR_OLD_BACKEND_INSTANCE` and points to the health URL derived from the
configured API base. In production, that URL should use the deployed backend host
(or the same origin if Express serves the frontend), never your personal localhost.


### Email action links (verification and password reset)

Set `FRONTEND_URL` to the exact public origin where the React app is hosted (for example, `https://your-frontend.example.com`) in production. The email links are built from `FRONTEND_URL`, then `APP_URL`, then the local-development fallback `http://localhost:5173`. Do not leave the production value pointing at localhost.

## Production setup

See `PRODUCTION_SETUP_GUIDE.md` for step-by-step instructions to configure managed PostgreSQL for a fresh database, production HTTPS/CORS/email URLs, backups and restore tests, resume-retention policy, session-cookie hardening, CSP, distributed rate limiting, and the release checklist. See `DEPLOYMENT_READINESS_AUDIT.md` for the source-code audit and APIs/services to monitor.

## Analyst-ready recruitment analytics export

The HR **Recruitment Analytics & Reports** page has an **Export Analyst Pack** action. It exports the same active dashboard filters as a ZIP archive of separate CSV datasets, instead of a single file containing only summary totals. The export is available through the authenticated HR-only endpoint `GET /api/analytics/analyst-pack`.

The archive contains:

- `executive_summary.csv` — KPI values, units, numerator/denominator where applicable, calculation rule, source tables, and caveats.
- `application_detail.csv` — one row per filtered, non-merged application, including stage reached flags, source, current stage, screening score, scorecard summary, offer facts, dates, and calculated time-to-hire where valid.
- `time_to_hire_observations.csv` — exact per-application observations contributing to the average and median time-to-hire.
- `funnel.csv`, `funnel_membership.csv`, and `source_effectiveness.csv` — funnel denominators, conversions, drop-offs, normalized stage membership, source counts, and outcomes.
- `timeline_events.csv` and `stage_duration_observations.csv` — recorded event evidence and per-application stage duration calculations.
- `stage_duration_summary.csv`, `job_fill_analysis.csv`, `rejection_reasons.csv`, `stalled_applications.csv`, and `overdue_evaluations.csv` — operational analysis tables.
- `offer_history.csv` and `scorecards.csv` — offer lifecycle and evaluation observations.
- `data_dictionary.csv`, `filter_context.csv`, and `README.txt` — field definitions, dataset grain, effective filters, formula descriptions, and limitations.

Use `application_id` to join application-level data to events, stage observations, offers, and scorecards. All timestamps are exported as ISO-8601 UTC values. Candidate names, email addresses, phone numbers, and resume text are intentionally omitted; the `candidate_user_id` may be blank for guest/legacy applications.

Important interpretation rules:

- Merged duplicate applications are excluded from active metrics.
- Funnel counts represent applications that reached a stage, so they are cumulative and not mutually exclusive current-stage counts.
- A candidate is treated as qualified when the recorded resume match score is at least 70 or the application reached Shortlisted, Interview Scheduled, Job Offer, or Hired.
- Time-to-hire is application creation to a recorded acceptance/hire timestamp. Missing timestamps are blank, not silently replaced by an update date.
- Time-to-fill is measured at job level and intentionally follows the selected job filter, not source/status/date/recruiter filters.
- Source-level cost-per-hire stays unavailable until channel-level recruiting spend is recorded; job-level spend is not incorrectly assigned to individual sources.

The legacy `GET /api/analytics/csv` route remains available for the compact CSV report. The dashboard button uses the analyst pack route.
