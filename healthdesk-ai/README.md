# HealthDesk AI

HealthDesk AI is an AI-powered front-desk assistant for small clinics. It gives patients a public chat and voice assistant for clinic questions, appointment booking, rescheduling, cancellations, and intake collection. It gives clinic staff a protected dashboard for conversations, appointments, patients, intake forms, analytics, availability, providers, services, FAQs, and clinic settings.

The project is built as a full-stack monorepo with a FastAPI backend, PostgreSQL database, Next.js frontend, JWT authentication, Groq-powered AI responses, browser voice input, email confirmations, reminder emails, and Docker-based local development.

## Current Status

- Backend API is production-ready with FastAPI, SQLAlchemy, Alembic, PostgreSQL, JWT auth, Groq AI, Resend email, and protected clinic routes.
- Frontend is production-ready with Next.js, TypeScript, Tailwind CSS, shadcn-style UI components, Framer Motion, Recharts, Auth.js, light/dark mode, responsive layouts, and polished public/staff pages.
- Patient side and staff side are separated.
- Safety escalation is implemented for emergency language such as chest pain, difficulty breathing, severe bleeding, self-harm, stroke symptoms, and similar high-risk messages.
- Email confirmation and one-hour reminder infrastructure is implemented with Resend.
- Deployment support is included for Vercel, Render, Neon, Groq, and Resend.

## Product Functions

### Patient Assistant

Patients can use the public assistant without creating a staff account.

- Choose the clinic they want to contact.
- Ask clinic questions such as hours, services, insurance, referrals, parking, lab results, and policies.
- Request a new appointment.
- Provide name, email, phone, visit type, preferred date, and preferred time.
- See real available appointment slots from the backend.
- Choose a slot and book directly through the assistant.
- Look up upcoming appointments by email.
- Request appointment rescheduling.
- Use browser voice input and hear safe responses through speech synthesis.
- Trigger emergency escalation if the message includes urgent medical risk language.

### Staff Dashboard

Clinic staff can sign in and manage the operational side of the clinic.

- View total conversations, booked appointments, active escalations, pending intake forms, rescheduled visits, and cancelled visits.
- View charts for inquiries by day, appointment status, peak inquiry hours, and common question categories.
- Review patient conversations with channel, urgency, category, status, summary, and message count.
- Open full conversation transcripts.
- Generate AI staff summaries.
- Add staff notes to conversations.
- Manage appointments, including create, reschedule, and cancel.
- View appointment slots in clinic timezone.
- Search and manage patients.
- Open patient detail pages with appointments, conversations, intake forms, and quick stats.
- Review intake forms and missing fields.
- Manage clinic profile, providers, services, FAQs, opening hours, and availability slots.

### Appointment Workflow

1. Patient selects a clinic on `/chat`.
2. Patient asks to book or reschedule an appointment.
3. Assistant asks for required details if missing: name, email, phone, visit type, preferred date/time.
4. Backend checks real open slots for the selected clinic.
5. Assistant shows available times.
6. Patient chooses a slot.
7. Backend creates or updates the patient record.
8. Backend books or reschedules the appointment.
9. Slot is marked booked.
10. Staff dashboard updates from the same database.
11. Confirmation email is sent to the patient when Resend is configured.
12. Reminder scheduler sends a reminder email around one hour before the appointment.

### Safety Workflow

The assistant does not provide medical advice, diagnosis, treatment recommendations, or emergency medical guidance.

If a patient mentions an urgent trigger such as chest pain, trouble breathing, severe bleeding, stroke symptoms, loss of consciousness, self-harm, or similar risk:

- The backend detects the trigger before the LLM response.
- The assistant directs the patient to call emergency services or go to the nearest emergency room.
- The conversation urgency becomes `emergency`.
- An escalation record is written to the database.
- Staff can see the escalation in the dashboard.
- An escalation alert email is sent to clinic admins when Resend is configured.

## Design System

HealthDesk AI uses a clean healthcare SaaS design language with calm colors, rounded cards, readable spacing, and strong light/dark contrast.

### Brand Colors

