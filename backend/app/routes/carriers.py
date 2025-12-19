"""
Carrier API Routes - Carrier Events Tracking
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, distinct

from ..database import get_db, LogFile, CarrierEvent, User
from ..auth import get_current_user
from ..schemas import (
    CarrierEventResponse, CarrierEventDetail, CarrierEventList,
    CarrierStatistics
)


router = APIRouter(prefix="/carriers", tags=["Carrier 跟踪"])


@router.get("/{file_id}/events", response_model=CarrierEventList)
async def get_carrier_events(
    file_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000),
    carrier_type: Optional[str] = Query(None, description="carrier 类型: rx-array-carriers, tx-array-carriers, etc."),
    event_type: Optional[str] = Query(None, description="事件类型: create, update, delete, state-change, query, data"),
    carrier_name: Optional[str] = Query(None, description="carrier 名称"),
    direction: Optional[str] = Query(None, description="消息方向: DU->RU, RU->DU"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取 Carrier 事件列表"""
    # Verify file ownership
    file_result = await db.execute(
        select(LogFile)
        .where(LogFile.id == file_id, LogFile.user_id == current_user.id)
    )
    log_file = file_result.scalar_one_or_none()

    if not log_file:
        raise HTTPException(status_code=404, detail="文件不存在")

    # Build query
    query = select(CarrierEvent).where(CarrierEvent.log_file_id == file_id)
    count_query = select(func.count(CarrierEvent.id)).where(CarrierEvent.log_file_id == file_id)

    if carrier_type:
        query = query.where(CarrierEvent.carrier_type == carrier_type)
        count_query = count_query.where(CarrierEvent.carrier_type == carrier_type)

    if event_type:
        query = query.where(CarrierEvent.event_type == event_type)
        count_query = count_query.where(CarrierEvent.event_type == event_type)

    if carrier_name:
        query = query.where(CarrierEvent.carrier_name.contains(carrier_name))
        count_query = count_query.where(CarrierEvent.carrier_name.contains(carrier_name))

    if direction:
        query = query.where(CarrierEvent.direction == direction)
        count_query = count_query.where(CarrierEvent.direction == direction)

    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Get paginated results
    query = query.order_by(CarrierEvent.line_number).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    events = result.scalars().all()

    return CarrierEventList(
        events=events,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{file_id}/events/{event_id}", response_model=CarrierEventDetail)
async def get_carrier_event_detail(
    file_id: int,
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取 Carrier 事件详情"""
    # Verify file ownership
    file_result = await db.execute(
        select(LogFile)
        .where(LogFile.id == file_id, LogFile.user_id == current_user.id)
    )
    if not file_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="文件不存在")

    # Get event
    result = await db.execute(
        select(CarrierEvent)
        .where(CarrierEvent.id == event_id, CarrierEvent.log_file_id == file_id)
    )
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(status_code=404, detail="事件不存在")

    return event


@router.get("/{file_id}/statistics", response_model=CarrierStatistics)
async def get_carrier_statistics(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取 Carrier 统计信息"""
    # Verify file ownership
    file_result = await db.execute(
        select(LogFile)
        .where(LogFile.id == file_id, LogFile.user_id == current_user.id)
    )
    if not file_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="文件不存在")

    # Total events
    total_result = await db.execute(
        select(func.count(CarrierEvent.id))
        .where(CarrierEvent.log_file_id == file_id)
    )
    total_events = total_result.scalar() or 0

    # By carrier type
    type_result = await db.execute(
        select(CarrierEvent.carrier_type, func.count(CarrierEvent.id))
        .where(CarrierEvent.log_file_id == file_id)
        .group_by(CarrierEvent.carrier_type)
    )
    by_carrier_type = dict(type_result.all())

    # By event type
    event_result = await db.execute(
        select(CarrierEvent.event_type, func.count(CarrierEvent.id))
        .where(CarrierEvent.log_file_id == file_id)
        .group_by(CarrierEvent.event_type)
    )
    by_event_type = dict(event_result.all())

    # By state
    state_result = await db.execute(
        select(CarrierEvent.state, func.count(CarrierEvent.id))
        .where(CarrierEvent.log_file_id == file_id, CarrierEvent.state.isnot(None))
        .group_by(CarrierEvent.state)
    )
    by_state = dict(state_result.all())

    # Distinct carrier names
    names_result = await db.execute(
        select(distinct(CarrierEvent.carrier_name))
        .where(CarrierEvent.log_file_id == file_id)
        .order_by(CarrierEvent.carrier_name)
    )
    carrier_names = [name for name in names_result.scalars().all() if name]

    return CarrierStatistics(
        total_events=total_events,
        by_carrier_type=by_carrier_type,
        by_event_type=by_event_type,
        by_state=by_state,
        carrier_names=carrier_names
    )


@router.get("/{file_id}/timeline/{carrier_name}")
async def get_carrier_timeline(
    file_id: int,
    carrier_name: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取特定 Carrier 的事件时间线"""
    # Verify file ownership
    file_result = await db.execute(
        select(LogFile)
        .where(LogFile.id == file_id, LogFile.user_id == current_user.id)
    )
    if not file_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="文件不存在")

    # Get all events for this carrier
    result = await db.execute(
        select(CarrierEvent)
        .where(
            CarrierEvent.log_file_id == file_id,
            CarrierEvent.carrier_name == carrier_name
        )
        .order_by(CarrierEvent.timestamp, CarrierEvent.line_number)
    )
    events = result.scalars().all()

    return {
        "carrier_name": carrier_name,
        "total_events": len(events),
        "events": [
            {
                "id": e.id,
                "timestamp": e.timestamp,
                "line_number": e.line_number,
                "event_type": e.event_type,
                "carrier_type": e.carrier_type,
                "state": e.state,
                "operation": e.operation,
                "direction": e.direction,
                "message_type": e.message_type
            }
            for e in events
        ]
    }
