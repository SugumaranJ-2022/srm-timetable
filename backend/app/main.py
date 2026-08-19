from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import traceback

from backend.app.core.config import settings
from backend.app.core.database import Base, engine
from backend.app.api import auth, admin, timetables

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Automatically create tables in SQLite/MySQL at startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# Allowed origins — production + local development
ALLOWED_ORIGINS = [
    "https://srm-ai-powered-timetable.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]

# CORS setup with explicit origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler — ensures CORS headers are sent even on 500 errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in ALLOWED_ORIGINS:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    
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

@app.get("/debug-db")
async def debug_db(db: AsyncSession = Depends(get_db)):
    from backend.app.models.models import User, Timetable, TimetableDetail, Section
    from sqlalchemy.future import select
    res = await db.execute(select(User))
    users = res.scalars().all()
    
    tt_res = await db.execute(select(Timetable))
    timetables = tt_res.scalars().all()
    
    detail_res = await db.execute(select(TimetableDetail))
    details = detail_res.scalars().all()
    
    sec_res = await db.execute(select(Section))
    sections = sec_res.scalars().all()
    
    db_url = settings.DATABASE_URL
    masked_url = db_url.split("@")[-1] if "@" in db_url else db_url
    return {
        "database_url_host": masked_url,
        "users_count": len(users),
        "sections_count": len(sections),
        "timetables_count": len(timetables),
        "timetable_details_count": len(details),
    }

