# TIDAL Solutions Talent ATS

A recruitment management web application for applicants and HR teams. It supports job publishing, applications and resume uploads, AI-assisted resume parsing, configurable candidate scoring, recruitment pipelines, interview scheduling and evaluations, offers, notifications, email verification, and HR analytics.

## Requirements

- Node.js compatible with the versions of Vite and the project dependencies in `package.json`
- npm
- A Gemini API key for AI resume parsing
- An email provider configuration for verification, password resets, and recruitment emails
- PostgreSQL is optional for local development; without `DATABASE_URL`, the app uses its local JSON data store

## Local setup

1. Open a terminal in the project root.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and fill in the settings you need. At minimum, configure `GEMINI_API_KEY` for AI features and a working email provider for email-based account flows. Keep `.env` private and never commit or share real credentials.
4. Start the frontend and backend together:

   ```bash
   npm run dev
   ```

5. Open the local URL printed by Vite, usually `http://localhost:5173`. The development server proxies API requests to the backend; the default backend port is `5001`.

## Environment configuration

Use `.env.example` as the configuration reference. Common settings include:

- **AI:** `GEMINI_API_KEY`, `GEMINI_MODEL`
- **Email:** `EMAIL_PROVIDER`, `EMAIL_FROM`, and either Gmail SMTP credentials (`GMAIL_USER`, `GMAIL_APP_PASSWORD`) or `RESEND_API_KEY`
- **Application URLs:** `APP_URL`, `FRONTEND_URL`, `CORS_ORIGINS`
- **Database:** `DATABASE_URL` and optional PostgreSQL pool/SSL settings
- **Resume storage:** `OBJECT_STORAGE_PROVIDER=local` for local development, or `s3` with the S3-compatible settings for Cloudflare R2

For PostgreSQL, R2, queued email, and production environment setup, follow [`DOCUMENTATION.md`](./DOCUMENTATION.md) and [`DEPLOYMENT_READINESS_AUDIT.md`](./DEPLOYMENT_READINESS_AUDIT.md). Do not enable queued email unless PostgreSQL is configured.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local frontend and backend |
| `npm run build` | Build the frontend for deployment |
| `npm run start` | Start the backend / production server |
| `npm run lint` | Run ESLint |
| `npm run test:all` | Run the automated test suite |
| `npm run backup:data` | Create a backup of the local JSON data store |
| `npm run create:hr` | Create an HR account from a trusted local terminal |
| `npm run migrate:postgres` | Migrate local JSON data to the configured PostgreSQL database |
| `npm run worker:email` | Run the email queue worker when queue mode is configured |

## HR account access

Public registration is for applicants only. Create HR accounts from a trusted terminal in the project directory:

```bash
npm run create:hr
```

Follow the prompts. Do not expose HR account creation through public registration.

## Documentation

Use these documents for details that do not belong in this quick-start README:

- [`DOCUMENTATION.md`](./DOCUMENTATION.md) — system architecture, environment variables, workflows, APIs, scoring, analytics exports, and technical notes.
- [`PROJECT_HANDOFF.md`](./PROJECT_HANDOFF.md) — deployment handoff, service provisioning, staging checks, release and rollback procedures.
- [`DEPLOYMENT_READINESS_AUDIT.md`](./DEPLOYMENT_READINESS_AUDIT.md) — production prerequisites, security considerations, service monitoring, and release checks.

## Before deployment

Do not deploy with development settings or unreviewed credentials. Configure the production database, private resume storage, email sender, application URLs, CORS, and HTTPS; run the build and tests; and complete the checks in [`DEPLOYMENT_READINESS_AUDIT.md`](./DEPLOYMENT_READINESS_AUDIT.md). If this project ZIP contains a real `.env` file or credentials, rotate those credentials before use and do not redistribute the secrets.
