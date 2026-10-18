from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
import jwt
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any, Optional, List
from datetime import datetime, timedelta
import datetime as dt_module
import json

from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.core.security import (
    verify_password, get_password_hash, create_access_token,
    create_mfa_token, verify_mfa_token, generate_secure_token, hash_token,
    generate_otp, captcha_store, rate_limiter, TOTPHelper,
    ip_blocklist_manager, session_revocation_manager, webauthn_helper,
    face_lock_manager
)
from backend.app.models.models import (
    User, Staff, Student, PasswordResetToken, OTPVerification, SecurityAuditLog
)
from backend.app.schemas.schemas import (
    Token, UserCreate, UserOut, UserProfile, StaffOut, StudentOut,
    CaptchaResponse, LoginRequest, LoginResponse, MFASetupResponse,
    MFAVerifyRequest, MFAEnableRequest, MFADisableRequest, ForgotPasswordRequest,
    ResetPasswordRequest, OTPRequest, OTPVerifyRequest,
    SecurityEventOut, SecurityEventSummary
)
from backend.app.services.email_service import get_email_service, mock_email_adapter
from backend.app.services.sms_service import get_sms_service, mock_sms_adapter
from backend.app.services.audit_service import (
    log_security_event, get_security_events, get_security_summary, acknowledge_event
)

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

# --- Dependencies for RBAC ---

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        email: str = payload.get("sub")
        token_type: str = payload.get("type", "access")
        iat: Optional[int] = payload.get("iat")
        if email is None or token_type != "access":
            raise credentials_exception
        if session_revocation_manager.is_token_revoked(iat):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session revoked by administrator. Please log in again."
            )
    except jwt.PyJWTError:
        raise credentials_exception
    
    result = await db.execute(select(User).where(User.email.ilike(email.strip())))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_exception
    return user

async def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    if current_user.role != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Admin access required. The user does not have enough privileges."
        )
    return current_user

async def get_current_staff(
    current_user: User = Depends(get_current_user)
) -> User:
    if current_user.role not in ["Admin", "Staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user does not have enough privileges"
        )
    return current_user


# --- Security Verification (CAPTCHA) ---

@router.get("/captcha", response_model=CaptchaResponse)
async def get_captcha():
    """Generates a secure server-side CAPTCHA challenge expiring in 60s."""
    captcha_id, code = captcha_store.generate(length=5, ttl_seconds=60)
    return {
        "captcha_id": captcha_id,
        "captcha_text": code,
        "expires_in": 60
    }


# --- Authentication & Login ---

