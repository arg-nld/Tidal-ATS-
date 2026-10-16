# TIDAL ATS — Technical Documentation

This document explains the configuration variables, application architecture, key workflows, integrations, and operational behavior of the TIDAL ATS codebase. It intentionally describes **variable names and purposes, not secret values**. Never paste actual credentials into documentation, tickets, source control, or frontend code.

## 1. System overview

TIDAL ATS has two user-facing portals:

- **Applicant portal:** account creation and email verification, sign-in, job browsing, application submission, resume upload, application status, notifications, and offer response.
- **HR portal:** job management, application review, candidate pipeline, notes, resume viewing, AI screening/parsing, interview scheduling/evaluation, scorecards, offers, candidate timeline/duplicate management, notifications, and analytics.

The React frontend calls the Express API under `/api`. In a same-origin production deployment, Express serves the compiled Vite frontend from `dist/` and handles API routes. During local development, Vite serves the frontend and proxies API requests to Express.

## 2. Environment configuration

Create a local `.env` by copying `.env.example`. Keep the real `.env` outside Git and share only a redacted list of variable names when troubleshooting. The application loads environment variables from the project root.

### Runtime and networking

| Variable | Purpose / guidance |
|---|---|
| `NODE_ENV` | Set to `production` on the live service. Production startup requires PostgreSQL and R2; do not omit this in production. |
| `PORT` | Port supplied by a hosting platform. The server prefers `BACKEND_PORT`, then `PORT`, then its default. Let the host assign this when required. |
| `BACKEND_PORT` | Optional local backend port override. Avoid hardcoding this on hosts that supply `PORT`. |
| `APP_URL` | Canonical public application origin used for links and allowed-origin defaults. Production must use the real HTTPS URL. |
| `FRONTEND_URL` | Frontend origin used when generating verification, reset, and other frontend-facing links. Must match the deployed site. |
| `CORS_ORIGINS` | Comma-separated list of allowed browser origins. Use exact production HTTPS origins, no trailing path, and no wildcard for credentialed requests. Localhost is development-only. |
| `TRUST_PROXY` | Optional proxy trust setting used for client-IP-aware behavior. Enable only when the deployment topology and trusted proxy count are known; incorrect settings can weaken IP-based limits. |
| `VITE_API_BASE_URL` | Optional frontend build-time API base URL, including `/api`, only when frontend and backend are separately hosted. For same-origin hosting, leave unset. This is public configuration, never a place for secrets. |
| `VITE_DEV_API_PROXY_TARGET` | Optional Vite development proxy target. Usually unnecessary unless using a non-default backend port. |

### PostgreSQL

| Variable | Purpose / guidance |
|---|---|
| `DATABASE_URL` | Full PostgreSQL connection URI. Treat it as a password. Production requires it and selects the PostgreSQL store when present. Encode special characters in credentials as required by the provider. |
| `PG_POOL_MAX` | Maximum PostgreSQL connection pool size; example template value is `10`. Tune to host/database connection limits. |
| `PG_SSL` | Enables TLS for PostgreSQL when set to `true`; use the setting required by the managed database provider. |
| `PG_SSL_REJECT_UNAUTHORIZED` | Certificate validation setting. Keep `true` unless the provider's documented certificate arrangement requires a different approach; do not disable verification merely to bypass TLS errors. |

The PostgreSQL store initializes/ensures its schema when the server starts. A fresh production database should be initialized by the app and then receive its first HR account via the documented HR creation process. Do **not** run `npm run migrate:postgres` when the intention is to start with an empty database; that command is for importing existing local JSON data.

### Resume/object storage — Cloudflare R2

| Variable | Purpose / guidance |
|---|---|
| `OBJECT_STORAGE_PROVIDER` | `local` for local development; `s3` for Cloudflare R2/S3-compatible object storage. Production startup requires `s3`. |
| `LOCAL_UPLOAD_ROOT` | Local development upload directory, normally `server/data/uploads`. Not the production storage target. |
| `S3_BUCKET` | Private R2 bucket name. |
| `S3_REGION` | S3-compatible region setting; R2 commonly uses `auto`. |
| `S3_ENDPOINT` | R2 S3 endpoint, typically `https://<Cloudflare-account-id>.r2.cloudflarestorage.com`. |
| `S3_FORCE_PATH_STYLE` | S3 SDK path-style option. Keep consistent with the R2 setup; template defaults to `false`. |
| `S3_ACCESS_KEY_ID` | R2 access key ID. Use a dedicated token scoped to the required bucket permissions. |
| `S3_SECRET_ACCESS_KEY` | R2 secret access key. Store as a backend secret and rotate if exposed. |

