# LogiMatch Deployment Guide

## Local Readiness

1. Install dependencies:
   ```bash
   cd backend
   npm install
   cd ../frontend
   npm install
   ```
2. Copy environment files:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.local
   ```
3. Create/update the local database:
   ```bash
   createdb logimatch_db
   cd backend
   node setup.js
   ```
4. Run both apps:
   ```bash
   cd backend
   npm start
   ```
   ```bash
   cd frontend
   npm run dev
   ```

## Production Hosting

### 1. Neon PostgreSQL

Create a Neon project and copy the pooled PostgreSQL connection string.

### 2. Render Backend

- Service type: Web Service
- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Required environment variables:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `RESEND_API_KEY`
  - `EMAIL_FROM`
  - `FRONTEND_URL`
  - `NODE_ENV=production`

Use Resend for production email delivery. `EMAIL_FROM` can start as
`LogiMatch <onboarding@resend.dev>` for testing, then move to a verified domain
sender before final public use. Resend's `resend.dev` sender is limited to
test emails sent to the Resend account owner's email address, so verify a
domain before testing with other users.

After the first deploy, run the database setup command once from the Render shell:

```bash
node setup.js
```

### 3. Vercel Frontend

- Framework: Next.js
- Root directory: `frontend`
- Required environment variable:
  - `NEXT_PUBLIC_API_URL=https://your-render-service.onrender.com`

After deployment, set `FRONTEND_URL` on Render to the Vercel production URL and redeploy the backend so CORS allows the frontend.

## Production Smoke Test

- Open the Vercel URL.
- Register and verify one seeker and one provider account.
- Post a job as seeker.
- Bid as provider.
- Accept the bid as seeker.
- Download the freight manifest from both accounts.
- Open the profile insights tab for both accounts.