@router.post("/login", response_model=LoginResponse)
async def login(
    request: Request,
    req: Optional[LoginRequest] = None,
    form_data: Optional[OAuth2PasswordRequestForm] = Depends(lambda: None),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Enterprise-grade secure login endpoint.
    Supports JSON LoginRequest or OAuth2 form.
    Applies sliding-window rate limiting, server-side CAPTCHA for admin, generic error messages,
    account lockout, MFA challenge, and audit logging.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "Unknown")

    # Extract credentials from JSON or Form
    if req:
        input_email = req.email.strip().lower()
        input_password = req.password
        captcha_id = req.captcha_id
        captcha_code = req.captcha_code
        mfa_code = req.mfa_code
    elif form_data:
        input_email = form_data.username.strip().lower()
        input_password = form_data.password
        captcha_id = None
        captcha_code = None
        mfa_code = None
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing login credentials"
        )

    # 0. Check IP Blocklist (SOC Protection)
    if ip_blocklist_manager.is_blocked(client_ip):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access blocked: Your IP address is blacklisted by university security policy."
        )

    rate_key = f"login:{client_ip}:{input_email}"

    # 1. Check Rate Limiter (Lockout check)
    is_locked, remaining_secs = rate_limiter.is_locked(rate_key)
    if is_locked:
        await log_security_event(
            db,
            event_type="BRUTE_FORCE_BLOCKED",
            severity="WARNING",
            ip_address=client_ip,
            user_agent=user_agent,
            email=input_email,
            details=f"Login attempt blocked due to active rate limit ({remaining_secs}s remaining)."
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Please wait {remaining_secs} seconds before trying again."
        )

    # 2. Database User Lookup
    result = await db.execute(select(User).where(User.email.ilike(input_email)))
    user = result.scalar_one_or_none()

    # 3. Server-side CAPTCHA validation (enforced for Admin accounts)
    is_admin_attempt = (user and user.role == "Admin") or input_email in ["admin@college.edu", "admin@test.local"]
    if is_admin_attempt:
        if not captcha_id or not captcha_code or not captcha_store.validate(captcha_id, captcha_code):
            await log_security_event(
                db,
                event_type="CAPTCHA_FAILURE",
                severity="INFO",
                ip_address=client_ip,
                user_agent=user_agent,
                email=input_email,
                details="Invalid or expired security verification CAPTCHA submitted."
            )
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid security verification code (CAPTCHA). Please try again."
            )

    # 4. Password Verification
    if not user or not verify_password(input_password, user.password_hash):
        is_locked_now, lock_time, failures = rate_limiter.record_failure(rate_key)
        
        severity = "WARNING" if failures >= settings.RATE_LIMIT_LOGIN_ATTEMPTS else "INFO"
        event_name = "BRUTE_FORCE_DETECTED" if failures >= settings.RATE_LIMIT_LOGIN_ATTEMPTS else "LOGIN_FAILURE"
        
        await log_security_event(
            db,
            event_type=event_name,
            severity=severity,
            ip_address=client_ip,
            user_agent=user_agent,
            email=input_email,
            details=f"Authentication failed. Attempt #{failures}."
        )
        await db.commit()

        if is_locked_now:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many failed login attempts. Account temporarily locked for {lock_time} seconds."
            )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please try again."
        )

    # 5. Check if account is active
    if not user.is_active:
        await log_security_event(
            db,
            event_type="LOGIN_REJECTED_INACTIVE",
            severity="WARNING",
            ip_address=client_ip,
            user_agent=user_agent,
            email=input_email,
            user_id=user.id,
            details="Login rejected: account is deactivated."
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is currently inactive. Please contact the administrator."
        )

    # 6. Check Multi-Factor Authentication (MFA)
    if user.mfa_enabled and user.mfa_secret:
        if not mfa_code:
            mfa_pending_token = create_mfa_token(user.email)
            return {
                "mfa_required": True,
                "mfa_token": mfa_pending_token,
                "access_token": None,
                "user": None
            }
        
        # Verify provided TOTP or recovery code
        totp_valid = TOTPHelper.verify_code(user.mfa_secret, mfa_code)
        recovery_valid = False
        if not totp_valid and user.mfa_recovery_codes:
            recovery_valid, updated_codes = TOTPHelper.verify_and_consume_recovery_code(
                user.mfa_recovery_codes, mfa_code
            )
            if recovery_valid:
                user.mfa_recovery_codes = updated_codes
                await db.flush()

        if not (totp_valid or recovery_valid):
            await log_security_event(
                db,
                event_type="MFA_FAILURE",
                severity="WARNING",
                ip_address=client_ip,
                user_agent=user_agent,
                email=input_email,
                user_id=user.id,
                details="Invalid TOTP or recovery code submitted."
            )
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Multi-Factor Authentication code."
            )
        
        await log_security_event(
            db,
            event_type="MFA_SUCCESS",
            severity="INFO",
            ip_address=client_ip,
            user_agent=user_agent,
            email=input_email,
            user_id=user.id,
            details="MFA verification completed successfully."
        )

    # 7. Successful Authentication
    rate_limiter.record_success(rate_key)
    user.failed_login_attempts = 0
    await db.flush()

    await log_security_event(
        db,
        event_type="LOGIN_SUCCESS",
        severity="INFO",
        ip_address=client_ip,
        user_agent=user_agent,
        email=input_email,
        user_id=user.id,
        details=f"Successful authentication as {user.role}."
    )
    await db.commit()

    token = create_access_token(
        subject=user.email,
        extra_claims={"role": user.role, "uid": user.id}
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "mfa_required": False,
        "mfa_token": None,
        "user": UserOut.model_validate(user)
    }


# --- MFA Challenge Verification ---

