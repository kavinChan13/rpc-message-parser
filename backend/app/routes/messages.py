"""
Message API Routes - RPC and Error Messages
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database import get_db, LogFile, RPCMessage, ErrorMessage, User
from ..auth import get_current_user
from ..schemas import (
    RPCMessageResponse, RPCMessageDetail, RPCMessageList,
    ErrorMessageResponse, ErrorMessageDetail, ErrorMessageList,
    ParseStatistics
)


router = APIRouter(prefix="/messages", tags=["消息查询"])


@router.get("/{file_id}/rpc", response_model=RPCMessageList)
async def get_rpc_messages(
    file_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    message_type: Optional[str] = Query(None, description="rpc, rpc-reply, notification"),
    direction: Optional[str] = Query(None, description="DU->RU, RU->DU"),
    operation: Optional[str] = Query(None, description="操作类型筛选"),
    keyword: Optional[str] = Query(None, description="XML 内容关键字搜索"),
    sort_by: Optional[str] = Query(
        None,
        description="排序字段: response_time（按响应时间排序）"
    ),
    sort_order: Optional[str] = Query(
        "asc",
        description="排序方向: asc / desc",
        pattern="^(asc|desc)$"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取 RPC 消息列表"""
    # Verify file ownership
    file_result = await db.execute(
        select(LogFile)
        .where(LogFile.id == file_id, LogFile.user_id == current_user.id)
    )
    log_file = file_result.scalar_one_or_none()

    if not log_file:
        raise HTTPException(status_code=404, detail="文件不存在")

    # Build query
    query = select(RPCMessage).where(RPCMessage.log_file_id == file_id)
    count_query = select(func.count(RPCMessage.id)).where(RPCMessage.log_file_id == file_id)

    if message_type:
        query = query.where(RPCMessage.message_type == message_type)
        count_query = count_query.where(RPCMessage.message_type == message_type)

    if direction:
        query = query.where(RPCMessage.direction == direction)
        count_query = count_query.where(RPCMessage.direction == direction)

    if operation:
        query = query.where(RPCMessage.operation.contains(operation))
        count_query = count_query.where(RPCMessage.operation.contains(operation))

    # Keyword search in XML content
    if keyword:
        query = query.where(RPCMessage.xml_content.contains(keyword))
        count_query = count_query.where(RPCMessage.xml_content.contains(keyword))

    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Sorting
    if sort_by == "response_time":
        if sort_order == "desc":
            query = query.order_by(RPCMessage.response_time_ms.desc().nullslast())
        else:
            query = query.order_by(RPCMessage.response_time_ms.asc().nullslast())
    else:
        query = query.order_by(RPCMessage.line_number)

    # Get paginated results
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    messages = result.scalars().all()

    return RPCMessageList(
        messages=messages,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{file_id}/rpc/{message_id}", response_model=RPCMessageDetail)
async def get_rpc_message_detail(
    file_id: int,
    message_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取 RPC 消息详情"""
    # Verify file ownership
    file_result = await db.execute(
        select(LogFile)
        .where(LogFile.id == file_id, LogFile.user_id == current_user.id)
    )
    if not file_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="文件不存在")

    # Get message
    result = await db.execute(
        select(RPCMessage)
        .where(RPCMessage.id == message_id, RPCMessage.log_file_id == file_id)
    )
    message = result.scalar_one_or_none()

    if not message:
        raise HTTPException(status_code=404, detail="消息不存在")

    return message


@router.get("/{file_id}/errors", response_model=ErrorMessageList)
async def get_error_messages(
    file_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    error_type: Optional[str] = Query(None, description="rpc-error, fault, warning"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取错误消息列表"""
    # Verify file ownership
    file_result = await db.execute(
        select(LogFile)
        .where(LogFile.id == file_id, LogFile.user_id == current_user.id)
    )
    if not file_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="文件不存在")

    # Build query
    query = select(ErrorMessage).where(ErrorMessage.log_file_id == file_id)
    count_query = select(func.count(ErrorMessage.id)).where(ErrorMessage.log_file_id == file_id)

    if error_type:
        query = query.where(ErrorMessage.error_type == error_type)
        count_query = count_query.where(ErrorMessage.error_type == error_type)

    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Get paginated results
    query = query.order_by(ErrorMessage.line_number).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    messages = result.scalars().all()

    return ErrorMessageList(
        messages=messages,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{file_id}/errors/{error_id}", response_model=ErrorMessageDetail)
async def get_error_message_detail(
    file_id: int,
    error_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取错误消息详情"""
    # Verify file ownership
    file_result = await db.execute(
        select(LogFile)
        .where(LogFile.id == file_id, LogFile.user_id == current_user.id)
    )
    if not file_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="文件不存在")

    # Get message
    result = await db.execute(
        select(ErrorMessage)
        .where(ErrorMessage.id == error_id, ErrorMessage.log_file_id == file_id)
    )
    message = result.scalar_one_or_none()

    if not message:
        raise HTTPException(status_code=404, detail="消息不存在")

    return message


@router.get("/{file_id}/statistics", response_model=ParseStatistics)
async def get_statistics(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取解析统计"""
    # Verify file ownership
    file_result = await db.execute(
        select(LogFile)
        .where(LogFile.id == file_id, LogFile.user_id == current_user.id)
    )
    log_file = file_result.scalar_one_or_none()

    if not log_file:
        raise HTTPException(status_code=404, detail="文件不存在")

    # Message type counts
    type_result = await db.execute(
        select(RPCMessage.message_type, func.count(RPCMessage.id))
        .where(RPCMessage.log_file_id == file_id)
        .group_by(RPCMessage.message_type)
    )
    type_counts = dict(type_result.all())

    # Operation counts
    op_result = await db.execute(
        select(RPCMessage.operation, func.count(RPCMessage.id))
        .where(RPCMessage.log_file_id == file_id, RPCMessage.operation.isnot(None))
        .group_by(RPCMessage.operation)
    )
    op_counts = dict(op_result.all())

    # Direction counts
    dir_result = await db.execute(
        select(RPCMessage.direction, func.count(RPCMessage.id))
        .where(RPCMessage.log_file_id == file_id)
        .group_by(RPCMessage.direction)
    )
    dir_counts = dict(dir_result.all())

    # Error counts
    err_result = await db.execute(
        select(func.count(ErrorMessage.id))
        .where(ErrorMessage.log_file_id == file_id)
    )
    error_count = err_result.scalar() or 0

    # Fault counts
    fault_result = await db.execute(
        select(func.count(ErrorMessage.id))
        .where(ErrorMessage.log_file_id == file_id, ErrorMessage.error_type == 'fault')
    )
    fault_count = fault_result.scalar() or 0

    # Response time stats
    resp_result = await db.execute(
        select(
            func.avg(RPCMessage.response_time_ms),
            func.max(RPCMessage.response_time_ms),
            func.min(RPCMessage.response_time_ms)
        )
        .where(
            RPCMessage.log_file_id == file_id,
            RPCMessage.response_time_ms.isnot(None)
        )
    )
    resp_stats = resp_result.one()

    return ParseStatistics(
        total_lines=log_file.total_lines,
        total_messages=log_file.total_messages,
        rpc_count=type_counts.get('rpc', 0),
        rpc_reply_count=type_counts.get('rpc-reply', 0),
        notification_count=type_counts.get('notification', 0),
        error_count=error_count,
        fault_count=fault_count,
        operation_stats=op_counts,
        direction_stats=dir_counts,
        avg_response_time_ms=resp_stats[0],
        max_response_time_ms=resp_stats[1],
        min_response_time_ms=resp_stats[2]
    )
