import os
from pathlib import Path

# Support loading from .env if present (4 levels up from config.py is project root)
env_path = Path(__file__).resolve().parent.parent.parent.parent / '.env'
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_path)

class Settings:
    PROJECT_NAME: str = "Smart Timetable Management System"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-key-for-jwt-signing-development-only")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./timetable.db")

settings = Settings()