| Token | Hex | Usage |
|---|---:|---|
| Page background | `#F8FAFC` | Main light background |
| Alternate section | `#F0FDFA` | Soft teal public sections and assistant panels |
| Card background | `#FFFFFF` | Light mode cards |
| Primary teal | `#0F766E` | Primary actions, links, highlights |
| Teal hover | `#0D9488` | Button hover states |
| Text dark | `#0F172A` | Headings and important text |
| Body text | `#1E293B` | Main body copy |
| Muted text | `#64748B` | Helper text, timestamps, secondary labels |
| Border | `#E2E8F0` | Cards, dividers, controls |
| Blue | `#2563EB` | Charts and secondary accents |
| Purple | `#7C3AED` | Intake/highlight accents |
| Success | `#10B981` | Success states |
| Warning | `#F59E0B` | Missing fields and reschedule states |
| Danger | `#EF4444` | Emergency escalation and cancellation only |

### Visual Style

- Font: Inter through Next.js font loading.
- Cards: rounded-2xl, subtle border, soft shadow.
- Buttons: rounded-xl with clear hover states.
- Inputs: rounded-xl with visible borders and strong dark/light contrast.
- Dropdowns, date pickers, and time pickers: custom rounded healthcare-style controls.
- Motion: Framer Motion fade-up, staggered cards, count-up metric cards, and voice orb pulse states.
- Charts: Recharts with teal, blue, purple, warning, success, and danger colors.
- Light and dark modes are supported with readable text and status badges.
- Layout uses centered content with responsive max-widths so screens do not feel empty or overly stretched.

## Pages

### Public Pages

| Route | Purpose |
|---|---|
| `/` | Landing page with hero, social proof, features, workflow, clinic-fit section, safety section, testimonial, CTA, and footer |
| `/chat` | Public patient assistant with clinic selector, chat tab, voice assistant tab, appointment booking, appointment lookup, and rescheduling support |
| `/login` | Staff sign-in with credentials and Google OAuth support |
| `/signup` | Staff account and clinic workspace creation |

### Protected Staff Pages

| Route | Purpose |
|---|---|
| `/dashboard` | Metrics, charts, welcome banner, and clinic overview |
| `/conversations` | Searchable/filterable staff conversation queue |
| `/conversations/[id]` | Full transcript, metadata, AI summary, emergency alert, and staff notes |
| `/appointments` | Appointment table, filters, creation, reschedule, cancellation, and slot selection |
| `/patients` | Patient search/list and add patient workflow |
| `/patients/[id]` | Patient detail with appointments, conversations, intake forms, and quick stats |
| `/intake` | Intake form review with missing-field alerts and AI extraction |
| `/settings` | Clinic profile, providers, services, availability, FAQs, opening hours, and email notification settings |

## Backend API

Base URL locally:

```text
http://localhost:8000/api/v1
```

### Health

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health check |
| `GET` | `/api/v1` | API root message |

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Create clinic and staff user, return JWT |
| `POST` | `/api/v1/auth/login` | Staff login, return JWT |
| `POST` | `/api/v1/auth/google` | Verify Google ID token and create/update user |
| `GET` | `/api/v1/auth/me` | Return authenticated user and clinic |
| `POST` | `/api/v1/auth/logout` | Client-side logout acknowledgement |

### AI And Public Assistant

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/ai/chat` | Main assistant chat endpoint with safety, context, booking logic, and rate limiting |
| `POST` | `/api/v1/ai/appointment-request` | Manual appointment request intake into assistant workflow |
| `GET` | `/api/v1/ai/public-clinic` | Return primary public clinic |
| `GET` | `/api/v1/ai/public-clinics` | Return selectable public clinics with setup counts |
| `GET` | `/api/v1/ai/demo-clinic` | Legacy compatibility endpoint |
| `POST` | `/api/v1/ai/voice/transcript` | Voice transcript alias for assistant chat |
| `POST` | `/api/v1/ai/summarize` | Summarize a conversation |
| `POST` | `/api/v1/ai/classify-intent` | Classify user intent |
| `POST` | `/api/v1/ai/extract-intake` | Extract structured intake fields |

### Conversations

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/conversations` | List clinic conversations |
| `POST` | `/api/v1/conversations` | Create staff conversation |
| `GET` | `/api/v1/conversations/{id}` | Get conversation with messages |
| `POST` | `/api/v1/conversations/{id}/message` | Add staff message |
| `POST` | `/api/v1/conversations/{id}/summarize` | Generate and save AI summary |