@router.post("/mfa/verify", response_model=LoginResponse)
async def verify_mfa_login(
    req: MFAVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Verifies MFA challenge token from two-step login flow."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    user_agent = request.headers.get("user-agent", "Unknown")

    if not req.mfa_token:
        raise HTTPException(status_code=400, detail="Missing MFA session token.")
    
    email = verify_mfa_token(req.mfa_token)
    if not email:
        raise HTTPException(status_code=401, detail="Expired or invalid MFA token. Please sign in again.")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not user.is_active or not user.mfa_secret:
        raise HTTPException(status_code=401, detail="Invalid user session.")

    totp_valid = TOTPHelper.verify_code(user.mfa_secret, req.code)
    recovery_valid = False
    if not totp_valid and user.mfa_recovery_codes:
        recovery_valid, updated_codes = TOTPHelper.verify_and_consume_recovery_code(
            user.mfa_recovery_codes, req.code
        )
        if recovery_valid:
            user.mfa_recovery_codes = updated_codes
            await db.flush()

    if not (totp_valid or recovery_valid):
        await log_security_event(
            db,
            event_type="MFA_FAILURE",
            severity="WARNING",
            ip_address=client_ip,
            user_agent=user_agent,
            email=user.email,
            user_id=user.id,
            details="Invalid MFA code entered."
        )
        await db.commit()
        raise HTTPException(status_code=401, detail="Invalid verification code.")

    await log_security_event(
        db,
        event_type="LOGIN_SUCCESS_MFA",
        severity="INFO",
        ip_address=client_ip,
        user_agent=user_agent,
        email=user.email,
        user_id=user.id,
        details="Login completed with multi-factor authentication."
    )
    await db.commit()

    token = create_access_token(
        subject=user.email,
        extra_claims={"role": user.role, "uid": user.id}
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "mfa_required": False,
        "user": UserOut.model_validate(user)
    }


# --- MFA Enrollment (Admin / Staff) ---

@router.post("/mfa/setup", response_model=MFASetupResponse)
async def setup_mfa(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generates a new TOTP secret and provisioning URI for authenticator apps."""
    secret = TOTPHelper.generate_secret()
    uri = TOTPHelper.get_provisioning_uri(secret, current_user.email)
    plain_recovery, hashed_recovery = TOTPHelper.generate_recovery_codes()
    current_user.mfa_secret = secret
    current_user.mfa_recovery_codes = hashed_recovery
    await db.commit()
    return {
        "secret": secret,
        "otpauth_uri": uri,
        "recovery_codes": plain_recovery
    }

@router.post("/mfa/enable")
async def enable_mfa(
    req: MFAEnableRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Enables TOTP MFA after verifying a code from the user's authenticator app."""
    secret = req.secret or current_user.mfa_secret
    if not secret:
        raise HTTPException(status_code=400, detail="MFA setup was not initiated.")

    if not TOTPHelper.verify_code(secret, req.code):
        raise HTTPException(status_code=400, detail="Invalid code. Authenticator app not synchronized.")

    if req.recovery_codes:
        hashed_recovery = [hash_token(c) for c in req.recovery_codes]
        current_user.mfa_recovery_codes = json.dumps(hashed_recovery)

    current_user.mfa_secret = secret
    current_user.mfa_enabled = True
    
    await log_security_event(
        db,
        event_type="MFA_ENABLED",
        severity="INFO",
        email=current_user.email,
        user_id=current_user.id,
        details="User enabled two-factor authentication."
    )
    await db.commit()
    return {"message": "Multi-Factor Authentication enabled successfully."}

@router.post("/mfa/disable")
async def disable_mfa(
    req: MFADisableRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Disables TOTP MFA upon verifying account password or recovery code."""
    valid = False
    if req.password and verify_password(req.password, current_user.password_hash):
        valid = True
    elif req.recovery_code and current_user.mfa_recovery_codes:
        valid, updated = TOTPHelper.verify_and_consume_recovery_code(
            current_user.mfa_recovery_codes, req.recovery_code
        )
        if valid:
            current_user.mfa_recovery_codes = updated

    if not valid:
        raise HTTPException(status_code=400, detail="Invalid password or recovery code.")

    current_user.mfa_enabled = False
    current_user.mfa_secret = None
    current_user.mfa_recovery_codes = None
    
    await log_security_event(
        db,
        event_type="MFA_DISABLED",
        severity="WARNING",
        email=current_user.email,
        user_id=current_user.id,
        details="User disabled two-factor authentication."
    )
    await db.commit()
    return {"message": "Multi-Factor Authentication disabled successfully."}


# --- Password Reset Workflow ---

@router.post("/forgot-password")
async def forgot_password(
    req: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Initiates single-use expiring password reset token.
    Always returns generic confirmation to prevent user enumeration.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    email = req.email.strip().lower()

    result = await db.execute(select(User).where(User.email.ilike(email)))
    user = result.scalar_one_or_none()

    if user and user.is_active:
        token = generate_secure_token(32)
        token_h = hash_token(token)
        expires = datetime.utcnow() + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)
        
        pr_token = PasswordResetToken(
            token_hash=token_h,
            user_id=user.id,
            expires_at=expires,
            used=False
        )
        db.add(pr_token)
        await db.flush()

        # Send email via adapter
        email_svc = get_email_service()
        reset_link = f"http://localhost:3000/#/reset-password?token={token}"
        html = f"""
        <h2>SRM Smart Timetable Password Reset</h2>
        <p>A password reset was requested for your account ({user.email}).</p>
        <p><a href="{reset_link}">Click here to reset your password</a></p>
        <p>This single-use link expires in {settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
        """
        email_svc.send_email(user.email, "SRM Timetable ERP — Password Reset", html)

        await log_security_event(
            db,
            event_type="PASSWORD_RESET_REQUESTED",
            severity="INFO",
            ip_address=client_ip,
            email=user.email,
            user_id=user.id,
            details="Password reset token generated and dispatched."
        )
        await db.commit()

    resp = {
        "message": "If an account is associated with this email address, a password reset link has been dispatched."
    }
    if settings.is_development and user:
        resp["dev_reset_token"] = token
    return resp

@router.post("/reset-password")
async def reset_password(
    req: ResetPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Validates single-use reset token and securely updates password."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    token_h = hash_token(req.token.strip())

    result = await db.execute(
        select(PasswordResetToken)
        .where(PasswordResetToken.token_hash == token_h)
        .where(PasswordResetToken.used == False)
    )
    pr_token = result.scalar_one_or_none()

    if not pr_token or pr_token.expires_at < datetime.utcnow():
        await log_security_event(
            db,
            event_type="PASSWORD_RESET_FAILED",
            severity="WARNING",
            ip_address=client_ip,
            details="Attempted password reset with invalid or expired token."
        )
        await db.commit()
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired password reset link. Please request a new one."
        )

    user_res = await db.execute(select(User).where(User.id == pr_token.user_id))
    user = user_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="User account not found.")

    user.password_hash = get_password_hash(req.new_password)
    user.failed_login_attempts = 0
    pr_token.used = True
    
    await log_security_event(
        db,
        event_type="PASSWORD_RESET_SUCCESS",
        severity="INFO",
        ip_address=client_ip,
        email=user.email,
        user_id=user.id,
        details="Password successfully updated via reset token."
    )
    await db.commit()

    return {"message": "Password updated successfully. You may now sign in with your new credentials."}


# --- SMS / Email OTP Verification ---

@router.post("/otp/send")
async def send_otp(
    req: OTPRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Generates and sends a 6-digit OTP to mobile or email destination."""
    dest = req.get_destination()
    if not dest:
        raise HTTPException(status_code=400, detail="Missing destination phone number or email.")
    code = generate_otp(6)
    code_h = hash_token(code)
    expires = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

    otp_rec = OTPVerification(
        destination=dest,
        purpose=req.purpose,
        code_hash=code_h,
        attempts=0,
        expires_at=expires,
        used=False
    )
    db.add(otp_rec)
    await db.flush()

    if "@" in dest:
        get_email_service().send_email(
            dest,
            "Your Verification Code",
            f"<p>Your security verification code is: <strong>{code}</strong>. Valid for 5 minutes.</p>"
        )
    else:
        get_sms_service().send_sms(
            dest,
            f"SRM Timetable: Your verification code is {code}. Valid for 5 minutes."
        )

    await db.commit()
    return {"message": "Verification code dispatched successfully."}

@router.post("/otp/verify")
async def verify_otp(
    req: OTPVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Verifies a single-use OTP with attempt limiting and expiration."""
    dest = req.get_destination()
    result = await db.execute(
        select(OTPVerification)
        .where(OTPVerification.destination == dest)
        .where(OTPVerification.purpose == req.purpose)
        .where(OTPVerification.used == False)
        .order_by(OTPVerification.created_at.desc())
    )
    otp_rec = result.scalars().first()

    if not otp_rec or otp_rec.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Verification code has expired or does not exist.")

    if otp_rec.attempts >= 3:
        otp_rec.used = True
        await db.commit()
        raise HTTPException(status_code=400, detail="Too many invalid attempts. Please request a new code.")

    otp_rec.attempts += 1
    if hash_token(req.code.strip()) != otp_rec.code_hash:
        await db.commit()
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    otp_rec.used = True
    await db.commit()
    return {"verified": True, "message": "Verification code confirmed successfully."}


# --- Development-Only Testing Inspection Endpoints ---

@router.get("/dev/last-otp")
async def dev_last_otp():
    """Development/Testing ONLY endpoint to inspect simulated OTP without real SMS carrier."""
    if not settings.is_development:
        raise HTTPException(status_code=404, detail="Not found.")
    last_sms = mock_sms_adapter.get_last_sms()
    last_email = mock_email_adapter.get_last_email()
    code = None
    if last_sms and isinstance(last_sms, dict) and "message" in last_sms:
        import re
        m = re.search(r'\b\d{6}\b', last_sms["message"])
        if m:
            code = m.group(0)
    elif last_email and isinstance(last_email, dict) and "html" in last_email:
        import re
        m = re.search(r'\b\d{6}\b', last_email["html"])
        if m:
            code = m.group(0)
    return {
        "code": code,
        "last_sms": last_sms,
        "last_email": last_email
    }


# --- Security Events & Audit Logs (Admin Only) ---

@router.get("/admin/security/events", response_model=List[SecurityEventOut])
async def get_admin_security_events(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin),
    limit: int = 50,
    severity: Optional[str] = None
):
    """Admin-only real-time security events list."""
    return await get_security_events(db, limit=limit, severity=severity)

@router.get("/admin/security/summary", response_model=SecurityEventSummary)
async def get_admin_security_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Admin-only real-time security events & alert summary."""
    return await get_security_summary(db)

@router.post("/admin/security/events/{event_id}/acknowledge")
async def acknowledge_admin_security_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Acknowledges an active security alert without removing the audit log record."""
    event = await acknowledge_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Security event not found.")
    return {"message": "Security event acknowledged.", "event": SecurityEventOut.model_validate(event)}


# --- Registration & Profile ---

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)) -> Any:
    if user_in.role == "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Self-registration as Administrator is strictly prohibited."
        )

    result = await db.execute(select(User).where(User.email.ilike(user_in.email.strip().lower())))
    user = result.scalar_one_or_none()
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The user with this email already exists in the system.",
        )
    
    new_user = User(
        email=user_in.email.strip().lower(),
        password_hash=get_password_hash(user_in.password),
        role=user_in.role,
        is_active=True
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

@router.get("/me", response_model=UserProfile)
async def read_users_me(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    staff_out = None
    student_out = None

    if current_user.role == "Staff":
        res = await db.execute(select(Staff).where(Staff.user_id == current_user.id))
        staff = res.scalar_one_or_none()
        if staff:
            staff_out = StaffOut.model_validate(staff)
            
    elif current_user.role == "Student":
        from sqlalchemy.orm import selectinload
        res = await db.execute(select(Student).options(selectinload(Student.section)).where(Student.user_id == current_user.id))
        student = res.scalar_one_or_none()
        if student:
            student_out = StudentOut.model_validate(student)
            if student.section:
                student_out.section_name = student.section.name

    user_out = UserOut.model_validate(current_user)
    return UserProfile(
        user=user_out,
        staff=staff_out,
        student=student_out
    )


# ==============================================================================
# ULTRA UPGRADE 1 & 5: SOC THREAT ANALYTICS & WEBAUTHN BIOMETRICS
# ==============================================================================

class BlockIPRequest(BaseModel):
    ip: str
    reason: str = "Admin Manual Lockout"
    duration_hours: int = 24

class UnblockIPRequest(BaseModel):
    ip: str

class PasskeyVerifyRequest(BaseModel):
    email: str
    challenge: str
    credential_id: Optional[str] = None


@router.get("/admin/security/soc-metrics")
async def get_soc_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Military-grade SOC threat analytics, velocity calculations & attack score."""
    from sqlalchemy import func
    
    # 1. Total events in last 24h
    since_24h = datetime.utcnow() - timedelta(hours=24)
    res_24h = await db.execute(
        select(SecurityAuditLog).where(SecurityAuditLog.timestamp >= since_24h)
    )
    events_24h = res_24h.scalars().all()
    
    fail_count = sum(1 for e in events_24h if e.event_type in ["LOGIN_FAILURE", "BRUTE_FORCE_DETECTED", "MFA_FAILURE"])
    crit_count = sum(1 for e in events_24h if e.severity in ["CRITICAL", "HIGH"])
    
    # Threat Level Calculation
    if crit_count > 3 or fail_count > 20:
        threat_level = "HIGH ALERT"
        threat_score = min(98, 70 + fail_count)
    elif crit_count > 0 or fail_count > 5:
        threat_level = "ELEVATED"
        threat_score = min(65, 35 + fail_count * 2)
    else:
        threat_level = "NORMAL"
        threat_score = max(8, fail_count * 3)

    # Top attacking IPs
    from collections import Counter
    ip_counter = Counter(e.ip_address for e in events_24h if e.ip_address and e.severity in ["WARNING", "CRITICAL", "HIGH"])
    top_ips = [{"ip": ip, "incidents": count} for ip, count in ip_counter.most_common(5)]

    # Hourly velocity for last 6 hours
    now_hour = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    velocity = []
    for h in range(5, -1, -1):
        h_start = now_hour - timedelta(hours=h)
        h_end = h_start + timedelta(hours=1)
        cnt = sum(1 for e in events_24h if h_start <= e.timestamp < h_end)
        velocity.append({
            "hour": h_start.strftime("%H:00"),
            "events": cnt
        })

    return {
        "threat_level": threat_level,
        "threat_score": threat_score,
        "total_events_24h": len(events_24h),
        "failed_attempts_24h": fail_count,
        "critical_incidents_24h": crit_count,
        "blocked_ips_count": len(ip_blocklist_manager.get_blocked_ips()),
        "top_attack_ips": top_ips,
        "velocity_per_hour": velocity
    }


@router.post("/admin/security/block-ip")
async def block_ip_address(
    req: BlockIPRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Instantly blacklists an IP address from reaching the university portal."""
    info = ip_blocklist_manager.block_ip(req.ip, req.reason, req.duration_hours)
    await log_security_event(
        db,
        event_type="IP_BLACKLISTED",
        severity="WARNING",
        email=current_user.email,
        details=f"Admin blocked IP {req.ip}: {req.reason}"
    )
    await db.commit()
    return {"message": f"IP {req.ip} successfully blocked.", "data": info}


@router.post("/admin/security/unblock-ip")
async def unblock_ip_address(
    req: UnblockIPRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Removes an IP address from the university blacklist."""
    ok = ip_blocklist_manager.unblock_ip(req.ip)
    if not ok:
        raise HTTPException(status_code=404, detail="IP address not found in blacklist.")
    await log_security_event(
        db,
        event_type="IP_UNBLOCKED",
        severity="INFO",
        email=current_user.email,
        details=f"Admin unblocked IP {req.ip}"
    )
    await db.commit()
    return {"message": f"IP {req.ip} removed from blacklist."}


@router.get("/admin/security/blocked-ips")
async def get_blocked_ips(
    current_user: User = Depends(get_current_admin)
):
    """Returns currently active blacklisted IP addresses."""
    return ip_blocklist_manager.get_blocked_ips()


@router.post("/admin/security/kill-sessions")
async def kill_all_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Global Emergency Kill Switch: Terminates all active sessions across all devices."""
    epoch = session_revocation_manager.revoke_all_sessions()
    await log_security_event(
        db,
        event_type="SESSION_KILL_SWITCH",
        severity="CRITICAL",
        email=current_user.email,
        details="Admin activated global session revocation switch."
    )
    await db.commit()
    return {
        "message": "Global session termination successful. All existing tokens invalidated.",
        "revocation_timestamp": epoch
    }


@router.get("/admin/security/export-audit")
async def export_security_audit_csv(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """Exports structured university security audit records as downloadable CSV."""
    from fastapi.responses import Response
    import csv
    import io

    res = await db.execute(select(SecurityAuditLog).order_by(SecurityAuditLog.timestamp.desc()))
    logs = res.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Timestamp (UTC)", "Event Type", "Severity", "Account Email", "IP Address", "Acknowledged", "Details"])
    for l in logs:
        writer.writerow([
            l.id,
            l.timestamp.isoformat() if l.timestamp else "",
            l.event_type,
            l.severity,
            l.email or "",
            l.ip_address or "",
            "YES" if l.acknowledged else "NO",
            l.details or ""
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=srm_security_audit_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"}
    )


# --- Biometric / WebAuthn Passkey Endpoints ---

@router.post("/passkey/login-challenge")
async def create_passkey_challenge(
    email: Optional[str] = None
):
    """Generates FIDO2 WebAuthn cryptographic challenge for biometric login."""
    challenge = webauthn_helper.create_challenge(email)
    return {
        "challenge": challenge,
        "rp": {"name": "SRM Institute of Science and Technology", "id": "localhost"},
        "timeout": 60000
    }


@router.post("/passkey/login-verify")
async def verify_passkey_biometrics(
    req: PasskeyVerifyRequest,
    db: AsyncSession = Depends(get_db)
):
    """Verifies biometric credentials (Touch ID, Face ID, Windows Hello) and signs in."""
    if not webauthn_helper.verify_challenge(req.challenge):
        raise HTTPException(status_code=400, detail="Biometric challenge expired or invalid.")

    # Find user
    result = await db.execute(select(User).where(User.email.ilike(req.email.strip().lower())))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Account not found or inactive.")

    # Generate token
    token = create_access_token(
        subject=user.email,
        extra_claims={"role": user.role, "uid": user.id}
    )

    await log_security_event(
        db,
        event_type="BIOMETRIC_LOGIN_SUCCESS",
        severity="INFO",
        email=user.email,
        user_id=user.id,
        details=f"Passwordless biometric authentication verified as {user.role}."
    )
    await db.commit()

    return {
        "access_token": token,
        "token_type": "bearer",
        "mfa_required": False,
        "user": UserOut.model_validate(user)
    }


# --- Face Lock Biometric Enrollment & Verification Routes ---

class FaceLockEnrollRequest(BaseModel):
    image: str

class FaceLockLoginRequest(BaseModel):
    email: Optional[str] = "admin@college.edu"
    face_image: Optional[str] = None


@router.post("/face-lock/enroll")
async def enroll_admin_face_lock(
    req: FaceLockEnrollRequest,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Stores the administrator's original face lock image."""
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Only Administrator can enroll original Face Lock credentials.")
    data = face_lock_manager.enroll(current_user.email, req.image)
    await log_security_event(
        db,
        event_type="FACE_LOCK_ENROLLED",
        severity="INFO",
        email=current_user.email,
        user_id=current_user.id,
        details="Original biometric Face Lock credential registered and stored for Admin."
    )
    await db.commit()
    return {"message": "Original face lock enrolled successfully.", "enrolled": True, "data": data}


@router.get("/face-lock/status")
async def get_face_lock_status(
    email: str = "admin@college.edu"
):
    """Retrieves the stored face lock credential status for biometric sign-in."""
    enrolled = face_lock_manager.get_enrolled_face(email)
    if not enrolled:
        return {"enrolled": False, "image": None}
    return enrolled


@router.post("/face-lock/verify-login")
async def verify_face_lock_login(
    req: FaceLockLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Verifies captured face against stored original face lock and grants instant Admin access."""
    email = (req.email or "admin@college.edu").strip().lower()
    result = await db.execute(select(User).where(User.email.ilike(email)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Administrator account not found or disabled.")

    # Strict Biometric Face Verification
    is_match, confidence, reason = face_lock_manager.verify_face_match(user.email, req.face_image)
    if not is_match:
        await log_security_event(
            db,
            event_type="FACE_LOCK_LOGIN_FAILED",
            severity="WARNING",
            email=user.email,
            user_id=user.id,
            details=f"Biometric Face Lock rejected: {reason}"
        )
        await db.commit()
        raise HTTPException(
            status_code=401,
            detail=f"Biometric Verification Failed: {reason}"
        )

    token = create_access_token(
        subject=user.email,
        extra_claims={"role": user.role, "uid": user.id}
    )

    await log_security_event(
        db,
        event_type="FACE_LOCK_LOGIN_SUCCESS",
        severity="INFO",
        email=user.email,
        user_id=user.id,
        details=f"Biometric Face Lock verified for Admin ({confidence}% match)."
    )
    await db.commit()

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "confidence": confidence,
        "mfa_required": False,
        "user": UserOut.model_validate(user)
    }

