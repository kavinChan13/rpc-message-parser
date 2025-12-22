"""
Simplified Authentication API - username only
"""

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..auth import create_access_token, get_or_create_user, get_current_user
from ..schemas import UserLogin, UserResponse, Token
from ..config import settings


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    """
    User login/enter system

    Only username required, automatically creates user if not exists
    """
    username = user_data.username.strip()

    if not username:
        raise HTTPException(status_code=400, detail="Username cannot be empty")

    if len(username) > 50:
        raise HTTPException(status_code=400, detail="Username cannot exceed 50 characters")

    # Get or create user
    user = await get_or_create_user(db, username)

    # Create token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires
    )

    return Token(
        access_token=access_token,
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user = Depends(get_current_user)):
    """Get current user information"""
    return current_user