### Appointments And Slots

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/appointments` | List appointments with patient/provider/service joins |
| `GET` | `/api/v1/appointments/lookup` | Public lookup by patient email and clinic |
| `POST` | `/api/v1/appointments` | Create staff appointment and mark slot booked |
| `PATCH` | `/api/v1/appointments/{id}/reschedule` | Reschedule appointment and update slots |
| `PATCH` | `/api/v1/appointments/{id}/cancel` | Cancel appointment and reopen slot |
| `GET` | `/api/v1/appointment-slots` | List open slots |
| `POST` | `/api/v1/appointment-slots` | Create clinic slot |

### Patients And Intake

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/patients` | Search/filter paginated patients |
| `POST` | `/api/v1/patients` | Create patient |
| `GET` | `/api/v1/patients/{id}` | Patient detail with appointments, conversations, and intake forms |
| `PATCH` | `/api/v1/patients/{id}` | Update patient |
| `GET` | `/api/v1/intake-forms` | List intake forms for clinic |

### Analytics

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/analytics/overview` | Main dashboard metrics |
| `GET` | `/api/v1/analytics/inquiries-by-day` | Last 30 days conversation volume |
| `GET` | `/api/v1/analytics/appointment-status` | Appointment status counts |
| `GET` | `/api/v1/analytics/common-questions` | Top conversation categories |
| `GET` | `/api/v1/analytics/peak-hours` | Conversation volume by hour |

### Clinic Settings

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/clinics/me` | Current user's clinic |
| `PATCH` | `/api/v1/clinics/me` | Update clinic profile, hours, and notification settings |
| `GET` | `/api/v1/providers` | List providers |
| `POST` | `/api/v1/providers` | Add provider |
| `PATCH` | `/api/v1/providers/{id}` | Update provider |
| `DELETE` | `/api/v1/providers/{id}` | Soft-delete provider |
| `GET` | `/api/v1/services` | List services |
| `POST` | `/api/v1/services` | Add service |
| `PATCH` | `/api/v1/services/{id}` | Update service |
| `DELETE` | `/api/v1/services/{id}` | Soft-delete service |
| `GET` | `/api/v1/faqs` | List FAQs |
| `POST` | `/api/v1/faqs` | Add FAQ |
| `PATCH` | `/api/v1/faqs/{id}` | Update FAQ |
| `DELETE` | `/api/v1/faqs/{id}` | Delete FAQ |

## Database

The backend uses PostgreSQL with SQLAlchemy ORM and Alembic migrations.

Core tables:

1. `users`
2. `clinics`
3. `providers`
4. `services`
5. `patients`
6. `appointment_slots`
7. `appointments`
8. `conversations`
9. `messages`
10. `intake_forms`
11. `faqs`
12. `escalations`

Additional appointment/email fields are managed through migrations for confirmation and reminder tracking.

## AI Layer

HealthDesk AI uses Groq with `openai/gpt-oss-20b` by default.

AI service responsibilities:

- Generate JSON-only assistant responses.
- Classify intent.
- Summarize conversations for staff.
- Extract intake fields.
- Use clinic context, providers, services, FAQs, hours, and slots.
- Avoid medical advice.
- Respect safety escalation rules.

Supported intents:

- `book_appointment`
- `reschedule_appointment`
- `cancel_appointment`
- `clinic_faq`
- `insurance_question`
- `new_patient_intake`
- `urgent_escalation`
- `appointment_lookup`
- `general_question`
- `unknown`

## Email Notifications

Email is handled through Resend.

Implemented email flows:

- Appointment confirmation email to the patient after booking.
- Appointment reminder email roughly one hour before the appointment.
- Emergency escalation email to clinic admin/staff when urgent safety language is detected.

Required backend environment variables:

```env
RESEND_API_KEY=your_resend_key
RESEND_FROM_EMAIL=onboarding@resend.dev
```

