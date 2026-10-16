# TIDAL ATS — Project Handoff & Production Readiness Plan

**Audience:** incoming developer, DevOps engineer, technical owner, or company IT team  
**Goal:** take ownership of the repository, verify it, prepare production infrastructure, deploy safely, and establish ongoing operations.

## 1. Handoff summary

TIDAL ATS is a React/Vite + Express application for applicant and HR recruitment workflows. The intended production architecture is:

- React frontend built into `dist/`, served by Express for a same-origin deployment (recommended simplest option).
- Node.js/Express backend.
- Managed PostgreSQL for persistent application data.
- Private Cloudflare R2 bucket for original resumes and attachments.
- Resend or Gmail SMTP for transactional email.
- Google Gemini API for AI parsing/screening, if enabled.
- Company-controlled domain with HTTPS.
- Host-managed environment secrets, logs, backups and uptime monitoring.

Read first:
1. `README.md` — overview and commands.
2. `DOCUMENTATION.md` — environment variables and architecture.
3. `DEPLOYMENT_READINESS_AUDIT.md` — outstanding release gates and monitoring.
4. `PRODUCTION_SETUP_GUIDE.md` — detailed infrastructure and hardening notes.
5. `CLOUDFLARE_R2_SETUP.md` — R2 configuration.

## 2. Critical security rules

- **Never request or transfer the previous developer's `.env` file.** Create fresh production credentials and enter them directly into the hosting provider's secret manager.
- Rotate any credentials that may have been committed, emailed, screenshotted, or included in an archive. A value being present in a private ZIP does not make it safe.
- Do not deploy the local JSON database, test accounts, sample resumes, or backup snapshots as production data.
- Do not make the R2 bucket public.
- Do not run `npm run migrate:postgres` for a fresh production database. It is an import tool for existing local JSON data, not a routine production startup command.
- Do not use `npm run dev` as the production process.
- Do not enable production access for real applicants until staging acceptance tests pass.

## 3. Phase 0 — Take ownership and establish a clean baseline

- [ ] Obtain repository access and confirm the intended branch/tag and source-of-truth location.
- [ ] Inspect the diff and read all project-specific docs before editing.
- [ ] Use a supported Node.js LTS version compatible with Vite 8; record the exact Node/npm versions used for the release.
- [ ] Create a new local `.env` from `.env.example`; use test/development credentials only.
- [ ] Run `npm ci`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run test:all`.
- [ ] Run `npm run build`.
- [ ] Run `npm audit` and review high/critical findings; document any accepted risk.
- [ ] Start the app locally and confirm `/api/health` responds.
- [ ] Record failures and fix them before proceeding. Do not mark a command as passed unless it actually completed successfully.

## 4. Phase 1 — Provision production services

### A. Managed PostgreSQL

- [ ] Create a new managed PostgreSQL database in a region close to the backend host.
- [ ] Create a dedicated least-privilege application database user if supported.
- [ ] Save the connection URI in the host's secret manager as `DATABASE_URL`.
- [ ] Configure `PG_SSL=true` if required by the provider and keep `PG_SSL_REJECT_UNAUTHORIZED=true` unless provider documentation explicitly says otherwise.
- [ ] Set `PG_POOL_MAX` to a value within the database plan's connection limit.
- [ ] Enable automated backups and point-in-time recovery if available.
- [ ] Confirm schema initialization at first startup and create the first HR account using `npm run create:hr` or the documented approved process.
- [ ] Verify that data survives an application restart and a redeploy.

**Fresh database rule:** the app initializes its schema on startup. If starting from scratch, do not run the JSON migration script. If historical records must be migrated, first create a separate migration plan, make verified backups, test the migration on a disposable database, and reconcile users/jobs/applications/resume object references before cutover.

### B. Cloudflare R2

- [ ] Create a private R2 bucket for ATS resumes.
- [ ] Create a dedicated R2 API token scoped to the bucket and the minimum required read/write permissions.
- [ ] Store `S3_BUCKET`, `S3_REGION=auto`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` as backend secrets/config.
- [ ] Set `OBJECT_STORAGE_PROVIDER=s3`.
- [ ] Keep public access disabled; never expose a public URL for applicant resumes.
- [ ] Test upload, authenticated HR preview, access denial for unrelated applicants, and deletion of a disposable test resume.
- [ ] Document storage lifecycle/retention and cost alerts.

### C. Email provider

Choose one provider and configure only the matching credentials:

**Resend**
- [ ] Verify the company sender domain and configure the DNS records requested by Resend.
- [ ] Create a restricted API key and store it as `RESEND_API_KEY`.
- [ ] Set `EMAIL_PROVIDER=resend` and `EMAIL_FROM` to the verified sender.
- [ ] Confirm verification, password-reset, interview, status-change, and offer emails arrive and links point to the production HTTPS domain.

**Gmail SMTP**
- [ ] Use a suitable company mailbox and Google App Password; never use the account's normal password.
- [ ] Set `EMAIL_PROVIDER=gmail`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and `EMAIL_FROM`.
- [ ] Confirm sending limits and company policy permit this use.

