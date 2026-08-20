# Floss Clinic — Dental Clinic Management Platform

Appointment booking with real conflict detection, a staff-managed doctor directory, patient records, and a
RAG chatbot that only ever answers from your clinic's own cited sources. Built as a full-stack portfolio
project: Flask + SQLAlchemy backend, React + Vite frontend.

**Live**: [floss-beta.vercel.app](https://floss-beta.vercel.app) (frontend, Vercel) ·
[floss-backend.onrender.com](https://floss-backend.onrender.com) (API, Render free tier)

**Demo logins** (seeded via `backend/seed.py`): `patient@floss.demo` / `staff@floss.demo` / `admin@floss.demo`,
all with password `password123`.

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

**Patients** register, browse dentists by specialty, book an appointment against real open slots, manage
their own upcoming/past visits, and ask the clinic's assistant questions — hours, policies, "who treats
orthodontics" — with every answer tracing back to a source document.

**Staff/admin** manage the department & dentist directory (including weekly availability windows), see and
cancel any appointment clinic-wide, run a treatment-room/chair occupancy board (seat a patient, check them
out), and curate the knowledge base the assistant draws from.

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

### Grounded, cited chat — not a hallucination machine

`sentence-transformers` (`all-MiniLM-L6-v2`) embeds every uploaded document into 384-dim vectors at ingest
time; retrieval is a brute-force cosine similarity search (a matrix dot-product — no vector DB, because at
portfolio scale a few thousand chunks fit in memory and an external index would be unjustified
infrastructure). Retrieval sits behind a **similarity-confidence threshold**: if nothing retrieved clears
it, the assistant says it doesn't know instead of guessing. Every answer streams token-by-token over SSE and
carries `[1]`, `[2]`-style citations back to the exact source chunk.

The system prompt also draws an explicit line: Floss Clinic is an *operational* assistant (appointments, hours,
policies, directory) and is instructed to refuse anything that reads as a diagnostic or treatment question,
directing the user to book an appointment instead. That instruction is guarded by a test
(`test_system_prompt_refuses_medical_advice`) so it can't silently regress.

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
| **RAG** | sentence-transformers (embeddings), Groq (`llama-3.1-8b-instant`, generation), brute-force cosine retrieval |
| **Frontend** | React 19, Vite, react-router-dom, fetch + ReadableStream SSE (not EventSource — it can't carry auth headers) |
| **Testing** | pytest (112 tests, backend), Vitest + React Testing Library (frontend) |

## Project structure

```
backend/
  app/
    auth/          registration, login/refresh/logout, role_required decorators
    departments/    dental specialty areas (CRUD, staff-only writes)
    doctors/        dentist directory + weekly availability windows
    patients/       self-service profile + staff patient lookup
    appointments/   booking, conflict detection, availability computation
    admissions/     treatment rooms & chairs (ward/bed model, relabeled)
    documents/      knowledge-base uploads + the auto-regenerating directory digest
    chat/           retrieval, citation-grounded generation, SSE streaming
    models.py       User, Department, Doctor, DoctorAvailability, PatientProfile,
                    Appointment, Ward, Bed, Admission, Document, Chunk, Conversation, Message
  migrations/       Alembic, one migration per schema change
  tests/            112 tests across every blueprint + retrieval/generation
  seed.py           demo departments, dentists, rooms/chairs, and login accounts

frontend/
  src/
    pages/          route-level screens (patient + staff), LandingPage.jsx (public)
    components/     AppLayout (role-aware nav), AppointmentCard, chat components
    context/        AuthContext (JWT storage, refresh-on-401)
    hooks/          useChatStream (SSE parsing), useReveal (scroll animations)
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

**Environment variables** (backend, `.env` or shell): `GROQ_API_KEY` (chat generation; without it, chat
degrades gracefully to an "assistant temporarily unavailable" message rather than crashing),
`JWT_SECRET_KEY`, `SECRET_KEY`, `DATABASE_URL` (defaults to a local SQLite file).

## Testing

```bash
cd backend && pytest -q                 # 112 tests
cd frontend && npm test                  # Vitest + React Testing Library
```

Backend coverage includes appointment boundary conditions (exact-duplicate rejection, partial-overlap
rejection, back-to-back acceptance, cancelled-slot rebooking), RBAC edges (403 vs 404), and the
directory-digest regeneration lifecycle. Frontend coverage (34 tests) spans the booking flow end-to-end
(slot selection → confirm → success, and the 409-conflict error path), the public landing page, sign-in
and registration (success, server-rejected input, pending state), the patient/staff dashboards (empty
states, stat calculations, role-specific quick actions), the doctors directory (list, filter, empty
state), and the chat window (message history, citations, streaming state, error display).

Both the public landing page and the authenticated app have a real accessibility pass: skip links,
semantic landmarks, `prefers-reduced-motion` support, keyboard-operable controls (no click-only `<div>`s),
a labeled/focus-managed modal, labeled form inputs, and `aria-live` regions on loading and error states.

## What's not done yet

- **Frontend test coverage** — booking, landing page, sign-in/registration, both dashboards, the doctors
  directory, and the chat window are covered; staff-only management pages (directory editing, treatment
  rooms) aren't yet

## CI

GitHub Actions runs the backend (`pytest`) and frontend (`Vitest` + a production build) test suites on
every push and pull request against `main`. See `.github/workflows/ci.yml`.
