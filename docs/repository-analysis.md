# Green Konsult CRM – Repository Analysis

## Executive summary

The project is a solid MVP with clear sales-facing workflows (lead list, lead detail, reminders, call initiation, dialer UI, dashboard). The biggest gap is that core call/meeting lifecycle orchestration is not yet modeled as a first-class backend domain. Right now reminders and follow-up fields partially cover that need, but there is no dedicated `Meeting` entity, no automatic pre-meeting reminder generation, and Twilio callback endpoints are mostly placeholders.

For your stated outbound process (Call 1 book meeting, Call 2 close deal), the architecture should evolve from a CRUD-centric lead system to an **event-driven pipeline around lead interactions**:

- `Lead` as account state
- `Call` as interaction log
- `Meeting` as scheduled milestone
- `Reminder` as operational task
- `Call artifacts` (recordings/transcripts/summaries) as asynchronous enrichment

---

## 1) Architecture improvements

### A. Split monolithic FastAPI app into bounded routers/services
Current `backend/main.py` contains all domains (leads, notes, calls, dialer, reminders, dashboard) in one module. Move toward:

- `api/routers/leads.py`
- `api/routers/calls.py`
- `api/routers/meetings.py`
- `api/routers/reminders.py`
- `services/twilio_service.py`
- `services/reminder_service.py`
- `repositories/*.py` (optional)

Benefits:
- Easier ownership and testing
- Clear dependency boundaries
- Faster onboarding for future contributors

### B. Introduce stateful workflow engine for sales stages
Your business process is deterministic (Call 1 → meeting booked → Call 2 close). Encode this as explicit stage transitions instead of free-text status updates.

Suggested stage enum:
- `new`
- `attempting_contact`
- `meeting_booked`
- `meeting_done`
- `proposal_sent`
- `won`
- `lost`

Then gate transitions in one place (`LeadWorkflowService`) and produce audit events.

### C. Add background worker for delayed/async jobs
Automatic reminders and call artifact processing should not run in request handlers. Add queue processing:
- Celery/RQ/Arq + Redis
- Workers for:
  - schedule reminder before meeting
  - fetch recording/transcript after callbacks
  - generate AI summaries

### D. Replace in-memory dialer state with persistent server-side sessions
`dialer_state` is a global dict and will break with multiple instances, deploy restarts, or concurrent users. Persist dialer sessions in DB + Redis lock.

---

## 2) API structure improvements

### A. Versioning and domain-consistent naming
Current paths are mixed action style (`/api/calls/initiate/{lead_id}`, `/api/dialer/next`). Prefer resource-first endpoints:

- `POST /api/v1/calls` (create call attempt)
- `PATCH /api/v1/calls/{id}` (status updates)
- `POST /api/v1/dialer-sessions`
- `POST /api/v1/dialer-sessions/{id}/next`
- `POST /api/v1/meetings`
- `POST /api/v1/meetings/{id}/reminders`

### B. Introduce request/response DTOs for all endpoints
Some endpoints currently accept raw `dict` payloads (`start_dialer`) and return ad-hoc responses. Add Pydantic request models for validation and contract stability.

### C. Add idempotency and callback signature verification
For telephony callbacks:
- Verify Twilio signatures
- Make callback handlers idempotent (`external_event_id` unique index)
- Return `2xx` quickly and process downstream asynchronously

### D. Add pagination metadata envelopes
`GET /api/leads` has skip/limit but returns a plain list. Return:

```json
{ "items": [...], "total": 1234, "skip": 0, "limit": 100 }
```

### E. React API layer improvements
Current frontend API base URL is hardcoded to production. Use environment-based config (`import.meta.env.VITE_API_BASE_URL`). Also standardize request helpers for JSON/form-data responses and error normalization.

---

## 3) Database model improvements

### A. Add first-class `meetings` table
Current schema only has `Lead.follow_up_date` and generic reminders. Add:

- `meetings(id, lead_id, scheduled_at, timezone, meeting_type, status, agenda, outcome, created_by, created_at, updated_at)`
- Optional unique constraint per lead + datetime if needed

### B. Evolve reminders from date-only to datetime + reminder_type
Current reminders are `due_date` (date-only). For real meeting operations you need precise notification time:

- `due_at TIMESTAMP WITH TIME ZONE`
- `kind ENUM('meeting_prep','callback','followup','manual')`
- `channel ENUM('in_app','sms','email')`
- `sent_at`, `delivery_status`

### C. Normalize call outcomes and reasons
`calls.outcome` currently free string. Consider enum + detail fields:
- `outcome`: answered/no_answer/busy/failed/meeting_booked/not_interested
- `disposition_reason`: text or coded taxonomy

### D. Add audit/event table
Track key workflow actions (status changes, meeting booking, reminder completion, call imports, CSV operations).

### E. Add indexes and constraints
- Index `leads(status, created_at)`
- Index `calls(lead_id, created_at desc)`
- Index `reminders(completed, due_date)` or `due_at`
- Non-null / check constraints for critical fields

### F. Add migrations (Alembic)
`Base.metadata.create_all()` is fine for local bootstrap but not safe for production schema evolution. Introduce Alembic and explicit migration history.

---

## 4) Dialer system improvements

### A. Robust queue semantics
Add `dialer_sessions` + `dialer_items` tables:
- session status (`running/paused/completed/failed`)
- per-item status (`queued/calling/completed/failed/skipped`)
- retry count and next retry time

