<div align="center">

<img src="./docs/readme_banner.png" alt="SRM Smart Timetable Management System Banner" width="100%"/>

<br/>

# 🎓 SRM Smart Timetable Management System

### *AI-powered, conflict-free academic scheduling for SRM Institute of Science and Technology*

<br/>

[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![OR-Tools](https://img.shields.io/badge/Google_OR--Tools-CP--SAT-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://developers.google.com/optimization)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-5.2-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-F7DF1E?style=for-the-badge)](LICENSE)

<br/>

[🛠 Setup](#%EF%B8%8F-installation--setup) &nbsp;·&nbsp; [📡 API Docs](#-api-reference) &nbsp;·&nbsp; [🌱 Seeding](#-seeding-the-database) &nbsp;·&nbsp; [🚀 Deployment](#-deployment) &nbsp;·&nbsp; [🤝 Contributing](#-contributing)

</div>

---

## 📋 Table of Contents

- [✨ Overview](#-overview)
- [🖼️ System Architecture](#%EF%B8%8F-system-architecture)
- [🌟 Key Features](#-key-features)
- [🧠 AI Solver — How It Works](#-ai-solver--how-it-works)
- [🏗️ Tech Stack](#%EF%B8%8F-tech-stack)
- [📂 Project Structure](#-project-structure)
- [🗄️ Database Schema](#%EF%B8%8F-database-schema)
- [🛠️ Installation & Setup](#%EF%B8%8F-installation--setup)
- [⚙️ Environment Variables](#%EF%B8%8F-environment-variables)
- [🌱 Seeding the Database](#-seeding-the-database)
- [🔑 Default Credentials](#-default-credentials)
- [📡 API Reference](#-api-reference)
- [🎨 Frontend Modules](#-frontend-modules)
- [🚀 Deployment](#-deployment)
- [🔒 Security](#-security)
- [🗺️ Roadmap](#%EF%B8%8F-roadmap)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## ✨ Overview

The **SRM Smart Timetable Management System** is a full-stack, production-grade web application that **automates** the entire academic timetable scheduling process. It eliminates all manual conflicts by using **Google OR-Tools CP-SAT** — a world-class constraint programming solver — to generate mathematically optimal, conflict-free schedules for all 16 sections simultaneously.

> **The Problem**: Academic scheduling at scale is **NP-Hard**. With 45+ faculty, 16 sections, 30 subjects, and 30 timeslots per week, the number of possible combinations exceeds 10³⁰⁰. Manual scheduling inevitably produces staff double-bookings, room clashes, and unbalanced workloads.
>
> **The Solution**: This system reduces that complexity to a **Constraint Satisfaction Problem** and solves it in under 10 seconds.

---

## 🖼️ System Architecture

<div align="center">
<img src="./docs/architecture.png" alt="3D System Architecture" width="90%"/>
</div>

```
┌─────────────────────────────────────────────────┐
│         Browser (React 18 + Vite SPA)           │  ← http://localhost:5173
│   TailwindCSS  ·  Framer Motion  ·  Zustand     │
└────────────────────────┬────────────────────────┘
                         │  JSON REST API  (Bearer JWT)
┌────────────────────────▼────────────────────────┐
│           FastAPI Backend (Python 3.10+)         │  ← http://localhost:8000
│   SQLAlchemy ORM  ·  JWT Auth  ·  CORS          │
│   ⭐ Google OR-Tools CP-SAT Solver               │
└────────────────────────┬────────────────────────┘
                         │  Async SQLAlchemy  (aiosqlite)
┌────────────────────────▼────────────────────────┐
│        SQLite  ·  timetable.db                  │  ← Upgradeable to PostgreSQL
│   10 Tables  ·  Full Relational Schema           │
└─────────────────────────────────────────────────┘
```

---

## 🌟 Key Features

### 🤖 AI-Powered Timetable Generation
- One-click generation of conflict-free schedules for **all 16 sections simultaneously**
- Powered by **Google OR-Tools CP-SAT** Constraint Programming Solver
- Enforces hard constraints (no clashes) and optimizes soft constraints (balanced workload)

### 👤 Role-Based Access Control (RBAC)

| Role | What They Can Do |
|------|-----------------|
| **Admin** | Generate timetables, full CRUD on all entities, view all data |
| **Staff** | View their own weekly schedule and assigned section timetables |
| **Student** | View their own section's current timetable |

### ✏️ Interactive Timetable Editor
- Manually override any period slot via dropdown selection
- **Real-time conflict detection** before saving any change
- Color-coded visual weekly grid per section

### 📊 Admin Dashboard
- Live stat cards: staff count, sections, subjects, classrooms, active timetables
- Staff schedule analysis: free slots, teaching gaps per day
- Full section timetable viewer with search

### 📆 Academic Calendar (2026-27)
- Pre-loaded with the **official SRM Academic Calendar 2026-27** (sourced from approved university PDF)
- Color-coded event types: Classes, Holidays, Announcements, Exams
- Admins can add/delete events; holiday counter

### ⚙️ Complete CRUD Administration
- Full Create / Read / Update / Delete for all 8 entity types
- Staff competency pool management
- Section-subject-staff assignment matrix

### 📈 Reports & Excel Export
- Section-wise timetable completion report
- Staff workload distribution summary
- Classroom utilization overview
- Export to `.xlsx` (Excel)

### 🎨 Premium Modern UI
- **Dark / Light mode** toggle with localStorage persistence
- **Animated login page** with 6-second SRM campus photo slideshow
- **Framer Motion** page transitions and micro-animations
- Glassmorphism design with animated leaf & bicycle decorations

---

## 🧠 AI Solver — How It Works

<div align="center">
<img src="./docs/tech_stack.png" alt="Technology Stack Visualization" width="85%"/>
</div>

The heart of the system is `backend/app/core/solver.py` — a 520-line implementation of a **Constraint Satisfaction Problem (CSP)** using Google OR-Tools CP-SAT.

### Hard Constraints *(must be satisfied — any violation = invalid schedule)*

| # | Constraint | Description |
|---|-----------|-------------|
| 1 | **No Staff Double-Booking** | A staff member cannot teach two sections at the same period |
| 2 | **No Room Double-Booking** | A classroom cannot host two sections simultaneously |
| 3 | **Credit Fulfillment** | Each subject must be scheduled exactly N times/week (N = credit hours) |
| 4 | **Designated Homeroom** | Each section uses its assigned classroom for all periods |

### Soft Constraints *(optimized — minimize penalty score)*

| # | Constraint | Section Setting |
|---|-----------|----------------|
| 5 | **Zero Free Periods** | Minimize idle gaps in daily schedule | `enable_zero_free_periods` |
| 6 | **Daily Coverage** | At least 1 class per section every day | `enable_daily_coverage` |
| 7 | **Project Cadence** | Project sessions on Mon / Wed / Fri | `enable_project_cadence` |

### Solver Algorithm Flow

```
Input: sections, subjects, staff, classrooms, timeslots from DB
        ↓
Step 1: Build decision variables
        x[section][timeslot][subject] ∈ {0, 1}
        ↓
Step 2: Add Hard Constraints to CP-SAT model
        ↓
Step 3: Add Soft Constraints as objective penalties
        ↓
Step 4: solver.Solve()  →  OPTIMAL | FEASIBLE | INFEASIBLE
        ↓
Step 5: Extract solution, persist TimetableDetail rows to DB
        ↓
Output: 16 conflict-free timetables saved, API returns success summary
```

### Performance Numbers
| Metric | Value |
|--------|-------|
| Sections scheduled | 16 |
| Timeslots per section | 30 (5 days × 6 periods) |
| Total decision variables | ~500+ |
| Typical solve time | **< 10 seconds** |

---

## 🏗️ Tech Stack

### Backend

| Technology | Version | Role |
|------------|---------|------|
| Python | 3.10+ | Core language |
| FastAPI | ≥ 0.100 | REST API framework (auto Swagger docs) |
| SQLAlchemy | 2.0 | Async ORM with relationship loading |
| aiosqlite | ≥ 0.19 | Async SQLite driver |
| Google OR-Tools | ≥ 9.9 | CP-SAT constraint programming solver |
| PyJWT | ≥ 2.0 | JWT token creation & validation |
| Passlib + bcrypt | ≥ 1.7 | Salted bcrypt password hashing |
| Pydantic | ≥ 2.0 | Request/response data validation & schemas |
| Uvicorn | ≥ 0.20 | ASGI server |
| Pandas + openpyxl | ≥ 2.0 | Excel report generation |
| python-dotenv | ≥ 1.0 | `.env` file loading |
| pydantic-settings | ≥ 2.0 | Settings class management |

### Frontend

| Technology | Version | Role |
|------------|---------|------|
| React | 18.3 | UI component framework |
| Vite | 5.2 | Build tool & dev server (HMR) |
| TailwindCSS | 3.4 | Utility-first CSS styling |
| Framer Motion | 11.2 | Page transitions & animations |
| Zustand | 4.5 | Lightweight global state management |
| Axios | 1.7 | HTTP client with auth interceptors |
| Lucide React | 0.395 | Consistent icon library (100+ icons used) |
| React Router DOM | 6.23 | Client-side routing |
| clsx + tailwind-merge | latest | Conditional CSS class utilities |

---

## 📂 Project Structure

```
timetable-management/
│
├── 📁 backend/
│   ├── requirements.txt                  # Python dependencies
│   └── 📁 app/
│       ├── main.py                       # FastAPI app, CORS, lifespan startup
│       ├── seed.py                       # Full DB seeder + auto-solve
│       ├── 📁 api/
│       │   ├── auth.py                   # POST /login, /register, GET /me
│       │   ├── admin.py                  # CRUD endpoints for all 8 entities
│       │   └── timetables.py            # Generate, view, override, validate
│       ├── 📁 core/
│       │   ├── config.py                 # Settings: SECRET_KEY, DATABASE_URL
│       │   ├── database.py              # Async engine, session factory
│       │   ├── security.py              # bcrypt hash, JWT creation
│       │   └── solver.py                # ⭐ OR-Tools CP-SAT solver (520 lines)
│       ├── 📁 models/
│       │   └── models.py                # 10 SQLAlchemy ORM tables
│       └── 📁 schemas/
│           └── schemas.py               # Pydantic v2 request/response schemas
│
├── 📁 frontend/
│   ├── index.html                       # Vite entry HTML
│   ├── vite.config.js                   # Vite + React plugin config
│   ├── tailwind.config.js               # TailwindCSS theme config
│   ├── package.json                     # Frontend npm dependencies
│   └── 📁 src/
│       ├── main.jsx                     # React root render
│       ├── App.jsx                      # Login page, routing, theme
│       ├── index.css                    # Global CSS base styles
│       ├── 📁 components/
│       │   ├── Sidebar.jsx              # Role-aware navigation sidebar
│       │   ├── TimetableGrid.jsx        # Visual weekly grid component
│       │   └── DataGrid.jsx             # Reusable CRUD table
│       ├── 📁 modules/
│       │   ├── Dashboard.jsx            # Stats, staff analysis, timetable browser
│       │   ├── TimetableEditor.jsx      # Manual override + conflict detection
│       │   ├── AdminCrud.jsx            # Full CRUD admin panel (8 tabs)
│       │   ├── AcademicCalendar.jsx     # 2026-27 SRM calendar
│       │   └── Reports.jsx              # Analytics + Excel export
│       ├── 📁 context/
│       │   ├── AuthContext.jsx          # JWT auth state, login/logout
│       │   └── ThemeContext.jsx         # Dark/Light mode toggle
│       ├── 📁 services/
│       │   └── api.js                   # Axios client + auth interceptors
│       └── 📁 hooks/                    # Custom React hooks
│
├── 📁 docs/                             # Documentation images
│   ├── readme_banner.png
│   ├── architecture.png
│   └── tech_stack.png
│
├── 📁 pdf_pages/                        # SRM Academic Calendar PDF pages
├── package.json                         # Root: concurrently dev scripts
├── .env                                 # Environment variables (git-ignored)
├── timetable.db                         # SQLite DB (auto-created on seed)
├── timetable_data.xlsx                  # Sample Excel export
├── DEPLOYMENT.md                        # Production deployment guide
└── README.md                            # This file
```

---

## 🗄️ Database Schema

The system uses **10 relational tables**:

```
users ────────────── staff ─────────────────┐
  │                    │                    │
  │              staff_subject          sections ─── section_subjects
  │             (M2M junction)              │                │
  └── students ────────┘               classrooms       subjects
                                            │                │
                                      timetables         departments
                                            │
                                  timetable_details
                                            │
                                        timeslots
```

### Table Reference

| Table | Primary Key | Key Columns |
|-------|------------|-------------|
| `users` | `id` | `email`, `password_hash`, `role` (Admin/Staff/Student) |
| `staff` | `id` | `user_id`, `name`, `phone`, `status` |
| `students` | `id` | `user_id`, `register_number`, `section_id`, `semester` |
| `departments` | `id` | `name` |
| `subjects` | `id` | `code`, `name`, `credits`, `semester`, `is_project` |
| `sections` | `id` | `name`, `program`, `semester`, `strength`, `class_advisor_id`, `classroom_id` |
| `classrooms` | `id` | `room_number`, `building`, `floor`, `capacity`, `is_available` |
| `timeslots` | `id` | `day_of_week`, `period_number`, `start_time`, `end_time`, `slot_type` |
| `timetables` | `id` | `section_id`, `academic_year`, `semester`, `is_active`, `version` |
| `timetable_details` | `id` | `timetable_id`, `timeslot_id`, `subject_id`, `staff_id`, `classroom_id` |
| `staff_subject` | composite | `staff_id`, `subject_id` (M2M competency pool) |
| `section_subjects` | `id` | `section_id`, `subject_id`, `assigned_staff_id` |

### Section Solver Flags

| Column | Default | Controls |
|--------|---------|---------|
| `enable_zero_free_periods` | `true` | Minimize daily schedule gaps |
| `enable_daily_coverage` | `true` | At least 1 class every weekday |
| `enable_project_cadence` | `true` | Project periods on Mon / Wed / Fri |

---

## 🛠️ Installation & Setup

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | **3.10 or 3.11** | OR-Tools wheels may not exist for 3.12+ |
| Node.js | 18+ | Required for frontend + concurrently |
| npm | 9+ | Comes with Node.js |
| Git | any | For cloning |

### Step 1 — Clone

```bash
git clone https://github.com/SugumaranJ-2022/srm-timetable.git
cd srm-timetable
```

### Step 2 — Python Virtual Environment

```bash
# Create venv
python -m venv venv

# Activate — Windows PowerShell
venv\Scripts\activate

# Activate — macOS / Linux
source venv/bin/activate

# Install Python packages
pip install -r backend/requirements.txt
```

> ⚠️ If `ortools` fails to install, verify: `python --version` must show 3.10.x or 3.11.x

### Step 3 — Node.js Dependencies

```bash
# Root dependencies (concurrently)
npm install

# Frontend React dependencies
npm install --prefix frontend
```

### Step 4 — Environment Variables

Create `.env` in the project root (see [Environment Variables](#%EF%B8%8F-environment-variables)).

### Step 5 — Seed the Database

```bash
python -m backend.app.seed
```

Expected terminal output:
```
Dropping all existing tables...
Creating all tables...
Seeding baseline data...
Auto-generating timetables for seeded sections...
Generated semester 1: Successfully generated conflict-free timetables for 16 sections.
Data seeding and timetable generation completed successfully!
```

### Step 6 — Run

```bash
# Start BOTH servers simultaneously (recommended)
npm run dev
```

```bash
# Or individually:
npm run dev:backend    # FastAPI → http://localhost:8000
npm run dev:frontend   # Vite   → http://localhost:5173
```

### Step 7 — Open in Browser

| URL | Purpose |
|-----|---------|
| http://localhost:5173 | **Main Application** |
| http://localhost:8000/docs | FastAPI Swagger UI |
| http://localhost:8000/redoc | FastAPI ReDoc |

---

## ⚙️ Environment Variables

**Project root `.env`:**
```ini
# JWT signing key — change this to a long random string in production!
SECRET_KEY=your-super-secret-jwt-signing-key-min-32-chars

# Database URL
# Development (SQLite — default):
DATABASE_URL=sqlite+aiosqlite:///./timetable.db

# Production (PostgreSQL):
# DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/timetable_db
```

**Frontend `frontend/.env`:**
```ini
# Backend API base URL (used by Axios)
VITE_API_BASE_URL=http://localhost:8000
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | **Yes** | `super-secret-key-...` *(dev)* | JWT HMAC signing key |
| `DATABASE_URL` | No | `sqlite+aiosqlite:///./timetable.db` | DB connection string |
| `VITE_API_BASE_URL` | No | `http://localhost:8000` | Frontend → backend URL |

---

## 🌱 Seeding the Database

`backend/app/seed.py` builds a complete, realistic dataset mirroring SRM's Department of Computer Applications:

### Seeded Data Summary

| Entity | Count | Details |
|--------|-------|---------|
| Departments | 1 | Computer Applications |
| Subjects | 30 | 6 per programme × 5 programmes |
| Staff Members | 45 | With competency subject assignments |
| Classrooms | 20+ | Multi-building, capacities 40–60 |
| Sections | **16** | Across 5 programmes |
| Time Slots | 30 | Mon–Fri × 6 periods (8 AM – 3:50 PM) |
| Users | 47+ | 1 Admin + 45 Staff + 1 Student |
| Timetables | 16 | Auto-solved by OR-Tools after seeding |

### Programmes & Sections

| Programme | Code | Sections | Strength |
|-----------|------|----------|----------|
| Master of Computer Applications | `MCA` | A, B, C, D, E | 45–52 |
| MCA — Generative AI | `MCA_GENAI` | A, B, C | 38–42 |
| Master of Science | `MSC` | A, B | 45–48 |
| Bachelor of Computer Applications | `BCA` | A, B, C | 42–48 |
| BCA — Generative AI | `BCA_GENAI` | A, B, C | 38–42 |
| **Total** | | **16 sections** | |

### Subject Credits (= Weekly Periods)

| Subject Type | Credits | Periods/Week |
|-------------|---------|-------------|
| Core Theory | 5 | 5 |
| Project | 3 | 3 |
| Value Added Course (VAC) | 2 | 2 |

### Daily Schedule

| Period | Time | Notes |
|--------|------|-------|
| 1 | 8:00 – 9:00 AM | |
| 2 | 9:05 – 10:05 AM | |
| 3 | 10:10 – 11:10 AM | |
| 4 | 11:15 AM – 12:05 PM | |
| **Break** | **12:05 – 1:00 PM** | **Lunch** |
| 5 | 1:05 – 2:05 PM | |
| 6 | 2:10 – 3:10 PM | |

---

## 🔑 Default Credentials

| Role | Email | Password |
|------|-------|---------|
| **Admin** | `admin@srm.edu.in` | `Admin@1234` |
| **Staff** | `staff1@srm.edu.in` | `Staff@1234` |
| **Student** | `student@srm.edu.in` | `Student@1234` |

> ⚠️ **Change all default passwords before any public or production deployment.**

---

## 📡 API Reference

Auto-generated docs available at: **http://localhost:8000/docs**

### Authentication — `/api/v1/auth`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/auth/register` | Register new user | Public |
| `POST` | `/auth/login` | Login, returns JWT | Public |
| `GET` | `/auth/me` | Get current user profile + staff/student data | 🔒 Any |

**Login Request (form-encoded):**
```
username=admin@srm.edu.in
password=Admin@1234
```

**Login Response:**
```json
{ "access_token": "eyJhbGci...", "token_type": "bearer" }
```

### Timetables — `/api/v1/timetables`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/timetables/generate` | Run OR-Tools solver for all sections | 🔒 Admin |
| `GET` | `/timetables/section/{id}` | Full timetable for a section | 🔒 Any |
| `GET` | `/timetables/staff/{id}` | Staff member's weekly schedule | 🔒 Any |
| `PUT` | `/timetables/override` | Manual period override | 🔒 Admin |
| `POST` | `/timetables/validate-override` | Check if override causes a conflict | 🔒 Admin |
| `DELETE` | `/timetables/section/{id}` | Delete a section's active timetable | 🔒 Admin |

**Generate Request:**
```json
{ "academic_year": "2026-2027", "semester": 1 }
```

### Admin CRUD — `/api/v1/admin`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/admin/stats` | Dashboard statistics (entity counts) | 🔒 Admin |
| `GET/POST` | `/admin/departments` | List / Create | 🔒 Admin |
| `PUT/DELETE` | `/admin/departments/{id}` | Update / Delete | 🔒 Admin |
| `GET/POST` | `/admin/subjects` | List / Create | 🔒 Admin |
| `PUT/DELETE` | `/admin/subjects/{id}` | Update / Delete | 🔒 Admin |
| `GET/POST` | `/admin/staff` | List / Create | 🔒 Admin |
| `PUT/DELETE` | `/admin/staff/{id}` | Update / Delete | 🔒 Admin |
| `GET/POST` | `/admin/students` | List / Create | 🔒 Admin |
| `PUT/DELETE` | `/admin/students/{id}` | Update / Delete | 🔒 Admin |
| `GET/POST` | `/admin/sections` | List / Create | 🔒 Admin |
| `PUT/DELETE` | `/admin/sections/{id}` | Update / Delete | 🔒 Admin |
| `GET/POST` | `/admin/classrooms` | List / Create | 🔒 Admin |
| `PUT/DELETE` | `/admin/classrooms/{id}` | Update / Delete | 🔒 Admin |
| `GET/POST` | `/admin/timeslots` | List / Create | 🔒 Admin |
| `PUT/DELETE` | `/admin/timeslots/{id}` | Update / Delete | 🔒 Admin |
| `GET/POST` | `/admin/section-subjects` | Manage section–subject–staff assignments | 🔒 Admin |
| `DELETE` | `/admin/section-subjects/{id}` | Remove assignment | 🔒 Admin |

---

## 🎨 Frontend Modules

### 🏠 Dashboard (`src/modules/Dashboard.jsx`)
Main post-login page. Role-adaptive:
- **Admin**: 4 stat cards → staff analysis panel → section timetable browser with search
- **Staff**: Personal schedule → gap analysis → assigned sections list
- **Student**: Own section's visual timetable grid

Includes helper functions:
- `getStaffGaps(schedule)` — detects idle mid-day gaps
- `getStaffFreeSlots(schedule)` — finds completely free periods

### ✏️ Timetable Editor (`src/modules/TimetableEditor.jsx`)
Admin-only manual override tool:
- Section picker → visual weekly grid
- Click any cell → dropdown to select subject + staff
- **Calls `/validate-override` before saving** — prevents all conflicts
- Success/error toast notifications with auto-dismiss

### ⚙️ Admin CRUD (`src/modules/AdminCrud.jsx`)
8-tab CRUD panel covering all entity types:
- **Departments** → **Subjects** → **Staff** → **Students** → **Sections** → **Classrooms** → **Time Slots** → **Section-Subjects**
- Modal dialogs for add/edit
- Inline search + filter
- Cascade delete with confirmation

### 📆 Academic Calendar (`src/modules/AcademicCalendar.jsx`)
- Full **SRM 2026-27 official calendar** pre-loaded (seeded from approved PDF)
- Monthly grid navigation
- Event types: 📚 Academic · 🏖️ Holiday · 📢 Announcement · 🏆 Exam
- Admins: add custom events / delete events
- Holiday counter badge

### 📊 Reports (`src/modules/Reports.jsx`)
- Section timetable completion status
- Staff workload table (hours/week)
- Classroom utilization %
- **Excel export** via backend API

### 📐 Timetable Grid (`src/components/TimetableGrid.jsx`)
Shared reusable component:
- Color-coded subject cells (unique color per subject)
- Staff name + room number displayed per cell
- Break row visualized
- Print-ready CSS media queries

### 📋 Data Grid (`src/components/DataGrid.jsx`)
Reusable table used across all CRUD views:
- Sortable columns
- Inline search
- Pagination
- Edit + Delete action buttons per row

### 🗂️ Sidebar (`src/components/Sidebar.jsx`)
Role-aware navigation:
- **Admin**: Dashboard, Timetable Editor, Admin Panel, Reports, Calendar
- **Staff**: Dashboard, Calendar
- **Student**: Dashboard, Calendar
- Dark/Light theme toggle integrated

---

## 🚀 Deployment

See the full [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step production instructions.

### Quick Reference

#### Frontend → Vercel / Netlify
```bash
# Build command
npm run build --prefix frontend

# Output directory
frontend/dist

# Environment variable
VITE_API_BASE_URL=https://your-api.yourdomain.com
```

#### Backend → Render / Railway
```
Start command: python -m uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
Environment:   SECRET_KEY=<random-string>
               DATABASE_URL=<postgresql-url>
```

#### Self-hosted VPS (Nginx + Gunicorn + Certbot SSL)
```bash
# Run backend
gunicorn backend.app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8000

# Nginx config: serve frontend/dist as static, proxy /api to :8000
# SSL: sudo certbot --nginx -d yourdomain.com
```

### Production Architecture
```
                 HTTPS
                   ↓
         ┌─────────────────┐
         │  Nginx  (Proxy) │
         └──┬──────────┬───┘
       /    │          │   /api
     Static │          ↓
  frontend/ │     Gunicorn :8000
     dist   │          ↓
            │      PostgreSQL
            └──────────────
```

> 💡 Migrate from SQLite to PostgreSQL by updating `DATABASE_URL` in `.env` — no code changes required.

---

## 🔒 Security

| Feature | Implementation |
|---------|---------------|
| Password hashing | bcrypt (salted, cost factor 12) via `passlib` |
| Authentication | JWT Bearer tokens, 7-day expiry (`HS256`) |
| Authorization | FastAPI dependency injection per role |
| Input validation | Pydantic v2 on all request bodies |
| SQL injection | Prevented — all DB access via SQLAlchemy ORM |
| CORS | Configurable via `allow_origins` in `main.py` |
| Secrets | Loaded from `.env` file, never hard-coded |

---

## 🗺️ Roadmap

- [ ] **Multi-semester scheduling** — generate Sem 2, 3, 4 timetables
- [ ] **Drag-and-drop editor** — direct cell swap interface
- [ ] **Email notifications** — alert staff on schedule changes
- [ ] **PDF timetable export** — printable cards per section
- [ ] **Timetable version history** — compare and rollback
- [ ] **PostgreSQL migration script** — automated `alembic` migrations
- [ ] **Mobile companion app** — React Native for students and staff
- [ ] **Attendance integration** — mark attendance from timetable view

---

## 🤝 Contributing

Contributions, bug reports, and feature requests are very welcome!

1. **Fork** this repository
2. **Create** a branch: `git checkout -b feat/your-feature`
3. **Commit** your changes: `git commit -m 'feat: your feature description'`
4. **Push**: `git push origin feat/your-feature`
5. **Open a Pull Request** to `main`

### Guidelines
- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `refactor:`
- Comment complex logic — especially in `solver.py`
- Test all API changes against the seeded dataset
- Ensure frontend builds without errors: `npm run build --prefix frontend`

---

## 📄 License

This project is licensed under the **MIT License** — you are free to use, modify, and distribute it for any purpose.

---

## 👨‍💻 Author

**Sugumaran J**

- 🐙 GitHub: [@SugumaranJ-2022](https://github.com/SugumaranJ-2022)
- 🏫 SRM Institute of Science and Technology, Kattankulathur

---

<div align="center">

*Built with ❤️ for SRM Institute of Science and Technology*

**Smart scheduling. Zero conflicts. Powered by AI.**

<br/>

[![GitHub Stars](https://img.shields.io/github/stars/SugumaranJ-2022/srm-timetable?style=social)](https://github.com/SugumaranJ-2022/srm-timetable)
[![GitHub Forks](https://img.shields.io/github/forks/SugumaranJ-2022/srm-timetable?style=social)](https://github.com/SugumaranJ-2022/srm-timetable/fork)
[![GitHub Issues](https://img.shields.io/github/issues/SugumaranJ-2022/srm-timetable?style=social)](https://github.com/SugumaranJ-2022/srm-timetable/issues)

</div>
