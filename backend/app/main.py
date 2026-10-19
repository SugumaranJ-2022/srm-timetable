from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import traceback

from backend.app.core.config import settings
from backend.app.core.database import Base, engine
from backend.app.api import auth, admin, timetables

async def init_db_and_seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # SQLite schema safety check: add any columns that may be missing on existing databases
        def check_and_add_columns(connection):
            try:
                import sqlite3
                res = connection.execute("PRAGMA table_info(users)")
                columns = [row[1] for row in res.fetchall()]
                needed_columns = [
                    ("is_active", "BOOLEAN DEFAULT 1"),
                    ("mfa_enabled", "BOOLEAN DEFAULT 0"),
                    ("mfa_secret", "VARCHAR(64)"),
                    ("mfa_recovery_codes", "TEXT"),
                    ("failed_login_attempts", "INTEGER DEFAULT 0"),
                    ("locked_until", "DATETIME")
                ]
                for col_name, col_type in needed_columns:
                    if col_name not in columns:
                        connection.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
            except Exception:
                pass
        
        await conn.run_sync(check_and_add_columns)

    # Seed default admin and test accounts if missing
    from backend.app.core.database import AsyncSessionLocal
    from backend.app.models.models import User
    from backend.app.core.security import get_password_hash
    from sqlalchemy.future import select
    
    async with AsyncSessionLocal() as session:
        test_accounts = [
            ("admin@college.edu", "Admin123!", "Admin"),
            ("admin@srm.edu.in", "Admin@1234", "Admin"),
            ("admin@test.local", "Admin123!", "Admin"),
            ("faculty@test.local", "Faculty123!", "Staff"),
            ("student@test.local", "Student123!", "Student"),
        ]
        for email, raw_pwd, role in test_accounts:
            res = await session.execute(select(User).where(User.email.ilike(email.strip())))
            existing = res.scalars().first()
            if not existing:
                user = User(
                    email=email,
                    password_hash=get_password_hash(raw_pwd),
                    role=role,
                    is_active=True,
                    mfa_enabled=False
                )
                session.add(user)
            else:
                existing.password_hash = get_password_hash(raw_pwd)
                existing.is_active = True
        await session.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db_and_seed()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

import re

# Allowed origins — production + local development
ALLOWED_ORIGINS = [
    "https://srm-ai-powered-timetable.vercel.app",
    "https://srm-timetable-one.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

# CORS setup with explicit origins, Vercel wildcard regex, and localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^(https?://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.vercel\.app)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler — ensures CORS headers are sent even on 500 errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    origin = request.headers.get("origin", "")
    headers = {}
    if origin and (origin in ALLOWED_ORIGINS or re.match(r"^(https?://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.vercel\.app)$", origin)):
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Allow-Methods"] = "*"
        headers["Access-Control-Allow-Headers"] = "*"
    
    traceback.print_exc()  # Log the full traceback to Render logs
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
        headers=headers
    )

# Include routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(timetables.router, prefix=settings.API_V1_STR)

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db

@app.get("/")
def read_root():
    return {"message": "Welcome to the Smart Timetable Management System API"}

@app.get("/health")
def health_check():
    """Lightweight health check endpoint for UptimeRobot ping / keep-alive."""
    return {"status": "ok", "service": "srm-timetable-backend"}

@app.get("/debug-db")
async def debug_db(db: AsyncSession = Depends(get_db)):
    from backend.app.models.models import User
    from sqlalchemy.future import select
    res = await db.execute(select(User))
    users = res.scalars().all()
    db_url = settings.DATABASE_URL
    masked_url = db_url.split("@")[-1] if "@" in db_url else db_url
    return {
        "database_url_host": masked_url,
        "users_count": len(users),
        "users_list": [u.email for u in users]
    }

