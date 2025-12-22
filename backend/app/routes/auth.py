"""
简化版Authentication API - 只需用户名
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
    用户登录/进入系统

    只需提供用户名，如果用户不存在会自动创建
    """
    username = user_data.username.strip()

    if not username:
        raise HTTPException(status_code=400, detail="用户名不能为空")

    if len(username) > 50:
        raise HTTPException(status_code=400, detail="用户名长度不能超过50个字符")

    # 获取或创建用户
    user = await get_or_create_user(db, username)

    # 创建 token
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
    """获取当前用户信息"""
    return current_user
