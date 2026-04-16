# Implementation Notes: WhatsApp Auto Messaging + Reminder System

## What was implemented

### 1) MongoDB persistence (no Prisma)
- Added MongoDB Atlas integration via `mongodb` package.
- Added `submissions` collection handling with automatic indexes:
  - unique index on `externalId`
  - compound index on `eventAt + reminderStatus`
- Stored fields include:
  - `externalId`, `name`, `phone`, `email`, `city`, `gender`, `eventAt`, `sourcePayload`
  - `welcomeStatus`, `welcomeSentAt`, `welcomeError`
  - `reminderStatus`, `reminderSentAt`, `reminderError`
  - `createdAt`, `updatedAt`

### 2) Secure WordPress webhook (instant flow)
- Added endpoint: `POST /api/webhook/wordpress`
- Secret validation:
  - expects `x-webhook-secret` header
  - value must match `WORDPRESS_WEBHOOK_SECRET` (if set)
- Normalizes incoming payload and upserts submission idempotently.
- Sends welcome message instantly if welcome is not already sent.

### 3) Event date extraction strategy
- Uses `EVENT_DATE_FIELD_CANDIDATES` first (comma-separated field labels/keys).
- Falls back to intelligent label matching for words like `event`, `date`, `booking`, `appointment`.
- Supports flexible parsing:
  - ISO-like values
  - common `dd/mm/yyyy` and `dd-mm-yyyy` formats (with optional time)
- If not parsable, `eventAt` is stored as `null` and reminder status is `not_scheduled`.

### 4) WhatsApp service refactor
- Moved send logic into shared service (`src/lib/whatsapp.ts`) used by:
  - manual send API (`/api/whatsapp`)
  - webhook welcome flow
  - reminder cron flow
- Supports templates with placeholders via `src/lib/templates.ts`:
  - `{name}`, `{event_date}`, `{event_time}`

### 5) Reminder scheduler route
- Added endpoint: `GET|POST /api/reminders/run`
- Secret validation:
  - accepts `x-cron-secret` header, or `Authorization: Bearer <CRON_SECRET>`
- Finds reminder-eligible submissions in window `now + 24h` to `now + 48h` with `reminderStatus = pending`.
- Sends reminder once and updates status (`sent` or `failed`).

### 6) Dashboard updates
- Dashboard now reads from DB-backed records using `GET /api/submissions`.
- Existing filters kept and new filters added:
  - Event date range (`from`, `to`)
  - Message status (`welcome_sent`, `welcome_failed`, `reminder_sent`, `reminder_pending`, `missing_event_date`)
- Added columns for:
  - Event date
  - Welcome status
  - Reminder status
- Added `Sync WordPress` button to import entries via existing WordPress pull route.

### 7) Env configuration updates
- Extended `.env.example` and `.env.local` with:
  - `MONGODB_URI`, `MONGODB_DB_NAME`
  - `WORDPRESS_WEBHOOK_SECRET`
  - `CRON_SECRET`
  - `APP_TIMEZONE`, `NEXT_PUBLIC_APP_TIMEZONE`
  - `EVENT_DATE_FIELD_CANDIDATES`
  - `WELCOME_MESSAGE_TEMPLATE`, `REMINDER_MESSAGE_TEMPLATE`

## Setup steps
1. Fill all required environment variables in `.env.local`.
2. Configure WordPress plugin webhook URL:
   - `https://<your-domain>/api/webhook/wordpress`
3. Configure webhook header:
   - `x-webhook-secret: <WORDPRESS_WEBHOOK_SECRET>`
4. Configure cron (hourly recommended) to call:
   - `https://<your-domain>/api/reminders/run`
   - with either `x-cron-secret` or bearer token matching `CRON_SECRET`

## Test checklist
1. Send a test form from WordPress and verify:
   - record appears in dashboard
   - welcome message sends once
2. Re-send same payload and verify no duplicate welcome send.
3. Insert event date about 24-36h in future and trigger reminders endpoint.
4. Verify reminder status changes correctly (`sent`/`failed`).
5. Verify dashboard filters:
   - search + city + gender
   - event date from/to
   - message status options

## Important note
- If `MONGODB_URI` is missing, DB-backed routes return errors until configured.

## Troubleshooting delivery
- `"Message accepted by WhatsApp"` means Meta accepted the request, not that the user already received it.
- To track real delivery (`delivered`, `read`, `failed`), configure Meta webhook callback to:
  - `https://<your-domain>/api/webhook/whatsapp`
  - verify token must match `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- If using Meta test sender (`+1 555...`), only allow-listed recipient numbers can receive messages.
