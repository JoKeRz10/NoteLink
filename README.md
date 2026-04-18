# 🚀 NoteLink: High-Performance AI Research & Knowledge System

NoteLink is a premium, high-performance platform for note-taking, analysis, and research. It transforms the way you capture knowledge from YouTube, the Web, and personal notes by leveraging **SQLite FTS5**, **Model Context Protocol (MCP)**, and Local/Cloud AI.

---

## 🔥 Key Features & Optimizations

### 🏎️ High-Performance Database Engine
- **Instant Search (FTS5)**: Near-instant full-text search across thousands of notes and massive video transcripts using SQLite's virtual table indexing.
- **Delta Sync Protocol**: Optimized backend synchronization that only updates modified records, reducing disk I/O and saving battery life.
- **Lazy Loading Architecture**: Metadata-first note retrieval that keeps the UI responsive even with large datasets.

### 🧠 Intelligent AI Persistence
- **Summarization Memory**: AI-generated summaries are cached in the database. Open a note, and your summary appears in milliseconds without re-invoking the AI.
- **Permanent URL Analysis**: Summaries generated from YouTube or Web links are now permanently stored in the DB (migrated from volatile LocalStorage).
- **Smart Invalidation**: The system intelligently detects content changes to determine when a summary needs to be refreshed.

### 🍱 Multi-Cloud Integrations
Export your AI-extracted tasks and insights directly to your favorite tools:
- **Notion**: Database-synced research archives.
- **Trello**: Automated task boards for planning.
- **Google Calendar**: Timeline-managed deadlines.
- **Obsidian**: Local-first markdown knowledge base.

---

## ✨ Features

- **AI Summarizer & Narrator**: 
    - **📄 Text Summary**: Deep, structured professional overviews.
    - **🎧 Voice Narration**: Auditory-optimized scripts with real-time text-to-speech.
- **Automated Metadata Extraction**: Uses `yt-dlp` and `BeautifulSoup` to fetch actual video/article titles and metadata automatically.
- **Multilingual Support**: Smart language handling that preserves Arabic for text summaries while providing High-Quality English narration.

---

## 🏗️ Technical Stack

- **Frontend**: React + Vite, Framer Motion, Lucide Icons.
- **Backend**: FastAPI, Python (Uvicorn).
- **Database**: SQLite with **FTS5** (Full-Text Search) and **Delta Sync**.
- **AI Engine**: 
    - **Local**: Ollama (Gemma 4/llama3).
    - **Cloud**: Google Gemini Pro (via API).
    - **Transcription**: OpenAI Whisper (Local).
- **Protocol**: Model Context Protocol (MCP) for standardized tool execution.

---

## 🚦 Installation & Setup

### Prerequisites
- **Node.js**: For the React frontend.
- **Python 3.10+**: For the FastAPI backend.
- **Ollama**: (Optional) For local-only AI processing.
- **FFmpeg**: Required for transcribing media files.

### 1. Backend Setup
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### 2. Frontend Setup
```bash
npm install
npm run dev
```

---

## 🛠️ GitHub Tracking & Privacy
- **Device-Local Data**: Your database (`notes.db`) and secrets (`.env`) are automatically ignored by Git to ensure your research stays private on your machine.
- **Unified Settings**: Configure AI providers, API keys, and cloud integrations via the native settings dashboard.

---
**Developed for researchers who value privacy, performance, and speed.**
