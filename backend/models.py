from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
import datetime
from database import Base

class File(Base):
    __tablename__ = "files"
    id = Column(String, primary_key=True, index=True)
    hash = Column(String, index=True, unique=True)
    type = Column(String)  # 'pdf', 'audio', 'video'
    path = Column(String)  # local path or URL
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    transcripts = relationship("Transcript", back_populates="file")

class Transcript(Base):
    __tablename__ = "transcripts"
    id = Column(String, primary_key=True, index=True)
    file_id = Column(String, ForeignKey("files.id"))
    text = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    file = relationship("File", back_populates="transcripts")

class Summary(Base):
    __tablename__ = "summaries"
    id = Column(String, primary_key=True, index=True)
    input_hash = Column(String, index=True)
    type = Column(String)  # 'text', 'audio'
    length = Column(Integer)
    format = Column(String)  # 'markdown', 'plain', etc.
    output = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class TaskCache(Base):
    __tablename__ = "task_caches"
    id = Column(String, primary_key=True, index=True)
    meeting_hash = Column(String, index=True)
    structured_tasks = Column(JSON)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

# Keep Note and Settings for backward compatibility/migration
class Note(Base):
    __tablename__ = "notes"
    id = Column(String, primary_key=True, index=True)
    title = Column(String)
    content = Column(String)
    lastModified = Column(Integer)
    ai_summary = Column(String)

class Setting(Base):
    __tablename__ = "settings"
    key = Column(String, primary_key=True)
    value = Column(String)
