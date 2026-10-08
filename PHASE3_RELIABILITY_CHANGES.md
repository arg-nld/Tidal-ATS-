# Phase 3 Reliability Changes

## Implemented

1. Database persistence now writes through a temporary file and replaces the live JSON file, with Windows-safe fallback handling.
2. Rolling `server/data/backups/` snapshots are created before writes on a configurable interval; old backups are pruned.
3. On startup, an unreadable/corrupt `db.json` is recovered from the newest valid backup before falling back to seed data.
4. Store write failures now throw instead of silently reporting success, preventing false-positive saves.
5. Added `npm run backup:data` for manual database snapshots.
6. Added a process-safe interview slot reservation/update method so two requests in the same backend process cannot pass a check and then overwrite the slot independently. PostgreSQL is still recommended later for multi-instance/transactional guarantees.
7. Email delivery now retries transient provider/network failures up to a configurable number of attempts using the same idempotency key.
8. Email delivery attempts are recorded in `emailLogs` without storing message bodies, and logs are capped at 1,000 records.
9. Interview scheduling and pipeline-stage changes now distinguish `emailSent` from a successful ATS status save, so email failure no longer falsely reports success.
10. Duplicate applications for the same applicant and job are rejected with HTTP 409 to protect candidate/application data from accidental double submissions.
11. Added an HR-only manual `POST /api/notifications/:id/retry-email` endpoint for notifications whose external email delivery failed.
12. Added deterministic scoring regression tests covering aliases, edge cases, weight changes, experience handling, missing skills, and invalid weights.
13. Added persistence/interview recovery tests.
14. `/api/health` now reports non-sensitive persistence/backup status.
15. Added graceful SIGINT/SIGTERM handling so the JSON store is saved before shutdown.

## Still needed for production

- PostgreSQL for real transactions and multi-instance concurrency.
- Durable object storage for resumes.
- External/managed backups rather than local-only snapshots.
- Redis-backed rate limiting and job queues when horizontally scaling.
- A dedicated email queue/worker so provider retries do not occupy API request time.
