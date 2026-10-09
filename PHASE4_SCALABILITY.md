# Phase 4 — Scalability Implementation

Implemented in this phase:

1. **PostgreSQL**
   - Added PostgreSQL relational schema and `pg` connection pool.
   - `DATABASE_URL` selects PostgreSQL at runtime.
   - `npm run migrate:postgres` migrates the current `server/data/db.json` into PostgreSQL.
   - JSON storage remains available when `DATABASE_URL` is absent for local development/regression tests.

2. **Object storage**
   - Resume storage now goes through `storageService.js`.
   - `OBJECT_STORAGE_PROVIDER=s3` stores resumes in S3-compatible object storage.
   - Local storage remains available for development.

3. **Application data separation**
   - Applications are separated from resumes, screening results (metadata), interviews, evaluations, notifications, sessions, and recruiter notes.
   - Foreign keys and cascade rules protect relationships.

4. **Email queue/worker**
   - Added a database-backed `email_queue`.
   - Set `EMAIL_DELIVERY_MODE=queue` for asynchronous delivery.
   - Run `npm run worker:email` as a separate worker process.
   - Retry handling remains enabled.

5. **Pagination**
   - Jobs, applications, and notifications support `page` and `limit` query parameters.
   - Example: `/api/applications?page=2&limit=50`.
   - Existing requests without pagination parameters continue returning the existing full list for compatibility.

6. **Indexes**
   - Added indexes for job status, application job/user/stage/email, interview time, sessions, notifications, email queue, and recruiter notes.

7. **Structured logging**
   - Added JSON request/error/server/worker logs with request IDs.
   - Sensitive credentials, tokens, passwords, and resume contents are not logged.

## Recommended production rollout

1. Create PostgreSQL database.
2. Set `DATABASE_URL`.
3. Run `npm run migrate:postgres`.
4. Verify `/api/health` reports `persistence.driver = postgresql`.
5. Configure S3-compatible object storage and set `OBJECT_STORAGE_PROVIDER=s3`.
6. Set `EMAIL_DELIVERY_MODE=queue`.
7. Run the API and `npm run worker:email` as separate processes.
8. Keep database backups enabled through the PostgreSQL provider/`pg_dump`.
