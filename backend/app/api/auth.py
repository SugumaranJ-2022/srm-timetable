from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import jwt
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any

from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.core.security import verify_password, get_password_hash, create_access_token
from backend.app.models.models import User, Staff, Student
from backend.app.schemas.schemas import Token, UserCreate, UserOut, UserProfile, StaffOut, StudentOut

router = APIRouter(prefix="/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

async def get_current_user(
    db: AsyncSession = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user

async def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    if current_user.role != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user does not have enough privileges"
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

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)) -> Any:
    # Check if email exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    user = result.scalar_one_or_none()
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The user with this email already exists in the system.",
        )
    
    new_user = User(
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        role=user_in.role
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

@router.post("/login", response_model=Token)
async def login(
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    input_email = form_data.username.strip().lower()
    
    # 1. Direct email lookup
    result = await db.execute(select(User).where(User.email.ilike(input_email)))
    user = result.scalar_one_or_none()

    # 2. On-demand staff/student User account auto-linking
    if not user:
        prefix = input_email.split('@')[0].replace('.', '').replace('_', '')
        staff_res = await db.execute(select(Staff))
        all_staff = staff_res.scalars().all()
        
        matched_staff = None
        for st in all_staff:
            st_clean = st.name.lower().replace(' ', '').replace('.', '')
            st_email = (getattr(st, 'email', None) or '').lower()
            if input_email == st_email or prefix in st_clean or st_clean in prefix:
                matched_staff = st
                break

        if matched_staff:
            user = User(
                email=input_email,
                password_hash=get_password_hash("Staff123!"),
                role="Staff"
            )
            db.add(user)
            await db.flush()
            matched_staff.user_id = user.id
            await db.commit()
        elif input_email.startswith("student."):
            user = User(
                email=input_email,
                password_hash=get_password_hash("Student123!"),
                role="Student"
            )
            db.add(user)
            await db.commit()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password"
        )
    
    return {
        "access_token": create_access_token(subject=user.email),
        "token_type": "bearer",
    }

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
