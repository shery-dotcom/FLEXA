# Flexa - Share-Ready Setup Guide

This repository contains the Flexa AI Fitness Planner project with:

- Backend: FastAPI app in `flexa-backend`
- Frontend: React app in `flexa-frontend`
- Datasets: expected under `Datasets` (not committed to git)

## 1) What To Share

1. Share this repository URL (preferably private GitHub repo).
2. Share dataset download links separately (Drive, OneDrive, Kaggle, etc.).
3. Ask collaborator to place datasets in the exact folder structure shown below.

## 2) Prerequisites

- Python 3.10+
- Node.js 18+
- npm 9+
- PostgreSQL (for backend DB)
- Redis (optional, recommended for background tasks)

## 3) Project Structure (important paths)

- `flexa-backend/` - FastAPI service
- `flexa-frontend/` - React web app
- `Datasets/` - local datasets directory (excluded from git)

## 4) Environment Files

### Backend

1. Copy `flexa-backend/.env.example` to `flexa-backend/.env`.
2. Fill required values (DB, OAuth, API keys, Stripe keys).

### Frontend

1. Copy `flexa-frontend/.env.example` to `flexa-frontend/.env`.
2. Set backend API URL if needed.

## 5) Dataset Placement

Create/populate this local folder (already ignored by git):

`Datasets/`

Expected subfolders include (based on current project):

- `Datasets/food-101/`
- `Datasets/Food.com/`
- `Datasets/FoodData_Central_csv_2025-12-18/`
- `Datasets/Pakistani Food Images/`
- `Datasets/Vegetables & Fruits/`

If your shared datasets are zipped, extract them to preserve these names.

## 6) Run Locally (manual)

### Backend

```powershell
cd flexa-backend
python -m venv ../.venv
..\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Backend URLs:

- API: `http://localhost:8000`
- Docs: `http://localhost:8000/docs`

### Frontend

```powershell
cd flexa-frontend
npm install
npm start
```

Frontend URL:

- App: `http://localhost:3000`

## 7) Run With Existing Script (Windows)

From repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\run.ps1
```

This launches backend and frontend in separate windows.

## 8) Recommended Sharing Workflow

1. Push code to a private GitHub repo.
2. Keep `.env` files private; only commit `.env.example`.
3. Keep `Datasets/` out of git (already ignored).
4. Share datasets through cloud storage with the collaborator.

## 9) Optional: Deployment Files Included

- `DEPLOYMENT_GUIDE.md`
- `render.yaml`
- `vercel.json`

These can be used if collaborator needs hosted deployment instead of local setup.