Resume objects are stored under a `resumes/` prefix with generated identifiers. The bucket should remain private; the backend mediates authenticated access. Do not publish resumes through public bucket URLs.

### Email delivery

| Variable | Purpose / guidance |
|---|---|
| `EMAIL_PROVIDER` | `resend` for Resend API or `gmail` for Gmail SMTP. The service also accepts `smtp` as the Gmail SMTP path. |
| `EMAIL_FROM` | Sender address/display name. The address/domain must be authorized by the chosen provider. |
| `RESEND_API_KEY` | Server-only API key when using Resend. |
| `GMAIL_USER` | Gmail account used for SMTP. |
| `GMAIL_APP_PASSWORD` | Google App Password for SMTP; do not use the normal account password. |
| `EMAIL_DELIVERY_MODE` | `direct` sends during the request workflow; `queue` uses the PostgreSQL-backed queue/worker and requires PostgreSQL. |
| `EMAIL_WORKER_INTERVAL_MS` | Delay between email-worker polling cycles. |
| `EMAIL_WORKER_LEASE_MS` | Lease/claim duration for queued work, used to avoid multiple workers processing the same item simultaneously. |
| `EMAIL_WORKER_BATCH_SIZE` | Maximum queue batch size processed per worker cycle. |
| `EMAIL_MAX_RETRIES` | Retry cap for retryable email failures. |
| `EMAIL_RETRY_BASE_MS` | Base delay for retry behavior. |
| `COMPANY_NAME` | Brand/company name used in generated email copy. |

The email service supports verification, password reset, application-stage messages, interview communications, offers, and related transactional notices. Production verification must confirm sender-domain authentication, correct public URLs in messages, deliverability, bounce/rejection handling, and queue behavior if queue mode is enabled. Run `npm run worker:email` as a separately managed worker only when queue mode is configured.

### Gemini AI

| Variable | Purpose / guidance |
|---|---|
| `GEMINI_API_KEY` | Server-only Google Gemini API key. Never expose it to React or a `VITE_*` variable. |
| `GEMINI_MODEL` | Preferred Gemini model name. The service attempts configured model first and includes fallback models in its implementation. Check current model availability, quotas, and pricing before production use. |

The backend uses Gemini for resume parsing and candidate screening. Responses are validated before being used. API quota/model errors can still occur; monitor provider errors and ensure HR can review the source resume and score rationale.

### Local JSON-store backup settings

| Variable | Purpose / guidance |
|---|---|
| `DB_MAX_BACKUPS` | Maximum number of local JSON-store backups to retain. |
| `DB_BACKUP_INTERVAL_MS` | Interval for periodic local-store backup behavior; bounded by the code to a minimum interval. |

These variables relate to the local JSON store, not a substitute for managed PostgreSQL backups. Configure provider-level database backups and test restoration in production.

## 3. Startup modes and commands

```bash
npm ci
npm run dev
```

- `npm run dev`: starts `server/devServer.js` and Vite concurrently for development.
- `npm run start`: starts `server/server.js`; use this or the host's equivalent for production.
- `npm run build`: compiles the frontend into `dist/`.
- `npm run lint`: runs ESLint.
- `npm run test:all`: executes all `server/tests/*.test.js` suites.
- `npm run backup:data`: creates a local JSON-store backup.
- `npm run create:hr`: runs the HR account creation utility.
- `npm run worker:email`: runs the queued email worker.
- `npm run migrate:postgres`: imports existing local JSON data into PostgreSQL; not for a fresh empty production database.

Health endpoint: `GET /api/health`. It is intended to return basic service health without exposing internal database names or storage paths.

## 4. Code layout and request flow

### Frontend

`src/App.jsx` is the main application shell. Feature components are grouped under `src/components/`:

- `applicant/`: applicant dashboard, job board, application modal and portal.
- `auth/`: registration/login/verification UI.
- `common/`: shared UI, modals, notifications and other reusable elements.
- `hr/`: recruiter dashboard, pipeline, interview/scorecard/offer/analytics features.

The frontend calls API endpoints through the shared API client/configuration. Keep provider secrets and privileged business logic on the server.

### Backend

`server/server.js` creates the Express app, configures CORS and middleware, applies request/security controls, registers route groups, exposes health handling, and serves the built frontend where configured.

