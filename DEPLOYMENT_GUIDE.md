# Flexa Deployment Guide

## Target Setup

- Frontend: Vercel
- Backend: Render or Railway
- Database: Managed Postgres
- Cache: Managed Redis if needed

## Backend

1. Create a managed Postgres database.
2. Deploy `flexa-backend` as a Python web service.
3. Use `render.yaml` or the following service settings:
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Set environment variables from `flexa-backend/.env.example`.
5. Add your frontend domain to `ALLOWED_ORIGINS`.

## Frontend

1. Deploy `flexa-frontend` to Vercel.
2. Set `REACT_APP_API_URL` to the deployed backend API base URL.
3. Keep the Vercel rewrite config in `vercel.json` so SPA routes work.

## Models / AI

- Small model files like `workout_model.pkl` can stay inside the backend service.
- Large embeddings, indexes, or future model artifacts should go to object storage or a managed vector DB.

## What I can do for you

- Update code and deployment config in the repo.
- Prepare env templates and deployment steps.
- Review deployment errors if you paste logs.

## What I cannot do directly

- I cannot log into your Vercel/Render/Railway accounts.
- I cannot create cloud resources or set provider secrets myself.
- I cannot verify DNS or paid plans unless you connect them.
