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
    """Check if filename is an RPC log file"""
    filename_lower = filename.lower()
    # Support *rpc.log format, but exclude archive files
    if any(filename_lower.endswith(ext) for ext in ['.xz', '.gz', '.bz2', '.zip', '.tar', '.tgz']):
        return False
    return 'rpc.log' in filename_lower


def extract_xz_file(xz_path: Path, extract_dir: Path) -> Path:
    """Extract .xz file"""
    output_filename = xz_path.stem  # Remove .xz extension
    output_path = extract_dir / output_filename

    with lzma.open(xz_path, 'rb') as xz_file:
        with open(output_path, 'wb') as out_file:
            shutil.copyfileobj(xz_file, out_file)

    return output_path


def extract_archive_recursive(archive_path: Path, extract_to: Path) -> List[Dict[str, Any]]:
    """Recursively extract archives and return list of all RPC log files"""
    rpc_files = []

    def process_directory(directory: Path, relative_base: str = ""):
        """Process directory, find RPC files and nested archives"""
        for item in directory.iterdir():
            if item.is_file():
                relative_path = f"{relative_base}/{item.name}" if relative_base else item.name

                # Debug info: print all found files
                print(f"Found file: {item.name}, is RPC log: {is_rpc_log_file(item.name)}")

                # Check if it's an RPC log file
                if is_rpc_log_file(item.name):
                    file_size = item.stat().st_size
                    print(f"✓ Adding RPC file: {item.name}")
                    rpc_files.append({
                        "filename": item.name,
                        "relative_path": relative_path,
                        "absolute_path": str(item),
                        "size": file_size
                    })

                # Check if it's an archive file, recursively extract
                elif item.suffix.lower() in ['.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz']:
                    nested_extract_dir = extract_to / f"nested_{uuid.uuid4().hex[:8]}"
                    nested_extract_dir.mkdir(exist_ok=True)

                    try:
                        if item.suffix.lower() == '.zip':
                            with zipfile.ZipFile(item, 'r') as zf:
                                zf.extractall(nested_extract_dir)
                        elif item.suffix.lower() == '.xz':
                            # Extract .xz file
                            extracted_file = extract_xz_file(item, nested_extract_dir)
                            # Check if extracted file is still an archive or an RPC log
                            if is_rpc_log_file(extracted_file.name):
                                file_size = extracted_file.stat().st_size
                                rpc_files.append({
                                    "filename": extracted_file.name,
                                    "relative_path": f"{relative_path} -> {extracted_file.name}",
                                    "absolute_path": str(extracted_file),
                                    "size": file_size
                                })
                            elif extracted_file.suffix.lower() in ['.zip', '.tar', '.gz', '.tgz', '.bz2']:
                                # If still an archive after extraction, continue processing
                                process_directory(nested_extract_dir, relative_path)
                        elif item.suffix.lower() in ['.tar', '.gz', '.tgz', '.bz2']:
                            with tarfile.open(item, 'r:*') as tf:
                                tf.extractall(nested_extract_dir)

                        # Recursively process extracted directory (excluding already processed .xz files)
                        if item.suffix.lower() != '.xz':
                            process_directory(nested_extract_dir, f"{relative_path}")
                    except Exception as e:
                        print(f"Unable to extract nested archive {item}: {e}")

            elif item.is_dir():
                relative_path = f"{relative_base}/{item.name}" if relative_base else item.name
                process_directory(item, relative_path)

    # Start processing
    process_directory(extract_to)
    return rpc_files


