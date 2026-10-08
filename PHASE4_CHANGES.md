# Phase 4 — Full Scope

Phase 4 combines the current UX/authorization improvements with the planned production scalability work.

## Phase 4A — Registration, Notifications, and Administration

### Registration password controls

- Replaced the signup "Show passwords / Hide passwords" text control with a simple eye icon on each password field.
- Password and Confirm Password have independent visibility toggles.
- Existing password hashing and validation are unchanged.

### Notifications — HR + Candidate

- `GET /api/notifications` is always scoped to the authenticated user's `recipientUserId`.
- Read, remove, and clear-all operations are ownership-checked server-side.
- Added `DELETE /api/notifications/:id` for individual removal.
- Added `DELETE /api/notifications` for clearing all notifications belonging to the signed-in user.
- Opening an unread notification marks it read server-side.
- The unread badge updates immediately after read/remove/clear operations.
- Notification list and unread count use the same authenticated-user API source of truth.
- Notification drawer scroll position is preserved when opening/closing a notification and restored after reopening the drawer.
- Added regression tests for notification ownership, removal, clear-all, and idempotent read state.

### HR account creation

Public registration remains applicant-only. HR accounts are created by a trusted server administrator:

```bash
npm run create:hr
```

The command interactively collects HR account details, hides password entry, hardcodes the server-side role to `hr`, marks the administrator-created account as verified, and uses the existing password service for secure password hashing.

Do not add a public "Register as HR" option.

---

# Phase 4B — Scalability / Production Architecture

The following items are part of the full Phase 4 scope. They are planned production upgrades and should be implemented without weakening the Phase 1–3 security and reliability controls.

## 29. Replace `db.json`

Retire the JSON file as the primary application database. Existing data must be migrated safely before removing the JSON store from active use.

Requirements:

- Preserve existing users, jobs, candidates, applications, resumes, screening results, interviews, notifications, and related data.
- Keep backup/recovery procedures during migration.
- Do not leave two competing sources of truth after migration.

## 30. Move to PostgreSQL

Use PostgreSQL as the production relational database.

Requirements:

- Define normalized relational tables for ATS entities.
- Use migrations and versioned schema changes.
- Use server-side parameterized queries / ORM protections against SQL injection.
- Keep authorization checks in the API layer.
- Add a safe migration path from the current JSON data.
- Configure database connection settings through environment variables.

## 31. Move resume files to object storage

Replace local `server/data/uploads/` storage with object storage.

Requirements:

- Store only metadata and object keys/URLs in PostgreSQL.
- Keep uploads private by default.
- Use server-authorized access for downloading/viewing resumes.
- Use generated object names rather than user-controlled filenames.
- Keep existing MIME/signature validation and file-size limits.
- Do not expose storage credentials or API keys to the frontend.

## 32. Separate application-related entities

Refactor the data model so application-specific information is not duplicated across candidate/job records.

Recommended separation:

```text
User
Candidate
Job
Application
Resume
ResumeParsedData
ScreeningResult
Score
Interview
Note
Notification
```

Requirements:

- A candidate can apply to multiple jobs.
- Each job application has its own status/stage, screening result, score, interviews, and notes where applicable.
- Candidate profile data remains separate from job-specific application state.
- Prevent duplicate applications with database-level constraints where practical.

## 33. Add email queue / worker

Move email sending out of the request/response path.

Target flow:

```text
API request → Email Queue → Worker → Resend
```

Requirements:

- Persist pending email jobs.
- Support retries with controlled backoff.
- Track attempts, status, timestamps, and provider/message IDs where available.
- Avoid duplicate sends where possible through idempotency/deduplication.
- User-facing actions such as interview scheduling must not fail merely because email delivery is temporarily unavailable.
- Preserve the existing email logs and retry behavior while moving delivery to the worker architecture.

## 34. Add pagination

Introduce server-side pagination for large collections.

Priority areas:

- Candidates / applications
- Jobs
- Notifications
- Interviews / calendar-related records where necessary

Requirements:

- Do not load unbounded records into the frontend.
- Accept validated page/limit or cursor parameters.
- Return pagination metadata needed by the UI.
- Enforce sensible maximum page sizes.
- Keep authorization and tenant/user scoping applied before pagination.

## 35. Add database indexes

Add indexes based on actual ATS query patterns after the PostgreSQL schema is defined.

Expected candidates include:

- User email / authentication lookup
- Application candidate/job foreign keys
- Application status/stage
- Job status / publication state
- Notification recipient user + read state
- Interview date/time and related candidate/job fields
- Resume/application lookup fields

Requirements:

- Avoid unnecessary indexes that increase write cost.
- Use unique constraints where uniqueness is a business rule.
- Verify important indexes with PostgreSQL query plans before production rollout.

## 36. Add structured logging

Replace ad-hoc console logging for production diagnostics with structured, consistent logs.

Requirements:

- Use machine-readable JSON logs in production.
- Include timestamp, severity, request/correlation ID, route, method, status, duration, and relevant entity identifiers where safe.
- Never log passwords, session tokens, API keys, resume contents, verification tokens, or other secrets.
- Log authentication/security events at an appropriate level.
- Log email and AI job failures with enough context to diagnose them without exposing sensitive data.
- Keep errors useful while avoiding sensitive internal details in API responses.

---

## Phase 4 implementation order

Recommended order:

```text
29. Replace db.json / migration plan
        ↓
30. PostgreSQL schema + migrations
        ↓
32. Separate application-related entities
        ↓
35. Database indexes
        ↓
34. Pagination
        ↓
31. Object storage for resumes
        ↓
33. Email queue / worker
        ↓
36. Structured logging
```

Items 29–36 should be implemented incrementally and tested against the existing Phase 1–3 regression suite after each major migration step.

## Security and reliability constraints

- Do not revert Phase 1 authentication/session security.
- Do not restore trust in frontend user IDs or roles.
- Do not store plaintext passwords.
- Do not expose secrets to the frontend.
- Keep server-side authorization and ownership checks as the source of truth.
- Preserve upload validation, rate limiting, request validation, security headers, safe error handling, backups, recovery, interview conflict protection, duplicate application prevention, and email retry behavior.
