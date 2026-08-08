# 🚀 Live Deployment Guide (Vercel & Render)

This document provides a step-by-step guide to deploying the **SRM Smart Timetable Management System** to production using **Vercel** (for the React Frontend) and **Render** (for the FastAPI Backend + PostgreSQL Database).

---

## 🗺️ Deployment Architecture

```
┌─────────────────────────────────┐
│     React Frontend (Vercel)     │
│  https://srm-timetable.vercel.app│
└────────────────┬────────────────┘
                 │
                 │ HTTPS API Calls (JSON)
                 ▼
┌─────────────────────────────────┐
│     FastAPI Backend (Render)    │
│  https://srm-timetable.onrender.com
└────────────────┬────────────────┘
                 │
                 │ Database Connection
                 ▼
┌─────────────────────────────────┐
│   PostgreSQL Database (Render)  │
│      Cloud Managed SQL DB       │
└─────────────────────────────────┘
```

---

## 🗄️ Step 1: Deploy PostgreSQL Database on Render

Since SQLite is a local file-based database, any updates or server restarts on Render will wipe the database. To keep data persistent, we will deploy a **PostgreSQL** instance on Render's free tier.

1. Go to [Render Dashboard](https://dashboard.render.com/) and sign in.
2. Click **New +** and select **PostgreSQL**.
3. Configure the database with these settings:
   - **Name**: `srm-timetable-db`
   - **Region**: Select the region closest to you (e.g., Singapore or Oregon).
   - **Database Name**: `timetable_db`
   - **User**: `srm_admin`
   - **Plan**: Select **Free**.
4. Click **Create Database**.
5. Once active, copy the **Internal Database URL** or **External Database URL** (e.g., `postgresql://srm_admin:password@host/timetable_db`).
6. Update the scheme to include `+asyncpg` for python async support:
   - Change `postgresql://` to `postgresql+asyncpg://`.
   - **Example**: `postgresql+asyncpg://srm_admin:password@host/timetable_db`.
   - Keep this URL safe for Step 2!

---

## 🐍 Step 2: Deploy FastAPI Backend on Render

Now, we will host the Python FastAPI backend API.

1. Go to the [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** and select **Web Service**.
3. Select **Build and deploy from a Git repository** and link your GitHub repository: `SugumaranJ-2022/srm-timetable`.
4. Configure the Web Service settings:
   - **Name**: `srm-timetable-backend`
   - **Environment**: `Python 3`
   - **Region**: Same region as your database.
   - **Branch**: `main`
   - **Root Directory**: *(Leave blank)*
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `python -m uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Select **Free**.
5. Click **Advanced** and add the following **Environment Variables**:
   - `SECRET_KEY`: A secure random string (e.g. `srm-secure-jwt-secret-key-2026-xyz`).
   - `DATABASE_URL`: The **async** PostgreSQL URL from Step 1 (e.g., `postgresql+asyncpg://srm_admin:password@host/timetable_db`).
6. Click **Create Web Service**.
7. Once Render starts building, open the service shell or wait for deployment logs.
8. **Initialize Database Tables & Seed Data**:
   Render doesn't run backend migrations automatically. To seed the database on Render:
   - Go to your Render Web Service page.
   - Click the **Shell** tab on the left sidebar.
   - Run the seed command inside the shell:
     ```bash
     python -m backend.app.seed
     ```
   - This will automatically create all tables in your PostgreSQL database, seed the baseline sections, staff profiles, and classrooms, and run the OR-Tools solver to pre-generate all timetables!

---

## 🎨 Step 3: Deploy React Frontend on Vercel

With the backend active, we can deploy the React app.

1. Go to [Vercel Dashboard](https://vercel.com/) and log in.
2. Click **Add New** and select **Project**.
3. Import your GitHub repository: `SugumaranJ-2022/srm-timetable`.
4. Configure the project:
   - **Framework Preset**: Select **Vite** or **Other**.
   - **Root Directory**: Edit and set this to `frontend`.
5. Under **Build and Development Settings**:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Under **Environment Variables**, add:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: The URL of your deployed Render Web Service (e.g., `https://srm-timetable-backend.onrender.com`).
   - *(Note: Do not include a trailing slash, and do not append `/api/v1` — the Axios config automatically appends `/api/v1`).*
7. Click **Deploy**.
8. Once finished, Vercel will give you a live production URL (e.g., `https://srm-timetable.vercel.app`).

---

## 🧪 Step 4: Verification

1. Open your Vercel URL in the browser.
2. Try logging in using the default seeded admin account:
   - **Email**: `admin@srm.edu.in`
   - **Password**: `Admin@1234`
3. Try generating a new timetable, manually modifying a slot, or checking the Academic Calendar.
4. Verify there are no network issues (CORS warnings) in the browser console.

---

## 🛠️ Maintenance & Redeployment

- **Auto Deploys**: Any time you push a new commit to the `main` branch of your GitHub repository, both Vercel and Render will automatically trigger new builds and deploy your updates.
- **Spin-down**: Render's free tier services spin down after 15 minutes of inactivity. When you open the website after a long break, the first request may take ~50 seconds to complete while Render boots up the container.
