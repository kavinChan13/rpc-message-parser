"""
File Management API Routes
"""

import uuid
import asyncio
import zipfile
import tarfile
import tempfile
import shutil
import lzma
from io import BytesIO
from pathlib import Path
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database import get_db, LogFile, RPCMessage, ErrorMessage, User
from ..auth import get_current_user
from ..schemas import LogFileResponse, LogFileList, ExtractedFilesResponse, ParseSelectedFilesRequest
from ..config import settings
from ..parser_service import LogParserService


router = APIRouter(prefix="/files", tags=["File Management"])


def is_rpc_log_file(filename: str) -> bool:
    """检查文件名是否为RPC日志文件"""
    filename_lower = filename.lower()
    # 支持 *rpc.log 格式，但排除压缩文件
    if any(filename_lower.endswith(ext) for ext in ['.xz', '.gz', '.bz2', '.zip', '.tar', '.tgz']):
        return False
    return 'rpc.log' in filename_lower


def extract_xz_file(xz_path: Path, extract_dir: Path) -> Path:
    """解压 .xz 文件"""
    output_filename = xz_path.stem  # 移除 .xz 后缀
    output_path = extract_dir / output_filename

    with lzma.open(xz_path, 'rb') as xz_file:
        with open(output_path, 'wb') as out_file:
            shutil.copyfileobj(xz_file, out_file)

    return output_path


def extract_archive_recursive(archive_path: Path, extract_to: Path) -> List[Dict[str, Any]]:
    """递归解压缩文件并返回所有RPC日志文件列表"""
    rpc_files = []

    def process_directory(directory: Path, relative_base: str = ""):
        """Process目录，查找RPC文件和嵌套压缩包"""
        for item in directory.iterdir():
            if item.is_file():
                relative_path = f"{relative_base}/{item.name}" if relative_base else item.name

                # 调试信息：打印所有找到的文件
                print(f"发现文件: {item.name}, 是否为RPC日志: {is_rpc_log_file(item.name)}")

                # 检查是否为RPC日志文件
                if is_rpc_log_file(item.name):
                    file_size = item.stat().st_size
                    print(f"✓ 添加RPC文件: {item.name}")
                    rpc_files.append({
                        "filename": item.name,
                        "relative_path": relative_path,
                        "absolute_path": str(item),
                        "size": file_size
                    })

                # 检查是否为压缩文件，递归解压
                elif item.suffix.lower() in ['.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz']:
                    nested_extract_dir = extract_to / f"nested_{uuid.uuid4().hex[:8]}"
                    nested_extract_dir.mkdir(exist_ok=True)

                    try:
                        if item.suffix.lower() == '.zip':
                            with zipfile.ZipFile(item, 'r') as zf:
                                zf.extractall(nested_extract_dir)
                        elif item.suffix.lower() == '.xz':
                            # 解压 .xz 文件
                            extracted_file = extract_xz_file(item, nested_extract_dir)
                            # 检查解压后的文件是否还是压缩文件或者是RPC日志
                            if is_rpc_log_file(extracted_file.name):
                                file_size = extracted_file.stat().st_size
                                rpc_files.append({
                                    "filename": extracted_file.name,
                                    "relative_path": f"{relative_path} -> {extracted_file.name}",
                                    "absolute_path": str(extracted_file),
                                    "size": file_size
                                })
                            elif extracted_file.suffix.lower() in ['.zip', '.tar', '.gz', '.tgz', '.bz2']:
                                # 如果解压后还是压缩文件，继续Process
                                process_directory(nested_extract_dir, relative_path)
                        elif item.suffix.lower() in ['.tar', '.gz', '.tgz', '.bz2']:
                            with tarfile.open(item, 'r:*') as tf:
                                tf.extractall(nested_extract_dir)

                        # 递归Process解压后的目录（除了已经Process的.xz文件）
                        if item.suffix.lower() != '.xz':
                            process_directory(nested_extract_dir, f"{relative_path}")
                    except Exception as e:
                        print(f"无法解压嵌套压缩文件 {item}: {e}")

            elif item.is_dir():
                relative_path = f"{relative_base}/{item.name}" if relative_base else item.name
                process_directory(item, relative_path)

    # 开始Process
    process_directory(extract_to)
    return rpc_files


