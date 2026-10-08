# Tidal ATS

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` and set your own credentials:

```env
GEMINI_API_KEY=your_google_ai_studio_api_key
GEMINI_MODEL=gemini-3.8-flash
PORT=5000
APP_URL=http://localhost:5173
COMPANY_NAME=Tidal Nexus
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=Tidal Nexus <onboarding@resend.dev>
```

For production email, verify your own domain in Resend and use an address from that domain for `EMAIL_FROM`.

Run:

```bash
npm run dev
```

## Latest changes

- Real email verification flow: registration sends a verification email; the account cannot log in until the link is opened.
- Notifications are now linked to the applicant account by `userId`, with email matching retained only for legacy records.
- Candidate notifications now appear for the correct signed-in candidate.
- Notification drawer opening is protected from accidental backdrop/event bubbling; clicking `View email` opens the message instead of closing the drawer.
- Notifications are server-scoped to the signed-in user; unread state, individual removal, and `Clear all` are persisted by the backend.
- Notification list scroll position is restored after opening/closing a notification.
- Public registration is applicant-only. HR accounts are created locally by an administrator with `npm run create:hr`.
- Original resumes load automatically when the HR opens the Original Resume tab.
- Interview time picker uses three vertical up/down controls for hour, minute, and AM/PM.
- Existing booked interview slots remain disabled and are checked by the server.
- Department filter/dropdown removed from the candidate job board.
- Department is not part of the new job publishing form.
- New jobs leave salary range and experience level blank.
- Candidate-facing Gemini/AI parsing language was removed from the applicant UI.
- Deterministic job scoring remains configurable and must total 100%.


## Email verification / Resend

The registration flow sends a real verification email. Resend accounts in testing mode can only deliver to the email address that owns the Resend account when using `onboarding@resend.dev`. This is a Resend provider restriction, not an ATS routing bug.

For production: verify your sending domain in Resend, then set for example:

```env
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM=Tidal Nexus <hr@yourcompany.com>
APP_URL=https://your-ats-domain.com
```

For local testing, you can keep `EMAIL_FROM=Tidal Nexus <onboarding@resend.dev>` and register using the email address that owns the Resend account.

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