For production, use a verified sender/domain in Resend instead of the default onboarding address.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4, custom UI components, shadcn-style primitives |
| Motion | Framer Motion |
| Charts | Recharts |
| Auth UI | Auth.js / NextAuth |
| HTTP Client | Axios |
| Backend | FastAPI, Python 3.11 |
| ORM | SQLAlchemy |
| Validation | Pydantic v2 |
| Database | PostgreSQL |
| Migrations | Alembic |
| AI | Groq / LLaMA 3.1 Instant |
| Email | Resend |
| Auth | JWT with python-jose, bcrypt password hashing |
| Rate Limiting | slowapi |
| Deployment | Docker, Render, Vercel, Neon |

## Monorepo Structure

```text
healthdesk-ai/
  backend/
    app/
      core/
      migrations/
      models/
      routes/
      schemas/
      services/
      main.py
      seed.py
      seed_clinic_setup.py
    alembic.ini
    Dockerfile
    requirements.txt
  frontend/
    src/
      app/
      components/
      hooks/
      lib/
      types/
    package.json
    vercel.json
  docker-compose.yml
  README.md
```

## Environment Variables

### Backend

Create `backend/.env` from `backend/.env.example`.

```env
DATABASE_URL=postgresql://healthdesk:healthdesk@localhost:5432/healthdesk
JWT_SECRET_KEY=replace_with_secure_secret_min_32_chars
OPENAI_API_KEY=
GROQ_API_KEY=replace_with_groq_key
LLM_PROVIDER=groq
LLM_MODEL=openai/gpt-oss-20b
GOOGLE_CLIENT_ID=replace_with_google_client_id
RESEND_API_KEY=
RESEND_FROM_EMAIL=onboarding@resend.dev
FRONTEND_URL=http://localhost:3000
ENVIRONMENT=development
```

### Frontend

Create `frontend/.env.local` from `frontend/.env.example`.

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
BACKEND_API_URL=http://localhost:8000/api/v1
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace_with_secure_secret
GOOGLE_CLIENT_ID=replace_with_google_client_id
GOOGLE_CLIENT_SECRET=replace_with_google_client_secret
```

## Local Development

### Option 1: Docker Full Stack

From the project root:

```powershell
cd "D:\ASU One Drive\OneDrive - Arizona State University\Documents\New project\healthdesk-ai"
docker compose up --build
```

Open:

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:8000/health`
- Backend API root: `http://localhost:8000/api/v1`

Run migrations:

```powershell
docker compose run --rm backend alembic upgrade head
```

Seed base data:

```powershell
docker compose run --rm backend python -m app.seed
```

Seed or complete a specific clinic:

```powershell
docker compose run --rm `
  -e TARGET_CLINIC_NAME="Jeet Patel's Clinic" `
  backend python -m app.seed_clinic_setup
```

### Option 2: Backend And Frontend Separately

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

## Useful Commands

Run frontend production build:

```powershell
cd frontend
npm run build
```

Run backend tests:

```powershell
cd backend
pytest
```

Stop local Docker services:

```powershell
docker compose down
```

Rebuild backend only:

```powershell
docker compose build backend
```

Apply migrations to a hosted database through Docker:

```powershell
docker compose run --rm --no-deps `
  -e DATABASE_URL="YOUR_HOSTED_DATABASE_URL" `
  backend alembic upgrade head
```

Seed a hosted database through Docker:

```powershell
docker compose run --rm --no-deps `
  -e DATABASE_URL="YOUR_HOSTED_DATABASE_URL" `
  backend python -m app.seed
```

Complete a hosted clinic setup:

```powershell
docker compose run --rm --no-deps `
  -e DATABASE_URL="YOUR_HOSTED_DATABASE_URL" `
  -e TARGET_CLINIC_NAME="Jeet Patel's Clinic" `
  backend python -m app.seed_clinic_setup
