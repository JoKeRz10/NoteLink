# Database Optimization Report - NoteLink

Prepared for: Ali Sameer

This document explains the data optimization layer recently implemented in the NoteLink backend to improve performance, reduce cost, and ensure data integrity.

## 1. Hashing & Content Deduplication
The core of the optimization is a **SHA-256 hashing mechanism**.
- **Uploaded Files**: Every audio, video, or PDF file is hashed upon upload. If a file with the same content is uploaded again, the system immediately recognizes it and retrieves the existing transcription instead of running Whisper again.
- **Input Text**: Text content for summaries and tasks is also hashed. This identifies identical requests regardless of the source note.

## 2. Advanced Caching Strategy
A new structured database schema (using SQLAlchemy) stores processed results:
- **`Files` Table**: Stores file metadata and hashes.
- **`Transcripts` Table**: Links transcribed text to the original file hash.
- **`Summaries` Table**: Caches AI-generated summaries based on a composite key: `(input_hash, length, mode)`. This allows storing multiple variations (different lengths or formats) for the same content.
- **`Task_Caches` Table**: Stores extracted meeting tasks in a structured format (JSON).

## 3. Lazy AI Processing
Endpoints for `/upload` and `/summarize` now follow a "Check-then-Compute" logic:
1. **Hash the input.**
2. **Query the database** for an existing match.
3. **Return instantly** if found (response time < 10ms).
4. **Process only on cache miss** (response time 10s - 60s).

## 4. Modular Architecture
The processing logic has been decoupled from the API endpoints:
- **`storage_service.py`**: Manages the "Object Storage" (local filesystem) for large media files.
- **`processing_service.py`**: Encapsulates AI model calls (Whisper, Gemini, Ollama).
- **`optimization_layer.py`**: Orchestrates the hashing, cache checking, and lazy processing logic.

## 5. Scalability & Performance
- **Indexing**: All hash columns are indexed, ensuring near-instant lookups even with thousands of records.
- **SQLAlchemy Engine**: Provides a cleaner interface for database operations and makes it easy to switch from SQLite to PostgreSQL if high concurrency is required.

---
**Summary of Benefits:**
- **Zero redundant AI calls** for identical content.
- **Massive reduction in latency** for previously processed notes.
- **Improved resilience** through structured file storage and metadata management.