Set `FRONTEND_URL`, `APP_URL`, and `CORS_ORIGINS` to the exact public production origin. If queue mode is selected, set `EMAIL_DELIVERY_MODE=queue`, configure the `EMAIL_WORKER_*` variables, and deploy `npm run worker:email` as a separately supervised worker. Otherwise use `direct` mode and test provider failure behavior.

### D. Gemini AI (if enabled)

- [ ] Create a production Gemini API key with appropriate project access and billing/quota controls.
- [ ] Store `GEMINI_API_KEY` only in the backend secret store.
- [ ] Set `GEMINI_MODEL` to a currently supported model after checking Google's current availability and pricing.
- [ ] Test parsing and screening against representative test resumes; test quota, timeout and unavailable-model errors.
- [ ] Ensure AI failure does not prevent recruiters from manually reviewing resumes.

### E. Hosting, domain and TLS

- [ ] Choose a Node.js host that supports the required Node version, environment variables, persistent process logs and outbound connections to PostgreSQL, R2, email, and Gemini.
- [ ] Configure build command `npm ci && npm run build`.
- [ ] Configure start command `npm run start` (or `node server/server.js`).
- [ ] Set `NODE_ENV=production`.
- [ ] Configure `PORT` according to the host. Do not hardcode a local port.
- [ ] Configure domain DNS and HTTPS/TLS certificate.
- [ ] For same-origin hosting, serve the frontend through Express and leave `VITE_API_BASE_URL` unset. If frontend and backend are separate, set `VITE_API_BASE_URL` at build time to the backend origin ending in `/api` and set exact `CORS_ORIGINS`.
- [ ] Configure `TRUST_PROXY` only after confirming the host's proxy topology; do not blindly enable it.
- [ ] Confirm the production start fails closed if PostgreSQL or R2 configuration is missing.

## 5. Phase 2 — Configure production environment

Set secrets in the hosting platform's environment/secrets dashboard, not in the repository. The following is a **key checklist only**, not a credential file:

```dotenv
NODE_ENV=production
DATABASE_URL=<managed PostgreSQL URI>
PG_POOL_MAX=10
PG_SSL=true
PG_SSL_REJECT_UNAUTHORIZED=true

OBJECT_STORAGE_PROVIDER=s3
S3_BUCKET=<private R2 bucket>
S3_REGION=auto
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_FORCE_PATH_STYLE=false
S3_ACCESS_KEY_ID=<R2 access key>
S3_SECRET_ACCESS_KEY=<R2 secret key>

APP_URL=https://<production-hostname>
FRONTEND_URL=https://<production-hostname>
CORS_ORIGINS=https://<production-hostname>

EMAIL_DELIVERY_MODE=direct
EMAIL_PROVIDER=resend
RESEND_API_KEY=<Resend API key>
EMAIL_FROM=<verified sender address>
COMPANY_NAME=TIDAL Solutions

GEMINI_API_KEY=<Gemini key>
GEMINI_MODEL=<currently supported model>
```

For Gmail, replace the Resend variables with `EMAIL_PROVIDER=gmail`, `GMAIL_USER`, and `GMAIL_APP_PASSWORD`. Add `TRUST_PROXY=true` only if the hosting topology justifies it. Do not copy credentials from any existing developer `.env`.

## 6. Phase 3 — Staging acceptance tests

Use disposable test accounts and test resumes only. Keep a record of the date, tester, result, and any bug ticket.

### Authentication and authorization
- [ ] Applicant registration and email verification work.
- [ ] Unverified users cannot sign in.
- [ ] Login, reload/session persistence, logout and password reset work.
- [ ] HR accounts cannot be created through public applicant registration.
- [ ] Applicant cannot access HR routes.
- [ ] Applicant A cannot read Applicant B's application, timeline, resume, notifications, or offer.
- [ ] Session invalidation and account deletion behave correctly.
- [ ] Login/verification/reset rate limits do not block normal usage unexpectedly.

### Recruitment workflows
- [ ] HR creates, edits, publishes and closes a job.
- [ ] Applicant browses jobs and submits an application.
- [ ] PDF, DOCX and TXT resume uploads are accepted; unsupported/oversized files are rejected.
- [ ] Original resume opens through authorized backend access.
- [ ] AI parse/screen returns valid data or a safe, recoverable error.
- [ ] Candidate score weights total 100 and breakdown/matched/missing skills are correct.
- [ ] HR stage changes, notes, timeline, duplicate detection and merge work.
- [ ] Interview scheduling handles availability, email copy, attachments and timezone.
- [ ] Each scorecard criterion accepts only valid ratings; overall rating follows the documented criteria aggregation.
- [ ] Offer amount and currency display correctly for both PHP and USD, including nonzero values, decimal amounts and missing values.
- [ ] Offer approval, sending, applicant accept/decline and withdrawal work.
- [ ] HR analytics and CSV export agree with the underlying test data.

