# HealthDesk AI

AI-powered voice and chat front-desk assistant for small clinics.
Handles appointment scheduling, patient intake, clinic FAQs,
staff analytics dashboards, and safety escalation for urgent messages.

## Live Demo
[Link to be added after deployment]

## Features
- AI chat assistant (Groq / LLaMA 3.1)
- Browser-based voice assistant
- Appointment booking, rescheduling, cancellation
- Patient intake collection
- Safety escalation for emergency messages
- Staff analytics dashboard with charts
- Conversation summaries
- JWT authentication with role-based access
- Admin settings for clinic, providers, services, FAQs

## Tech Stack
| Frontend | Backend |
|---|---|
| Next.js 14 | FastAPI |
| TypeScript | Python 3.11 |
| Tailwind CSS | PostgreSQL |
| shadcn/ui | SQLAlchemy |
| Framer Motion | Alembic |
| Recharts | Groq API (LLaMA 3.1) |
| Auth.js | JWT Auth |
| Axios | Docker |

## Local Development

1. Clone the repo
2. Copy env files:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   ```
3. Add your Groq API key to `backend/.env`:
   ```env
   GROQ_API_KEY=your_key_here
   ```
4. Start backend and database:
   ```bash
   docker compose up --build
   ```
5. Run seed data:
   ```bash
   docker exec healthdesk_backend python app/seed.py
   ```
6. Start frontend:
   ```bash
   cd frontend && npm install && npm run dev
   ```
7. Open http://localhost:3000
8. Login with demo account:
   - Email: `demo@healthdesk.ai`
   - Password: `Demo1234!`

## Deployment

### Database — Render PostgreSQL
Create a new PostgreSQL database on Render.
Copy the internal database URL.

### Backend — Render Web Service
Root directory: `backend`
Environment: Docker
Add environment variables:
```env
DATABASE_URL=your render postgres internal URL
JWT_SECRET_KEY=generate with: openssl rand -hex 32
GROQ_API_KEY=your groq api key
FRONTEND_URL=https://your-app.vercel.app
LLM_PROVIDER=groq
LLM_MODEL=llama-3.1-8b-instant
ENVIRONMENT=production
```

Run after first deploy:
```bash
alembic upgrade head
python app/seed.py
```

### Frontend — Vercel
Root directory: `frontend`
Framework: Next.js
Add environment variables:
```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com/api/v1
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=generate with: openssl rand -hex 32
```

### Google OAuth (when ready)
In Google Cloud Console:
- Authorized JavaScript origin: `https://your-app.vercel.app`
- Authorized redirect URI: `https://your-app.vercel.app/api/auth/callback/google`

Add to Vercel env:
```env
GOOGLE_CLIENT_ID=your client id
GOOGLE_CLIENT_SECRET=your client secret
```

## Environment Variables Reference

| Variable | Where | Description |
|---|---|---|
| DATABASE_URL | backend | PostgreSQL connection string |
| JWT_SECRET_KEY | backend | Secret for JWT signing |
| GROQ_API_KEY | backend | Groq API key |
| LLM_PROVIDER | backend | groq or openai |
| LLM_MODEL | backend | llama-3.1-8b-instant |
| FRONTEND_URL | backend | Allowed CORS origin(s) |
| NEXT_PUBLIC_API_URL | frontend | Backend API base URL |
| NEXTAUTH_URL | frontend | Frontend URL for Auth.js |
| NEXTAUTH_SECRET | frontend | Secret for Auth.js |
| GOOGLE_CLIENT_ID | frontend | Google OAuth client ID |
| GOOGLE_CLIENT_SECRET | frontend | Google OAuth client secret |

## Safety Disclaimer
HealthDesk AI does not provide medical advice, diagnosis, or treatment guidance.
It only supports scheduling, clinic information, and administrative workflows.
Emergency messages are automatically escalated and never answered medically.