@router.post("/upload", response_model=ExtractedFilesResponse)
async def upload_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """上传文件并返回所有RPC日志文件列表供用户选择"""
    filename_lower = file.filename.lower()
    is_archive = filename_lower.endswith(('.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz'))
    is_log = is_rpc_log_file(file.filename)

    if not (is_log or is_archive):
        raise HTTPException(
            status_code=400,
            detail="仅支持 .log 文件或压缩文件（.zip, .tar, .gz, .tgz, .bz2, .xz）"
        )

    content = await file.read()

    # 创建临时解压目录
    temp_extract_dir = settings.UPLOAD_DIR / str(current_user.id) / f"temp_{uuid.uuid4().hex}"
    temp_extract_dir.mkdir(parents=True, exist_ok=True)

    rpc_files = []

    try:
        if is_archive:
            # 保存压缩文件
            temp_archive = temp_extract_dir / file.filename
            with open(temp_archive, 'wb') as f:
                f.write(content)

            # 解压到临时目录
            extract_dir = temp_extract_dir / "extracted"
            extract_dir.mkdir(exist_ok=True)

            try:
                if filename_lower.endswith('.zip'):
                    with zipfile.ZipFile(temp_archive, 'r') as zf:
                        zf.extractall(extract_dir)
                elif filename_lower.endswith('.xz'):
                    # 解压单个 .xz 文件
                    extract_xz_file(temp_archive, extract_dir)
                else:
                    with tarfile.open(temp_archive, 'r:*') as tf:
                        tf.extractall(extract_dir)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"解压失败: {str(e)}")

            # 递归查找所有RPC文件
            rpc_files = extract_archive_recursive(temp_archive, extract_dir)

            print(f"总共找到 {len(rpc_files)} 个RPC文件")
            for f in rpc_files:
                print(f"  - {f['filename']}")

            if not rpc_files:
                raise HTTPException(status_code=400, detail="压缩包内未找到任何RPC日志文件（文件名需包含'RPC.log'，不区分大小写）")

        else:
            # 单个日志文件
            file_size = len(content)
            if file_size > settings.MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail=f"File size超过限制 ({settings.MAX_FILE_SIZE // 1024 // 1024}MB)"
                )

            # 保存文件
            saved_path = temp_extract_dir / file.filename
            with open(saved_path, 'wb') as f:
                f.write(content)

            rpc_files.append({
                "filename": file.filename,
                "relative_path": file.filename,
                "absolute_path": str(saved_path),
                "size": file_size
            })

        # 返回文件列表和临时目录路径
        return ExtractedFilesResponse(
            temp_directory=str(temp_extract_dir),
            original_filename=file.filename,
            files=rpc_files,
            total_files=len(rpc_files)
        )

    except HTTPException:
        # 清理临时目录
        if temp_extract_dir.exists():
            shutil.rmtree(temp_extract_dir)
        raise
    except Exception as e:
        # 清理临时目录
        if temp_extract_dir.exists():
            shutil.rmtree(temp_extract_dir)
        raise HTTPException(status_code=500, detail=f"Process文件时出错: {str(e)}")


@router.post("/parse-selected", response_model=List[LogFileResponse])
async def parse_selected_files(
    background_tasks: BackgroundTasks,
    request: ParseSelectedFilesRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Parse用户选择的文件"""
    temp_dir = Path(request.temp_directory)

    if not temp_dir.exists():
        raise HTTPException(status_code=400, detail="临时目录不存在或已过期")

    if not request.selected_files:
        raise HTTPException(status_code=400, detail="请至少选择一个文件")

    # 用户永久目录
    user_upload_dir = settings.UPLOAD_DIR / str(current_user.id)
    user_upload_dir.mkdir(exist_ok=True)

    created_files = []

    try:
        for file_info in request.selected_files:
            file_path = Path(file_info["absolute_path"])

            if not file_path.exists():
                continue

            file_size = file_path.stat().st_size
            if file_size > settings.MAX_FILE_SIZE:
                continue  # 跳过超大文件

            # 复制到永久目录
            unique_filename = f"{uuid.uuid4()}_{file_info['filename']}"
            permanent_path = user_upload_dir / unique_filename
            shutil.copy2(file_path, permanent_path)

            # 创建Database记录
            log_file = LogFile(
                filename=unique_filename,
                original_filename=f"{request.original_filename}:{file_info['relative_path']}",
                file_path=str(permanent_path),
                file_size=file_size,
                user_id=current_user.id,
                parse_status="pending"
            )
            db.add(log_file)
            await db.flush()
            await db.refresh(log_file)

            created_files.append(log_file)

            # 启动后台Parse
            background_tasks.add_task(parse_file_background, log_file.id)

        await db.commit()

        # 清理临时目录
        background_tasks.add_task(cleanup_temp_directory, str(temp_dir))

        return created_files

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"保存文件时出错: {str(e)}")


def cleanup_temp_directory(temp_dir: str):
    """清理临时目录"""
    try:
        temp_path = Path(temp_dir)
        if temp_path.exists():
            shutil.rmtree(temp_path)
    except Exception as e:
        print(f"清理临时目录失败 {temp_dir}: {e}")


async def parse_file_background(file_id: int):
    """后台Parse文件"""
    from ..database import async_session

    async with async_session() as db:
        # Get file
        result = await db.execute(select(LogFile).where(LogFile.id == file_id))
        log_file = result.scalar_one_or_none()

        if not log_file:
            return

        try:
            # Update status to parsing
            log_file.parse_status = "parsing"
            await db.commit()

            # Parse file
            parser = LogParserService(db, log_file)
            total_lines, total_messages, error_count = await parser.parse()

            # Update file record
            log_file.total_lines = total_lines
            log_file.total_messages = total_messages
            log_file.error_count = error_count
            log_file.parse_status = "completed"
            await db.commit()

        except Exception as e:
            log_file.parse_status = "failed"
            log_file.parse_error = str(e)
            await db.commit()


@router.get("", response_model=LogFileList)
async def list_files(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取用户的文件列表"""
    result = await db.execute(
        select(LogFile)
        .where(LogFile.user_id == current_user.id)
        .order_by(LogFile.upload_time.desc())
    )
    files = result.scalars().all()

    return LogFileList(files=files, total=len(files))


@router.get("/{file_id}", response_model=LogFileResponse)
async def get_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取文件详情"""
    result = await db.execute(
        select(LogFile)
        .where(LogFile.id == file_id, LogFile.user_id == current_user.id)
    )
    log_file = result.scalar_one_or_none()

    if not log_file:
        raise HTTPException(status_code=404, detail="文件不存在")

    return log_file


@router.delete("/{file_id}")
async def delete_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """删除文件"""
    result = await db.execute(
        select(LogFile)
        .where(LogFile.id == file_id, LogFile.user_id == current_user.id)
    )
    log_file = result.scalar_one_or_none()

    if not log_file:
        raise HTTPException(status_code=404, detail="文件不存在")

    # Delete physical file
    file_path = Path(log_file.file_path)
    if file_path.exists():
        file_path.unlink()

    # Delete database record (cascade will delete related messages)
    await db.delete(log_file)
    await db.commit()

    return {"message": "文件已删除"}