### Notifications, email and operations
- [ ] HR and applicant notifications show correct unread counts; read/delete/clear actions persist after refresh.
- [ ] Verification/reset/interview/status/offer emails are delivered with correct production URLs and sender.
- [ ] If queue mode is used, retries, worker restart and duplicate-delivery protection are tested.
- [ ] `/api/health` works without exposing internal paths or secrets.
- [ ] No frontend console errors or failed API requests during key workflows.
- [ ] Logs show request/error context but redact credentials and verification tokens.
- [ ] Resume files are private and deletion behavior is correct.
- [ ] Database backup restoration and R2 recovery procedure are tested, not merely configured.

## 7. Phase 4 — Release gate

Run these from a clean checkout:

```bash
npm ci
npm run lint
npm run test:all
npm run build
npm audit
```

Release only after:
- all commands complete successfully or every exception is reviewed and documented;
- high/critical dependency issues have been addressed or formally accepted;
- all staging tests pass;
- HTTPS, DNS, email sender authentication and secret storage are verified;
- database backups and restore are tested;
- access controls and private resume handling are validated;
- stakeholders approve the release and rollback plan.

The supplied `DEPLOYMENT_READINESS_AUDIT.md` notes that this source revision was **not yet cleared for production** at audit time: frontend build, ESLint, dependency audit and live integrations still required verification. Re-run these gates against the exact release commit.

## 8. Deployment and rollback procedure

1. Create a tagged release/commit and preserve the previous deployable version.
2. Deploy to staging first and run smoke/acceptance tests.
3. Back up the production database before any schema-affecting release. Confirm restore access.
4. Deploy the exact tested build to production.
5. Check logs, `/api/health`, login, job list, application submission, email delivery and resume retrieval immediately.
6. Watch error rates, latency, database connections, email rejection, Gemini quota, and R2 failures.
7. If a critical regression occurs, roll back to the previous application build. Avoid destructive database changes until compatibility is assessed. Restore data only under an approved recovery plan.
8. Record release version, deployment time, migration/schema changes, verification results and any incident.

## 9. Post-launch ownership and maintenance

- [ ] Assign owners for app, database, domain/DNS, R2, email, Gemini billing, and incident response.
- [ ] Establish uptime/error alerts and log retention.
- [ ] Set billing/quota alerts for Gemini, email, database and object storage.
- [ ] Rotate secrets on a schedule and immediately after suspected exposure or staff turnover.
- [ ] Apply dependency/security updates through tested releases.
- [ ] Review rate limits. Current in-process limits are not shared across replicas and reset on restart; use host/WAF limits and a shared store before horizontal scaling.
- [ ] Review privacy notice, consent, data retention, applicant deletion, access auditability, and relevant local legal requirements.
- [ ] Perform periodic backup restore drills and document recovery time objectives.
- [ ] Review hiring-score criteria for job relevance, fairness and explainability. Keep a human decision-maker responsible for employment decisions.
- [ ] Keep a runbook for provider outages, email failures, AI quota exhaustion, database failure, R2 failure and credential rotation.

## 10. Ownership transfer checklist

The outgoing owner should transfer:
- [ ] Source repository access and release branch/tag.
- [ ] Architecture and environment-variable documentation.
- [ ] Hosting provider/project access through company-managed accounts.
- [ ] Domain/DNS and TLS ownership.
- [ ] PostgreSQL admin and app-user access through the company's approved secrets manager.
- [ ] R2 bucket and token ownership; issue new tokens for the incoming owner if needed.
- [ ] Email provider domain/sender and API access.
- [ ] Gemini project/API access and billing owner.
- [ ] Monitoring, alerting, backups, restore procedure and incident contacts.
- [ ] Known issues, accepted risks, test results, and release history.

Do not send credentials in this document or through ordinary chat. Grant access using the providers' role-based access controls and rotate any shared credentials after handoff.

## 11. Analytics export validation during handoff

The HR analytics export now includes a detailed analyst pack at `GET /api/analytics/analyst-pack`, downloadable from the HR dashboard's **Export Analyst Pack** action. Confirm that the incoming owner validates:

- [ ] The exported ZIP opens successfully and all CSV files import into Excel, Power BI, Tableau, Python, or SQL staging tools.
- [ ] `application_id` joins correctly across application details, funnel membership, timeline events, time-to-hire observations, stage-duration observations, scorecards, and offer history.
- [ ] Dashboard filters in `filter_context.csv` match the view before export.
- [ ] Each executive KPI has a usable formula/rule and correct numerator/denominator where appropriate.
- [ ] Merged duplicates do not inflate the application counts.
- [ ] Blank timing values remain blank when timestamp evidence is missing.
- [ ] Source-level cost-per-hire is not invented without source-specific spend data.
- [ ] Exported data does not contain applicant contact details or resume text.
- [ ] Unauthorized/applicant users receive HTTP 403 for both analytics and analyst-pack endpoints.

The pack is a traceability aid, not a substitute for acceptance testing. Its values should reconcile with the dashboard under the same filter settings before the release is approved.
