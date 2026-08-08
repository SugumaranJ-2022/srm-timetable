from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for dev simplicity
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