```

## Deployment

### Backend On Render

Recommended service type: Web Service using Docker.

Settings:

- Root directory: `healthdesk-ai/backend` if deploying from the repository root that contains `healthdesk-ai`
- Root directory: `backend` if the repository root is the `healthdesk-ai` folder
- Environment: Docker
- Health check path: `/health`

Required environment variables:

```env
DATABASE_URL=your_neon_or_render_postgres_url
JWT_SECRET_KEY=generate_with_openssl_rand_hex_32
GROQ_API_KEY=your_groq_api_key
LLM_PROVIDER=groq
LLM_MODEL=openai/gpt-oss-20b
GOOGLE_CLIENT_ID=your_google_client_id
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=your_verified_resend_sender
FRONTEND_URL=https://your-vercel-app.vercel.app
ENVIRONMENT=production
```

After first deploy, run:

```bash
alembic upgrade head
python -m app.seed
```

### Database On Neon

1. Create a Neon PostgreSQL project.
2. Copy the pooled or direct connection string.
3. Use the connection string as `DATABASE_URL` in Render.
4. Run Alembic migrations against Neon.
5. Run seed scripts against Neon if needed.

### Frontend On Vercel

Settings:

- Root directory: `healthdesk-ai/frontend` if deploying from the repository root that contains `healthdesk-ai`
- Root directory: `frontend` if the repository root is the `healthdesk-ai` folder
- Framework: Next.js
- Build command: `npm run build`
- Output directory: `.next`

Required environment variables:

```env
NEXT_PUBLIC_API_URL=https://your-render-backend.onrender.com/api/v1
BACKEND_API_URL=https://your-render-backend.onrender.com/api/v1
NEXTAUTH_URL=https://your-vercel-app.vercel.app
NEXTAUTH_SECRET=generate_with_openssl_rand_hex_32
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Google OAuth

In Google Cloud Console, configure:

- Authorized JavaScript origin: `https://your-vercel-app.vercel.app`
- Authorized redirect URI: `https://your-vercel-app.vercel.app/api/auth/callback/google`

The same Google client ID must be present in:

- Frontend Vercel env as `GOOGLE_CLIENT_ID`
- Backend Render env as `GOOGLE_CLIENT_ID`

The Google client secret is only needed on the frontend server side through Auth.js.

## Security And Privacy Notes

- Passwords are hashed with bcrypt.
- JWT tokens include user id, email, clinic id, role, and expiration.
- Protected staff routes require Bearer token authentication.
- CORS supports comma-separated frontend origins through `FRONTEND_URL`.
- AI chat is rate-limited.
- The assistant does not provide medical advice.
- API keys and database URLs must never be committed.
- Patient-facing appointment lookup uses email and clinic context rather than staff credentials.

## Production Readiness Checklist

Backend:

- `GET /health` returns `200 OK`.
- `alembic upgrade head` completes.
- `python -m app.seed` completes if base sample data is needed.
- `python -m app.seed_clinic_setup` completes for each real clinic that needs starter providers, services, FAQs, and slots.
- Groq key is configured.
- Resend key and verified sender are configured.
- Google client ID is configured if Google sign-in is enabled.
- `FRONTEND_URL` matches the deployed Vercel URL.

Frontend:

- `npm run build` passes.
- `NEXT_PUBLIC_API_URL` points to the Render backend `/api/v1`.
- `BACKEND_API_URL` points to the same backend `/api/v1`.
- `NEXTAUTH_URL` matches the deployed Vercel URL exactly.
- Google redirect URI matches the Vercel callback URL.
- Login, signup, dashboard, chat, appointments, patients, settings, and dark mode are tested.

Patient flow:

- Clinic selector loads clinics.
- Chat answers FAQ questions.
- Assistant asks for name, email, phone, visit type, and preferred date/time when booking.
- Available slots show.
- Booking updates staff dashboard.
- Appointment confirmation email sends when Resend is configured.
- Reminder email sends around one hour before appointment.
- Emergency phrases create escalation records.

Staff flow:

- Staff can log in.
- Dashboard metrics load.
- Charts render.
- Conversations list and detail pages load.
- Appointment create/reschedule/cancel works.
- Patients search and details work.
- Settings CRUD works for providers, services, FAQs, hours, and availability.

## Safety Disclaimer

HealthDesk AI does not provide medical advice, diagnosis, or treatment guidance. It supports scheduling, clinic information, intake collection, administrative workflows, staff summaries, and escalation routing. Patients with emergency symptoms should call emergency services or go to the nearest emergency room immediately.
