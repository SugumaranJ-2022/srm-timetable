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
    
    # Environment mode: development | testing | production
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development").lower()
    
    # Security & Tokens
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-key-for-jwt-signing-development-only")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    MFA_TOKEN_EXPIRE_MINUTES: int = 5  # 5 minutes for MFA challenge completion
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 15  # 15 minutes for reset token
    OTP_EXPIRE_MINUTES: int = 5  # 5 minutes for OTP verification
    
    # Rate Limiting Settings
    RATE_LIMIT_LOGIN_ATTEMPTS: int = int(os.getenv("RATE_LIMIT_LOGIN_ATTEMPTS", "5"))
    MAX_LOGIN_ATTEMPTS: int = RATE_LIMIT_LOGIN_ATTEMPTS
    RATE_LIMIT_WINDOW_SECONDS: int = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "300"))
    LOCKOUT_DURATION_SECONDS: int = int(os.getenv("LOCKOUT_DURATION_SECONDS", "900"))
    
    # Multi-Factor Authentication
    MFA_ISSUER: str = os.getenv("MFA_ISSUER", "SRM Smart Timetable ERP")
    
    # Email Provider Settings
    EMAIL_PROVIDER: str = os.getenv("EMAIL_PROVIDER", "mock")  # mock | smtp
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "noreply@srm.edu")
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    
    # SMS Provider Settings
    SMS_PROVIDER: str = os.getenv("SMS_PROVIDER", "mock")  # mock | twilio
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_FROM_NUMBER: str = os.getenv("TWILIO_FROM_NUMBER", "")
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./timetable.db")
    
    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT in ["development", "dev", "test", "testing"]
    
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT in ["production", "prod"]

settings = Settings()