### B. Concurrency and ownership
Support multi-user dialing by attaching `user_id` to session; enforce one active session/user (or team-level policy).

### C. Better error handling
If a lead in queue was deleted, current logic may crash. Guard missing leads and mark item as `skipped_missing_lead`.

### D. Integrate outcomes into lead progression
When a call ends, update both:
- call record (duration/outcome)
- lead stage (`meeting_booked`, `callback`, `lost`, etc.)

### E. Rate limiting and compliance
Add pacing controls and stop rules:
- max calls/minute
- do-not-call suppression
- quiet hours by timezone

---

## 5) Meeting scheduling design

### Target workflow (matching your Call 1 / Call 2 process)

1. During Call 1, salesperson clicks **Book meeting**.
2. API creates `meeting` linked to lead (`lead_id`, `scheduled_at`, type=`discovery|closing`).
3. Transactionally create default reminders, e.g.:
   - 24h before
   - 1h before
4. Lead stage auto-transitions to `meeting_booked`.
5. Dashboard shows upcoming meetings and reminders.
6. After meeting, salesperson logs outcome:
   - `qualified` → create closing call task
   - `not_interested` → lead lost
   - `needs_followup` → reminder N days out

### API proposal
- `POST /meetings` create + auto reminders
- `GET /meetings?from=...&to=...&owner=...`
- `PATCH /meetings/{id}` reschedule/cancel/outcome
- `POST /meetings/{id}/complete`

### Reminder automation rules
Create reminders with templates:
- `meeting_prep` (T-24h)
- `meeting_now` (T-15m)
- `meeting_followup` (T+1d if no outcome)

---

## 6) Call recording integration suggestions (Twilio roadmap)

### A. Callback-first architecture
Implement and persist these Twilio events:
- call status callback (`initiated`, `ringing`, `answered`, `completed`, `busy`, etc.)
- recording status callback (`in-progress`, `completed`, `failed`)

### B. Recording persistence strategy
Store in `call_recordings` table:
- `call_id`
- `twilio_recording_sid`
- `media_url`
- `duration`
- `storage_provider_url` (if copied to S3)
- retention/deletion timestamps

### C. Transcript + AI summarization pipeline
Asynchronous pipeline:
1. recording completed webhook
2. enqueue transcription job
3. store transcript segments/speaker labels
4. run summarization/classification (meeting booked? objection types?)
5. write structured outputs to `call_ai_insights`

### D. Compliance and security
- Explicit consent prompts for recording (jurisdiction aware)
- Encrypt recordings at rest
- Signed URL access only
- Retention policy and delete jobs

---

## 7) Bug detection (high-value findings)

### 1. Missing/placeholder Twilio callback handlers
`/api/calls/webhook` and `/api/calls/status-callback` return static `{status: "ok"}` and do not update call rows.

Impact: call status, duration, and final outcomes will be stale.

### 2. TwilioService references endpoints not implemented
TwilioService sends callbacks to `/api/calls/recording-callback` and `/api/calls/dial-complete/{lead_id}`, but these routes do not exist in `main.py`.

Impact: 404 callbacks, no recording metadata persistence.

### 3. Dialer crash risk when queue contains missing lead
`dialer_next` fetches lead and directly accesses `lead.phone` without null check.

Impact: server error if lead deleted after session start.

### 4. In-memory dialer state is not multi-instance safe
`dialer_state` global dict will reset on restart and diverge across Railway replicas.

Impact: unstable dialer behavior, data loss in active sessions.

### 5. API/frontend auth mismatch
Frontend API contains `login` call to `/api/auth/login`, but app currently bypasses login and backend has no such route in main app.

Impact: dead code/confusing auth behavior; future auth rollout risk.

### 6. Hardcoded production API URL in frontend
`BASE` is fixed to Railway production URL.

Impact: local/staging development friction and accidental prod coupling.

### 7. Date-only reminder model weak for meeting scheduling
Reminder schema stores only `due_date` (no time), while meetings require precise datetime reminders.

Impact: inability to trigger “1 hour before meeting” reliably.

### 8. No migrations for production schema evolution
Using `create_all` at startup is not enough for controlled database changes.

Impact: risky deployments, inconsistent schema between environments.

---

## Priority implementation plan (90-day pragmatic roadmap)

### Phase 1 (1–2 weeks): Stabilize existing behavior
- Implement Twilio callbacks and update `calls` rows.
- Add null guards + error handling in dialer queue processing.
- Move API base URL to env variable.
- Add Alembic baseline migration.

### Phase 2 (2–4 weeks): Meeting workflow foundation
- Add `meetings` table + CRUD API.
- Auto-create reminders on meeting creation.
- Add dashboard upcoming meetings widget.
- Add lead stage transition rules for Call 1/Call 2 flow.

### Phase 3 (4–8 weeks): Production-grade dialer + AI call pipeline
- Persist dialer sessions/items.
- Add worker queue for callback processing/transcripts.
- Add recording/transcript/summary schema.
- Add compliance, retention, and audit logging.

---

## Suggested KPIs to track once implemented

- Call 1 → meeting booking rate
- Meeting show-up rate
- Call 2 → closed/won rate
- Average time from first call to close
- Reminder completion SLA
- Dialer successful connection rate
- Transcript coverage (% calls with transcript + summary)