| Directory/file | Responsibility |
|---|---|
| `server/routes/` | Maps HTTP methods/paths to controllers and applies authentication/role middleware. |
| `server/controllers/` | Validates request context and orchestrates authentication, jobs, applications, AI, notifications and analytics workflows. |
| `server/middleware/authMiddleware.js` | Authentication and role checks. |
| `server/middleware/inputValidation.js` | Request-body validation and normalization. |
| `server/middleware/rateLimit.js` | In-process rate limiting for global and sensitive operations. |
| `server/middleware/uploadSecurity.js` | Resume/attachment validation. |
| `server/middleware/securityHeaders.js` | Security-related response headers. |
| `server/services/store.js` | Local JSON data store, initial development/demo data, reliability and local backups. |
| `server/services/postgresStore.js` | PostgreSQL schema and persistence implementation. |
| `server/services/storageService.js` | Local or R2 resume object storage. |
| `server/services/emailService.js` | Email composition/delivery and queue integration. |
| `server/services/geminiService.js` | Gemini requests, fallback handling, parsing and screening. |
| `server/services/scoringService.js` | Deterministic ATS score calculation and match breakdown. |
| `server/services/analyticsService.js` | Analytics aggregation. |
| `server/services/atsHelper.js` | Shared ATS helpers, timeline/scorecard defaults and related data utilities. |
| `server/services/logger.js` | Structured backend logging/request logging. |
| `server/workers/emailWorker.js` | Background email queue processing. |
| `server/scripts/` | HR creation, local backups, and optional JSON-to-PostgreSQL migration. |
| `server/tests/` | Automated regression/security/reliability tests. |

## 5. Main data and business workflows

### Authentication and account lifecycle

1. Public registration is for applicants; HR accounts are provisioned through an authorized administrative process.
2. Registration stores a pending record and sends a verification link. A verified email is required before the account becomes usable.
3. Login validates credentials and issues a server-managed session/token.
4. Authenticated requests are checked by middleware; HR-only operations use role gates, while applicant-specific records must be ownership-checked.
5. Logout invalidates the session. Password reset uses email links. Account deletion is rate-limited and requires confirmation; related records/files are cleaned up according to the account role.

Do not weaken role checks by trusting user IDs or roles supplied by the browser. Test horizontal access boundaries with multiple accounts.

### Job application and resume processing

1. HR creates a job and defines required skills, optional/non-required skills, experience expectations, and scoring weights.
2. An applicant submits an application with an allowed PDF, DOCX, or TXT resume (the upload route has a size limit).
3. The original file is written to the configured storage provider; parsed resume data and application metadata are stored in the data store.
4. Gemini may parse structured fields and support AI screening. Failures should be logged server-side and surfaced as safe, readable errors.
5. HR reviews the resume and moves the application through stages, adds notes, schedules interviews, records evaluations/scorecards, and manages offers.
6. Notifications and emails inform the relevant users; analytics aggregate recruitment activity.

### Deterministic ATS score

`server/services/scoringService.js` normalizes candidate resume text, summary, and skills; compares required and optional skills; detects experience years from text; and applies the job's configured weights.

Default weights in the service are:
- Required skills: 70%
- Non-required skills: 20%
- Experience: 10%

Weights must total exactly 100%. The score includes a breakdown and matched/missing skills. This is a heuristic, not a validated prediction of job performance. Validate scoring criteria with HR and monitor for bias before operational use.

### Interview scorecards and evaluations

Scorecard criteria are recorded on the HR side. The overall rating should be derived consistently from the criteria ratings as implemented in the current app; test both per-criterion bounds and aggregate calculation after changing this feature. Interview evaluation scores are not the same thing as the deterministic resume/job match score.

### Offers and currency

Offer data can contain a numeric amount and a currency. Ensure the amount/currency representation remains consistent through HR entry, database persistence, applicant display, and email templates. Regression-test both PHP and USD offers, especially numeric zero values: do not use truthiness checks that accidentally convert a valid amount to `0` or blank. Use an explicit null/undefined check when deciding whether an amount was supplied.

## 6. API groups

Routes are mounted under `/api`. The key groups are:

- **Auth:** `/api/auth/*` — registration, verification, login, current user, logout, password reset, account deletion.
- **Jobs:** `/api/jobs/*` — list/view and HR job management.
- **Applications:** `/api/applications/*` — submit/list/view applications, resume access, stage changes, notes, interviews, evaluations, scorecards, timeline, duplicates, merge, offers and deletion.
- **AI:** `/api/ai/*` — resume parsing and screening.
- **Notifications:** `/api/notifications/*` — list/read/delete/clear and email retry behavior.
- **Analytics:** `/api/analytics/*` — dashboard metrics and CSV export.
- **Health:** `/api/health`.

Treat route definitions and middleware as the source of truth for each method's exact authorization requirements. Any new endpoint must include validation, authentication/role checks, ownership checks, safe errors, and tests.

