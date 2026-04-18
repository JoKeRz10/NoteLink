from sqlalchemy.orm import Session
from models import File, Transcript, Summary, TaskCache
from utils.hashing import calculate_file_hash, calculate_text_hash
import services.processing_service as processing_service
import services.storage_service as storage_service
import uuid
import json

async def get_or_create_transcript(db: Session, file_path: str, file_type: str) -> str:
    """Checks if a file has already been transcribed, otherwise processes it."""
    file_hash = calculate_file_hash(file_path)
    
    # Check cache
    existing_file = db.query(File).filter(File.hash == file_hash).first()
    if existing_file and existing_file.transcripts:
        print(f"DEBUG: returning cached transcript for hash {file_hash}")
        return existing_file.transcripts[0].text
    
    # If not in cache, process
    text = await processing_service.transcribe_media(file_path)
    
    # Store in cache
    if not existing_file:
        existing_file = File(
            id=str(uuid.uuid4()),
            hash=file_hash,
            type=file_type,
            path=file_path
        )
        db.add(existing_file)
        db.flush()
        
    new_transcript = Transcript(
        id=str(uuid.uuid4()),
        file_id=existing_file.id,
        text=text
    )
    db.add(new_transcript)
    db.commit()
    
    return text

async def get_or_create_summary(db: Session, content: str, length: int, mode: str, ai_provider: str, ai_api_key: str) -> str:
    """Checks if a summary already exists for the given content and parameters."""
    content_hash = calculate_text_hash(content)
    
    # Cache key includes content hash, length, and mode
    existing_summary = db.query(Summary).filter(
        Summary.input_hash == content_hash,
        Summary.length == length,
        Summary.type == mode
    ).first()
    
    if existing_summary:
        print(f"DEBUG: returning cached summary for hash {content_hash}")
        return existing_summary.output
    
    # Process
    summary_text = await processing_service.generate_summary(content, length, mode, ai_provider, ai_api_key)
    
    # Store
    new_summary = Summary(
        id=str(uuid.uuid4()),
        input_hash=content_hash,
        type=mode,
        length=length,
        output=summary_text
    )
    db.add(new_summary)
    db.commit()
    
    return summary_text

async def get_or_create_tasks(db: Session, content: str, ai_provider: str, ai_api_key: str) -> str:
    """Checks if tasks have already been extracted for this content."""
    content_hash = calculate_text_hash(content)
    
    existing_tasks = db.query(TaskCache).filter(TaskCache.meeting_hash == content_hash).first()
    if existing_tasks:
        print(f"DEBUG: returning cached tasks for hash {content_hash}")
        # Return as string for consistent API behavior with older code
        if isinstance(existing_tasks.structured_tasks, list):
            return "\n".join([f"- [ ] {t}" for t in existing_tasks.structured_tasks])
        return existing_tasks.structured_tasks
    
    # Process
    tasks_text = await processing_service.extract_tasks(content, ai_provider, ai_api_key)
    
    # Store
    # Simple parsing: find markdown task lines
    task_list = [line.strip().replace('- [ ] ', '') for line in tasks_text.split('\n') if line.strip().startswith('- [ ')]
    
    new_task_cache = TaskCache(
        id=str(uuid.uuid4()),
        meeting_hash=content_hash,
        structured_tasks=task_list if task_list else tasks_text
    )
    db.add(new_task_cache)
    db.commit()
    
    return tasks_text