@router.post("/upload", response_model=ExtractedFilesResponse)
async def upload_file(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload file and return list of all RPC log files for user selection"""
    filename_lower = file.filename.lower()
    is_archive = filename_lower.endswith(('.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz'))
    is_log = is_rpc_log_file(file.filename)

    if not (is_log or is_archive):
        raise HTTPException(
            status_code=400,
            detail="Only .log files or archive files are supported (.zip, .tar, .gz, .tgz, .bz2, .xz)"
        )

    content = await file.read()

    # Create temporary extraction directory
    temp_extract_dir = settings.UPLOAD_DIR / str(current_user.id) / f"temp_{uuid.uuid4().hex}"
    temp_extract_dir.mkdir(parents=True, exist_ok=True)

    rpc_files = []

    try:
        if is_archive:
            # Save archive file
            temp_archive = temp_extract_dir / file.filename
            with open(temp_archive, 'wb') as f:
                f.write(content)

            # Extract to temporary directory
            extract_dir = temp_extract_dir / "extracted"
            extract_dir.mkdir(exist_ok=True)

            try:
                if filename_lower.endswith('.zip'):
                    with zipfile.ZipFile(temp_archive, 'r') as zf:
                        zf.extractall(extract_dir)
                elif filename_lower.endswith('.xz'):
                    # Extract single .xz file
                    extract_xz_file(temp_archive, extract_dir)
                else:
                    with tarfile.open(temp_archive, 'r:*') as tf:
                        tf.extractall(extract_dir)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Extraction failed: {str(e)}")

            # Recursively find all RPC files
            rpc_files = extract_archive_recursive(temp_archive, extract_dir)

            print(f"Total found {len(rpc_files)} RPC files")
            for f in rpc_files:
                print(f"  - {f['filename']}")

            if not rpc_files:
                raise HTTPException(status_code=400, detail="No RPC log files found in archive (filename must contain 'RPC.log', case-insensitive)")

        else:
            # Single log file
            file_size = len(content)
            if file_size > settings.MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail=f"File size exceeds limit ({settings.MAX_FILE_SIZE // 1024 // 1024}MB)"
                )

            # Save file
            saved_path = temp_extract_dir / file.filename
            with open(saved_path, 'wb') as f:
                f.write(content)

            rpc_files.append({
                "filename": file.filename,
                "relative_path": file.filename,
                "absolute_path": str(saved_path),
                "size": file_size
            })

        # Return file list and temporary directory path
        return ExtractedFilesResponse(
            temp_directory=str(temp_extract_dir),
            original_filename=file.filename,
            files=rpc_files,
            total_files=len(rpc_files)
        )

    except HTTPException:
        # Clean up temporary directory
        if temp_extract_dir.exists():
            shutil.rmtree(temp_extract_dir)
        raise
    except Exception as e:
        # Clean up temporary directory
        if temp_extract_dir.exists():
            shutil.rmtree(temp_extract_dir)
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@router.post("/parse-selected", response_model=List[LogFileResponse])
async def parse_selected_files(
    background_tasks: BackgroundTasks,
    request: ParseSelectedFilesRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Parse user-selected files"""
    temp_dir = Path(request.temp_directory)

    if not temp_dir.exists():
        raise HTTPException(status_code=400, detail="Temporary directory does not exist or has expired")

    if not request.selected_files:
        raise HTTPException(status_code=400, detail="Please select at least one file")

    # User permanent directory
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
                continue  # Skip oversized files

            # Copy to permanent directory
            unique_filename = f"{uuid.uuid4()}_{file_info['filename']}"
            permanent_path = user_upload_dir / unique_filename
            shutil.copy2(file_path, permanent_path)

            # Create database record
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

            # Start background parsing
            background_tasks.add_task(parse_file_background, log_file.id)

        await db.commit()

        # Clean up temporary directory
        background_tasks.add_task(cleanup_temp_directory, str(temp_dir))

        return created_files

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error saving file: {str(e)}")


def cleanup_temp_directory(temp_dir: str):
    """Clean up temporary directory"""
    try:
        temp_path = Path(temp_dir)
        if temp_path.exists():
            shutil.rmtree(temp_path)
    except Exception as e:
        print(f"Failed to clean temporary directory {temp_dir}: {e}")


async def parse_file_background(file_id: int):
    """Background file parsing"""
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
    """Get user's file list"""
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
    """Get file details"""
    result = await db.execute(
        select(LogFile)
        .where(LogFile.id == file_id, LogFile.user_id == current_user.id)
    )
    log_file = result.scalar_one_or_none()

    if not log_file:
        raise HTTPException(status_code=404, detail="File not found")

    return log_file


@router.delete("/{file_id}")
async def delete_file(
    file_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete file"""
    result = await db.execute(
        select(LogFile)
        .where(LogFile.id == file_id, LogFile.user_id == current_user.id)
    )
    log_file = result.scalar_one_or_none()

    if not log_file:
        raise HTTPException(status_code=404, detail="File not found")

    # Delete physical file
    file_path = Path(log_file.file_path)
    if file_path.exists():
        file_path.unlink()

    # Delete database record (cascade will delete related messages)
    await db.delete(log_file)
    await db.commit()

    return {"message": "File deleted"}
