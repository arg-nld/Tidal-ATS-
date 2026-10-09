# Tidal ATS — PostgreSQL and Phase 4 review

This file records the changes made in this package and work that remains intentionally open. It does not claim a live PostgreSQL migration has completed.

## Fixed in this package

### Migration and existing data
- The migration now validates source arrays, required user/job/application fields, timestamps, duplicate IDs/emails/idempotency keys, and references before opening the data transaction.
- A legacy application referencing a deleted user is preserved with `user_id = NULL`; that retains the candidate/application in the HR system without granting it to a nonexistent portal account.
- Notifications whose recipient account no longer exists are omitted. Optional dangling `application_id` and `job_id` references are cleared to `NULL`, with warnings printed so the data cleanup is visible.
- Sessions belonging to deleted accounts are omitted. Email queue entries are included in migration; stale `processing` jobs are reset to `pending`.
- Interview dates are migrated as ISO text, matching the current `interviews.scheduled_at TEXT` schema.
- Schema creation and imported data are inside the same migration transaction. Failure triggers a rollback.
- Maya Patel's deleted test login has been removed from the bundled sample `db.json`; her application remains visible to HR as an unlinked candidate record. Five notifications addressed to that deleted login were removed. Runtime backup JSON files are not included in this distribution; keep the original uploaded ZIP as a rollback copy until the target environment is verified.

### PostgreSQL adapter / asynchronous compatibility
- Added a case-insensitive unique email index.
- Added a unique index for one application per signed-in user and job, matching the existing controller's duplicate-application rule.
- Fixed the email log idempotency conflict target to match its partial unique index.
- Added a unique email queue reference per email log and made repeated queue requests deduplicate instead of inserting duplicate jobs.
- Added abandoned-worker lease recovery for queued emails, with retry limits and updated email log status.
- Interview scheduling now serializes availability checks and the interview update in one transaction to reduce double booking under concurrent requests.
- Fixed the interview availability endpoint to await the async store result before filtering bookings.
- Fixed the email verification controller to await the user update, and fixed asynchronous HR notification creation to be awaited by the application controller.
- Prevented in-app notifications from being created for deleted or nonexistent recipient accounts; external email handling can still proceed.
- Fixed email queue persistence/idempotency in the JSON store and added tests for queue persistence and stale-job recovery.
- Corrected the PostgreSQL backup CLI so it does not falsely report a backup file that it did not create.

### Package security / hygiene
- Removed `.env` from the deliverable ZIP so connection strings/API keys are not repackaged. `.env.example` contains placeholders only.
- Excluded runtime `db.json`, upload data, and backup JSONs from version control; empty upload/backup directories retain `.gitkeep` files.

## Intentionally skipped / requires environment or a product decision

- **Live PostgreSQL migration test:** requires a reachable PostgreSQL server and a locally configured `.env`; no database credentials are shipped in this ZIP.
- **Resume file transfer to object storage:** the ZIP has no actual uploaded resume files or S3/R2 credentials. The migration carries database resume metadata, not the bytes themselves. Keep/copy the original upload directory or configure private object storage before relying on migrated resume links.
- **PostgreSQL-native pagination:** controllers still paginate after fetching collections. Moving filtering/count/limit into SQL requires a query/API refactor and was left separate from reliability fixes.
- **Normalized screening results and recruiter notes:** the current adapter continues to read/write screening metadata and recruiter notes through the existing `applications` fields. The `screening_results` and `recruiter_notes` tables are not wired through a complete normalized read/write lifecycle; changing the canonical model requires a deliberate follow-up migration.
- **PostgreSQL backup execution:** this package reports honestly that `npm run backup:data` does not produce a PostgreSQL dump. Use `pg_dump` or the hosting provider's backup service and verify restoration in the target environment.
- **Production CORS URL:** `.env.example` retains localhost as the development default. Set `CORS_ORIGINS` to the exact trusted production frontend origin(s) when deploying.
- **Secrets rotation:** `.env` has been omitted from the ZIP, but credentials that existed in the original local file cannot be rotated by a code change. Rotate provider/database secrets separately if they were live or shared.
- **Full build/lint verification:** this environment did not finish installing the package dependencies, so Vite and ESLint were unavailable. Node syntax checks and the automated Node test suite did run successfully.

## Validation performed

- Automated test suite: 24 passed, 0 failed.
- `node --check` passed for the edited backend scripts/controllers/services.
- Source data consistency check: 9 users, 4 jobs, 9 applications, 46 notifications, 0 email logs, 0 email queue rows, and 0 sessions. No notification recipient or application user references point to a nonexistent user in the bundled `db.json`.
- `npm run build` and `npm run lint` were attempted but could not execute because the dependency install timed out and the `vite`/`eslint` binaries were unavailable.