## 7. Security, privacy and operational notes

- `.env` is a secret file. Do not commit or include it in handoff archives.
- Never expose Gemini, Resend, Gmail, PostgreSQL, or R2 credentials to the frontend.
- Keep R2 private and use authenticated backend resume retrieval.
- Keep production HTTPS enabled and use exact CORS origins.
- Production must use persistent PostgreSQL and R2, not ephemeral local files.
- Current in-process rate limits are not shared across multiple server instances and reset on restart. Before scaling horizontally, add edge/WAF controls and/or a shared rate-limit store.
- Review proxy trust settings with the hosting provider before enabling `TRUST_PROXY`.
- Test backups by restoring them; an untested backup is not a recovery plan.
- Applicant resumes and hiring data are sensitive personal information. Limit staff access, define retention/deletion policy, and comply with applicable privacy and employment requirements.
- AI outputs can be wrong or biased. Keep human review and explainable criteria in the hiring workflow.

## 8. Known release caveats

The included `DEPLOYMENT_READINESS_AUDIT.md` says the app is **not yet cleared for production**. It records that live provider integrations and some release checks were not verified in that audit. Before release, run `npm ci`, `npm run lint`, `npm run test:all`, `npm run build`, and `npm audit`, then test the deployed staging environment end to end. Re-check the audit after making changes.

## 9. Analyst-ready analytics export

The HR analytics view can download a ZIP archive from `GET /api/analytics/analyst-pack`. This endpoint uses the same filters submitted to `GET /api/analytics` and remains behind authentication plus the HR-role guard. It does not require a third-party ZIP package; the archive is generated by Node built-ins.

The archive includes:

- `executive_summary.csv`: values, units, calculation rules, data-source references, caveats, and numerator/denominator where applicable.
- `application_detail.csv`: one row per non-merged filtered application, with source, job information, current stage, stage-reached flags, score and scorecard summary, interview/offer fields, and time-to-hire details.
- `time_to_hire_observations.csv`: the valid per-application records contributing to time-to-hire average/median.
- `funnel.csv`, `funnel_membership.csv`, `source_effectiveness.csv`, and `rejection_reasons.csv`: funnel progression, normalized application-stage membership, source outcomes, and rejection reasons.
- `timeline_events.csv`, `stage_duration_observations.csv`, and `stage_duration_summary.csv`: recorded events and the observations behind stage duration metrics.
- `job_fill_analysis.csv`, `stalled_applications.csv`, and `overdue_evaluations.csv`: job lifecycle and operational follow-up datasets.
- `scorecards.csv` and `offer_history.csv`: interview evaluation and offer lifecycle records.
- `data_dictionary.csv`, `filter_context.csv`, and `README.txt`: field definitions, applied filters, formulas, join keys, and important metric limitations.

Join datasets using `application_id`; job lifecycle data uses `job_id`. Timestamps are ISO-8601 UTC strings. Personal contact details and resume text are intentionally omitted from this export. Treat exported candidate-linked records as confidential and share only with authorized HR or analytics staff.

### Metric definitions and limitations

- **Funnel:** counts applications that reached each stage based on current stage and event evidence. Stage counts are cumulative, not mutually exclusive current-stage buckets. Conversion is `stage count / previous stage count * 100`; overall conversion is `stage count / total applications * 100`.
- **Qualified:** resume match score at least 70, or reached Shortlisted, Interview Scheduled, Job Offer, or Hired.
- **Time to hire:** hire/offer acceptance timestamp minus application `createdAt`. No `updatedAt` fallback is used. Applications without valid non-negative timestamps are omitted from the mean/median observations.
- **Time to fill:** first valid hire timestamp minus job `createdAt`, for a closed job with at least one hire and valid dates. It is job-level and only honors the selected job filter; source/status/date/recruiter filters do not alter the job-lifecycle cohort.
- **Stage duration:** average interval from a recorded stage event to the next recorded transition. When the application remains in that stage, the interval runs to the export timestamp. UI-synthesized timeline events are not treated as historic evidence.
- **Stalled:** current active-stage application where `updatedAt` (falling back to `createdAt`) is more than 14 days before export.
- **Overdue evaluation:** a past interview with no recorded evaluation rating and no scorecard.
- **Cost per hire by source:** not calculated unless source/channel-level spend is stored. Job-level sourcing spend is not allocated to sources by assumption.

Blank values mean missing/not calculable/not recorded, not zero. The export's `executive_summary.csv` and `data_dictionary.csv` should be used alongside the numeric output when interpreting or building downstream models.
