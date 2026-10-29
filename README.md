# Floss Clinic — Dental Clinic Management Platform

[![CI](https://github.com/DondieGatan/floss/actions/workflows/ci.yml/badge.svg)](https://github.com/DondieGatan/floss/actions/workflows/ci.yml)

Appointment booking with real conflict detection, a staff-managed doctor directory, patient records, and a
RAG chatbot that cites its answers when they come from your clinic's own documents and falls back to
general dental knowledge — clearly uncited — when they don't. Built as a full-stack portfolio project:
Flask + SQLAlchemy backend, React + Vite frontend.

[![Floss Clinic](https://dondiegatan.github.io/dondiegatan-portfolio/assets/covers/floss-clinic.webp)](https://dondiegatan.github.io/dondiegatan-portfolio/projects.html#floss-clinic)

**Live**: [floss-beta.vercel.app](https://floss-beta.vercel.app) (frontend, Vercel) ·
[floss-backend.onrender.com](https://floss-backend.onrender.com) (API, Render free tier) ·
[Demo video on my portfolio](https://dondiegatan.github.io/dondiegatan-portfolio/projects.html#floss-clinic) · built by
[Dondie Godwin Gatan](https://dondiegatan.github.io/dondiegatan-portfolio/)

**Try it in a minute:** open the live app and sign in as the demo patient, `patient@floss.demo` / `password123`
(or create your own account from *Sign up*). Browse the dentists, pick one, choose a date on a weekday, and book a
slot. Try booking the same slot again to see the conflict check reject it, then reschedule or cancel from the
dashboard. The chat button in the corner opens the clinic assistant.

**Other demo logins** (seeded via `backend/seed.py`, same password): `staff@floss.demo` and `admin@floss.demo`.
Staff and admin roles require **two-factor authentication**, so those accounts need an authenticator app (or the
emailed one-time code) before they can sign in. The patient account has no two-factor step, which makes it the easy
way in.

> The backend is on Render's free tier, which spins down after inactivity — the first request after a while
> can take up to ~50s to wake it back up. The frontend surfaces a "waking up the server" notice on sign-in/
> sign-up if that first request runs long, rather than leaving it looking hung.

---

## Why this project exists

Floss Clinic started as [Footnote](#), a document-upload RAG chatbot, then evolved into a full hospital
management system ("Rounds"), then a dental clinic. The chatbot — retrieval-augmented generation with
citation grounding — is the part that doesn't come for free with a CRUD tutorial; everything else
(appointments, directory, records, RBAC) exists to give that assistant something real to answer questions
about.

## What it does

**Patients** register, browse dentists by specialty, book an appointment against real open slots, and manage
their care entirely from the dashboard — cancel or reschedule any upcoming appointment (including switching
to a different dentist, not just a different time), with a separate read-only History page for past visits.
They can also ask the clinic's assistant questions — hours, policies, "who treats orthodontics," or general
dental questions — with clinic-specific answers cited back to the exact document and general-knowledge
answers clearly left uncited.

**Staff/admin** manage the department & dentist directory (photos, bios, weekly availability windows), see,
cancel, or reschedule any appointment clinic-wide, check a Schedule page showing every dentist's open and
booked slots for a given day at a glance, run a treatment-room/chair occupancy board (seat a patient, check
them out), curate the knowledge base the assistant draws from, and (owner/admin) grant or revoke staff/admin
access through an audited Team & Roles console.

## Under the hood

A few of the decisions worth calling out, because they're the parts a tutorial wouldn't have made you solve:

### Conflict-safe appointment booking

Booking checks two things before it inserts a row: the requested window fits inside one of the dentist's
published `DoctorAvailability` windows, and it doesn't overlap an existing appointment — using a **half-open
interval check** (`existing.start < requestedEnd AND requestedStart < existing.end`) so back-to-back
appointments are allowed but genuine overlaps are rejected. The boundary condition (`<` vs `<=`) is the
easiest thing to get backwards here, and it's covered explicitly in `test_appointments.py`.

That check-then-insert has a narrow race window under real concurrency. A global "always `BEGIN IMMEDIATE`"
SQLite transaction hook was built to close it — and then **reverted**, because it broke ordinary
multi-statement SQLAlchemy operations (`db.create_all()`, Alembic's batch migrations) app-wide. Destabilizing
schema management to close a narrow, low-probability race was a worse trade than the race itself at this
app's scale. What actually shipped is a **partial unique index**:

```python
# app/models.py
db.Index(
    "uq_appointments_doctor_start_active",
    "doctor_id", "scheduled_start",
    unique=True,
    sqlite_where=db.text("status != 'cancelled'"),
)
```

Partial, not a blanket constraint — a cancelled appointment has to free its slot for rebooking, and a plain
unique constraint can't tell a cancelled row from a live one. This is a real DB-enforced guarantee against
the realistic failure mode (double-submit), with the narrower theoretical race documented as an accepted,
scale-appropriate limitation rather than silently missing.

### Cited when grounded, honest when it isn't

`all-MiniLM-L6-v2` embeds every uploaded document into 384-dim vectors at ingest time, called remotely
through Hugging Face's Inference API (`app/ml.py`) rather than run in-process — `torch` + `transformers`'
baseline memory footprint alone doesn't fit alongside the rest of the app on a 512MB instance, confirmed the
hard way via Render's own memory metrics. Retrieval is a brute-force cosine similarity search (a matrix
dot-product — no vector DB, because at portfolio scale a few thousand chunks fit in memory and an external
index would be unjustified infrastructure). Retrieval sits behind a **similarity-confidence threshold**:
below it, the retrieved chunk is dropped from the prompt entirely rather than handed to the model as if it
were an authoritative source.

**If the embedding service is unavailable** (no Hugging Face credits, an outage, a missing token), the chat
does not fail: ingestion still stores the chunks (without vectors) and a question falls back to **keyword
retrieval** (`app/chat/keyword_search.py` — the idf-weighted share of the question's words found in each
chunk, with its own confidence bar). Run `reembed_chunks.py` once the service is back to restore semantic
search. Guarded by `tests/test_keyword_fallback.py`.

The model (Google Gemini) is still consulted either way — it isn't gated behind retrieval succeeding. The
system prompt draws the actual line: an answer grounded in a retrieved passage gets bracketed `[1]`/`[2]`
citations back to the exact source chunk; a question that's on-topic but has no matching document gets
answered from the model's own general dental knowledge instead, with **no citation**, so a reader can never
mistake general knowledge for something the clinic's own materials actually said; a question with nothing
to do with dentistry gets a plain decline. Every answer streams token-by-token over SSE.

The system prompt also draws a second, unrelated line: Floss Clinic is an *operational* assistant
(appointments, hours, policies, directory, general dental education) and is instructed to refuse anything
that reads as diagnosing this specific patient's symptoms or recommending their treatment, directing them to
book an appointment instead. Both lines are guarded by tests (`test_system_prompt_refuses_medical_advice`,
`test_system_prompt_allows_general_dental_knowledge_uncited`,
`test_system_prompt_declines_fully_unrelated_questions`) so neither can silently regress.

**It answers questions about the app itself, and has guardrails that don't depend on the model behaving.**
The assistant carries a short, reviewed guide to the app (`app/chat/system_guide.py`: pages, what each role can
do, how booking and the assistant work), so "how do I reschedule?" or "what can staff do?" is answered from facts,
tailored to the asker's role, instead of being refused as off-topic. How the system is secured is deliberately
off-limits, and that is enforced in code (`app/chat/guardrails.py`), not just asked of the model: unambiguous
attempts to probe security, extract the assistant's instructions, or reach other people's data get a fixed reply
and never reach the model; an output guard cuts off a reply that would contain a key, token, database URL or the
prompt itself before it is shown; messages are length-capped; and the booking assistant uses the same screen.
Tests cover both directions: the blocked phrasings, a list of ordinary questions that must *not* be blocked, a
check that the guide stays in step with the real sidebar pages, and that it says nothing about how security works.

### A booking assistant that proposes — a person decides

Switch on **"Let the assistant help me book"** in the chat and the assistant can book, move or cancel a
patient's own appointments from plain language ("Dr. Chen next Monday around 10, it's a check-up"). Under the
hood it's a tool-calling loop (`app/agent/`): the model looks up dentists, checks open slots, and proposes a
change; it never writes anything itself.

- **It can only propose.** `propose_booking` / `propose_reschedule` / `propose_cancel` validate the request
  against the same availability and overlap rules as the booking form, then store an `AgentAction`. The chat
  shows a card — *"Book Dr. Liam Chen on Monday, November 02 at 10:00 AM"* — and **nothing changes until the
  patient presses Confirm.** Confirm re-runs every check at that moment (the slot may have been taken since),
  and an unanswered request expires after 15 minutes.
- **Identity comes from the login token, never the model.** No tool takes a patient id; another patient's
  appointment is as unreachable as one that doesn't exist (the same 404-style idiom as the rest of the app).
- **Bad calls are recoverable, not fatal.** A wrong id, a past time or a taken slot comes back to the model as
  an error it can fix; the loop is capped at six rounds and withholds the tools on the last one, so it always
  ends in words. A model outage is a clean 502 that stores nothing.
- **Hostile text stays data.** A patient's free-text note is logged if it looks like a prompt injection and
  is fenced as data in the system prompt; confirmed changes are written to the audit log.
- **Built for free-tier limits.** The loop speaks one neutral transcript format, with adapters for **Gemini**,
  **Groq** (OpenAI-compatible) and **Azure OpenAI**. Every configured provider is tried in order: one that is
  rate-limited or overloaded is skipped for the time it asked for (or a minute) and the next takes over, so a
  free tier running out doesn't end the chat. The plain Q&A chat uses the same idea: Gemini flash, then flash-lite, then Groq, so one model's daily quota running out doesn't take the assistant down. A limit that clears in seconds (Groq's free tier meters 8,000 tokens a
  minute) is waited out inside the request, up to 24 seconds, instead of failing it; earlier chat sent to the model
  is capped (6 messages, 400 characters each) to stay inside those budgets. If *all* of them are out of capacity the patient gets a plain
  "the assistant is busy" notice with a button to the normal booking page (which uses no model, so it always
  works), their message goes back in the box, and nothing is stored. A real outage or a bad key is kept
  distinct from "busy". With no provider configured, booking mode is simply off, and the regular cited chat
  is untouched either way. Normal Q&A (hours, insurance, dental education) keeps its citations because
  booking is an explicit mode, not a replacement for the retrieval path.

The tests drive the loop with a scripted fake model, so every rule above is checked with no API key and no
network — including the ones that matter most (a proposal creates no appointment; a confirm re-checks the
slot; another patient can't resolve your request). The Gemini path was also exercised end to end against the
real API and in the browser.

### An auto-updating knowledge base, not a stale one

Staff don't maintain two sources of truth. Creating, updating, or deactivating a department/dentist/
availability window synchronously regenerates a system-owned "Dentist & Department Directory" document —
rendered to plain text and pushed through the *same* chunk → embed → persist pipeline used for uploaded
files. The chatbot cites it exactly like any other document ("According to the Dentist Directory[1]...").

### Role-based access, not bolted on

`User.role` (`patient` / `staff` / `admin`) rides as a signed JWT claim, refreshed from the DB on token
refresh so a role change takes effect on next login, not never. A deliberate, documented convention splits
two failure modes that look similar but mean different things: **403** for "you don't have this role" vs.
the existing **404** idiom for "this isn't your resource" (ownership mismatches). Both patterns coexist
across the same route set on purpose.

## Tech stack

| | |
|---|---|
| **Backend** | Flask (app-factory + blueprints), SQLAlchemy, Alembic, Flask-JWT-Extended, Flask-Limiter, SQLite |
| **RAG** | Hugging Face Inference API (`all-MiniLM-L6-v2` embeddings, called remotely), Google Gemini (`gemini-2.5-flash`, generation), brute-force cosine retrieval |
| **Agent** | Tool-calling booking assistant (propose → confirm); Gemini, Groq or Azure OpenAI behind one adapter interface, with rate-limit failover |
| **Frontend** | React 19, Vite, react-router-dom, fetch + ReadableStream SSE (not EventSource — it can't carry auth headers) |
| **Testing** | pytest (443 tests, backend), Vitest + React Testing Library (143 tests, frontend) |

## Project structure

```
backend/
  app/
    auth/          registration, login/refresh/logout, role_required decorators
    departments/    dental specialty areas (CRUD, staff-only writes)
    doctors/        dentist directory + weekly availability windows
    patients/       self-service profile + staff patient lookup
    appointments/   booking, cancel/reschedule (time and/or dentist), conflict detection, availability computation
    admissions/     treatment rooms & chairs (ward/bed model, relabeled)
    documents/      knowledge-base uploads + the auto-regenerating directory digest
    chat/           retrieval, citation-grounded generation, SSE streaming
    internal/       endpoints for the platform's own scheduled jobs (reminders), bearer-secret guarded
    agent/          booking assistant: tool-calling loop, propose/confirm actions, Gemini/Groq/Azure adapters + failover
    users/          Team & Roles — grant/revoke staff/admin/owner access, audit log
    models.py       User, Department, Doctor, DoctorAvailability, PatientProfile,
                    Appointment, Ward, Bed, Admission, Document, Chunk, Conversation, Message, AuditLog, AgentAction
  migrations/       Alembic, one migration per schema change
  tests/            443 tests across every blueprint + retrieval/generation + the booking agent
  api/index.py      Vercel serverless entrypoint (the same create_app() as everywhere else)
  seed.py           demo departments, dentists, rooms/chairs, and login accounts

frontend/
  src/
    pages/          route-level screens (patient + staff), LandingPage.jsx (public)
    components/     AppLayout (role-aware nav), AppointmentCard, RescheduleModal, chat components
    context/        AuthContext (JWT storage, refresh-on-401)
    hooks/          useChatStream (SSE parsing), useBookingAssistant (booking mode + confirm cards), useReveal
    api/client.js   fetch wrapper with automatic access-token refresh
```

## Running it locally

**Backend**
```bash
cd backend
python -m venv venv && venv/Scripts/activate   # or source venv/bin/activate
pip install -r requirements.txt
flask db upgrade
python seed.py
python run.py        # http://localhost:5101
```

**Frontend**
```bash
cd frontend
npm install
npm run dev           # http://localhost:5173
```

**Environment variables** (backend, `.env` or shell): `GEMINI_API_KEY` (chat generation; without it, chat
degrades gracefully to an "assistant temporarily unavailable" message rather than crashing), `HF_TOKEN`
(embeddings via Hugging Face's Inference API; without it, or when its credits run out, chat falls back to keyword retrieval),
`JWT_SECRET_KEY`, `SECRET_KEY`, `DATABASE_URL` (defaults to a local SQLite file). The booking assistant uses `GEMINI_API_KEY` and, as a free fallback when Gemini's limit is
reached, `GROQ_API_KEY` (a free key from console.groq.com; `GROQ_MODEL` overrides the default, `openai/gpt-oss-120b`).
`GEMINI_FALLBACK_MODELS` (default `gemini-2.5-flash-lite`, comma-separated, empty to disable) adds Gemini models that are
tried last, since each model has its own free daily quota.
Optionally `AZURE_OPENAI_ENDPOINT` + `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_DEPLOYMENT` (a function-calling chat
deployment). Every configured provider is tried in the order azure, gemini, groq (then the extra Gemini models); `AGENT_PROVIDER=gemini|groq|azure`
forces one. With none, booking mode is off and the rest of the app is unaffected.

## Deploying (Vercel + Neon: free, never sleeps)

The backend runs as a Vercel Python function (`backend/api/index.py`) and the database is Neon Postgres, so
there is no instance that spins down for hours, no monthly hour cap, and nothing that expires. (`render.yaml`
still works as an always-on alternative.) The first request after a quiet spell is a second or two slower while
Neon wakes; `pool_pre_ping` makes that request succeed instead of failing on a dead connection.

1. **Database.** In Neon, copy the **pooled** connection string (the host contains `-pooler`) for `DATABASE_URL`.
   Apply migrations once from your machine with the **direct** string (same host without `-pooler`):
   `cd backend && DATABASE_URL="<direct string>" flask db upgrade`.
2. **Backend.** In Vercel: *Add New Project* → import this repo → **Root Directory `backend`** → framework
   *Other*. Environment variables: `DATABASE_URL`, `SECRET_KEY`, `JWT_SECRET_KEY`, `CORS_ORIGINS` (the frontend's
   URL), `FRONTEND_URL`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `HF_TOKEN`, `SENDGRID_API_KEY` + `SENDGRID_FROM`, and
   `CRON_SECRET` (any long random string).
3. **Frontend.** In the frontend's Vercel project set `VITE_API_BASE_URL` to `https://<backend>.vercel.app/api`
   and redeploy.
4. **Reminders.** A serverless function can't run a background timer, so appointment reminders are sent by
   `POST /api/internal/send-reminders` (bearer `CRON_SECRET`; safe to call repeatedly because each appointment is
   marked once reminded). `.github/workflows/reminders.yml` calls it every 15 minutes — add the repo secret
   `CRON_SECRET` and the variable `FLOSS_API_URL` — and Vercel Cron calls it daily as a backstop.

What differs on serverless, on purpose: no in-process scheduler; uploads are capped at 4 MB (Vercel rejects a
larger request body before the app sees it); and the rate limiter counts per running instance rather than
globally (point `RATELIMIT_STORAGE_URI` at a Redis to make it global). Appointment times are naive local times and
the function runs in UTC, as the Render deployment always did.

## Testing

```bash
cd backend && pytest -q                 # 443 tests (6 need a funded HF_TOKEN and skip without one)
cd frontend && npm test                  # Vitest + React Testing Library, 143 tests
```

Backend coverage includes appointment boundary conditions (exact-duplicate rejection, partial-overlap
rejection, back-to-back acceptance, cancelled-slot rebooking, and the reschedule endpoint's own edge cases —
moving an appointment to its own current slot must not conflict with itself, moving it to a different
dentist re-validates that dentist's hours and conflicts from scratch), RBAC edges (403 vs 404), and the
directory-digest regeneration lifecycle. Frontend coverage spans the booking and reschedule flows end-to-end
(slot selection → confirm → success, the 409-conflict error path, switching dentists mid-reschedule), the
public landing page, sign-in and registration, the patient/staff dashboards, the doctors directory and
staff-only directory management (including the doctor photo/edit flow), the Schedule availability view, the
Team & Roles console, and the chat window (message history, citations, streaming state, error display).

Both the public landing page and the authenticated app have a real accessibility pass: skip links,
semantic landmarks, `prefers-reduced-motion` support, keyboard-operable controls (no click-only `<div>`s),
a labeled/focus-managed modal, labeled form inputs, and `aria-live` regions on loading and error states.

## What's not done yet

- **Frontend test coverage** — most pages are covered; the appointment History page, and the forgot/reset
  password pages, aren't yet
- **Error monitoring** — production failures currently surface through Render's own logs, not a dedicated
  error tracker

## CI

GitHub Actions runs on every push and pull request against `main`: backend tests (`pytest`), frontend tests
(`Vitest` + a production build), and a dependency vulnerability audit for both `pip` and `npm` (high/critical
only). See `.github/workflows/ci.yml`.
