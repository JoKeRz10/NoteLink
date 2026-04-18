from mcp.server.fastmcp import FastMCP
import sqlite3
import os
from .database import SessionLocal
from .services import optimization_layer

# Initialize FastMCP server
mcp = FastMCP("NoteTaking")

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "notes.db")

def get_db_conn():
    return sqlite3.connect(DB_PATH)

@mcp.tool()
async def read_current_note(note_id: str) -> str:
    """Fetches the text of a specific note by ID."""
    with get_db_conn() as conn:
        c = conn.cursor()
        c.execute("SELECT content FROM notes WHERE id = ?", (note_id,))
        row = c.fetchone()
        return row[0] if row else "Note not found."

@mcp.tool()
async def search_notes(query: str) -> list:
    """Searches the user's database using high-performance FTS5."""
    with get_db_conn() as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        # High performance Full-Text Search using MATCH
        try:
            c.execute("""
                SELECT id, title, content 
                FROM notes 
                JOIN notes_fts ON notes.rowid = notes_fts.rowid 
                WHERE notes_fts MATCH ? 
                ORDER BY rank
            """, (query,))
            rows = c.fetchall()
        except sqlite3.OperationalError:
            # Fallback if FTS5 is not ready or has issues
            c.execute("SELECT id, title, content FROM notes WHERE title LIKE ? OR content LIKE ?", 
                      (f'%{query}%', f'%{query}%'))
            rows = c.fetchall()
            
        return [dict(r) for r in rows]

@mcp.tool()
async def save_ai_summary(note_id: str, summary: str) -> str:
    """Appends an AI-generated summary to a note's content and updates search index."""
    with get_db_conn() as conn:
        c = conn.cursor()
        c.execute("SELECT content FROM notes WHERE id = ?", (note_id,))
        row = c.fetchone()
        if row:
            new_content = row[0] + f"\n\n--- AI SUMMARY ---\n{summary}"
            c.execute("UPDATE notes SET content = ? WHERE id = ?", (new_content, note_id))
            # Refresh FTS index for this change
            c.execute("INSERT INTO notes_fts(notes_fts) VALUES('rebuild')")
            conn.commit()
            return "Summary saved successfully."
        return "Note not found."

@mcp.tool()
async def fetch_web_content(url: str) -> str:
    """Fetches text content from a website or article."""
    import httpx
    from bs4 import BeautifulSoup
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(url)
            if 'text/html' in resp.headers.get('content-type', ''):
                soup = BeautifulSoup(resp.text, 'html.parser')
                title = soup.title.string if soup.title else "No Title"
                for tag in soup(["script", "style", "nav", "footer", "header"]):
                    tag.decompose()
                text = " ".join(soup.stripped_strings)
                return f"SOURCE TITLE: {title}\n\nCONTENT: {text[:20000]}"
            return "Error: Unsupported content type."
    except Exception as e:
        return f"Fetch error: {str(e)}"

@mcp.tool()
async def transcribe_youtube(url: str) -> str:
    """Transcribes a YouTube video using Transcript API or Whisper fallback."""
    import yt_dlp
    from youtube_transcript_api import YouTubeTranscriptApi
    
    video_id = ""
    # Extract ID
    if "v=" in url: video_id = url.split("v=")[1].split("&")[0]
    elif "youtu.be/" in url: video_id = url.split("youtu.be/")[1].split("?")[0]
    
    if not video_id: return "Invalid YouTube URL."

    # Initialize variables
    title, description, transcript_text = "Unknown", "", ""
    
    # 0. Get Metadata for context
    try:
        ydl_opts = {'skip_download': True, 'quiet': True}
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            title = info.get('title', 'No Title')
            description = info.get('description', '')
    except: pass

    # Attempt 1: YouTube Transcript API (Most Efficient)
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        
        # Priority 1: Search for Manual or Auto-generated in Arabic or English
        try:
            # This looks for both manual and auto-generated
            transcript_obj = transcript_list.find_transcript(['ar', 'en'])
        except:
            # Priority 2: Try to find auto-generated specifically if the above failed
            try:
                transcript_obj = transcript_list.find_generated_transcript(['ar', 'en'])
            except:
                # Priority 3: Just get the first available transcript (any type/language)
                transcript_obj = next(iter(transcript_list))
        
        transcript_text = " ".join([s['text'] for s in transcript_obj.fetch()])
        print(f"DEBUG: Successfully fetched transcript ({transcript_obj.language})")
    except:
        # Attempt 2: yt-dlp to find subtitle URL (Alternative)
        try:
            import yt_dlp
            print("Transcript API failed, trying yt-dlp for subtitles...")
            ydl_opts = {'skip_download': True, 'writeautomaticsub': True, 'quiet': True}
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                # Note: Extracting full text from yt-dlp info requires fetching the URL in subs
                # For now, we move to Whisper if this is hitting a wall
                pass 
        except: pass
        
        # Attempt 3: Whisper (Final Fallback for guaranteed content)
        if not transcript_text:
            try:
                print("Falling back to Whisper Transcription...")
                import whisper, tempfile, subprocess
                with tempfile.TemporaryDirectory() as tmpdir:
                    audio_path = os.path.join(tmpdir, "audio.webm")
                    wav_path = os.path.join(tmpdir, "audio.wav")
                    with yt_dlp.YoutubeDL({'format': 'bestaudio/best', 'outtmpl': audio_path, 'quiet': True}) as ydl:
                        ydl.download([url])
                    subprocess.run(["ffmpeg", "-y", "-i", audio_path, "-ar", "16000", "-ac", "1", wav_path], 
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    model = whisper.load_model("base")
                    transcript_text = model.transcribe(wav_path)["text"]
            except Exception as e:
                print(f"Whisper failed: {e}")
                if not transcript_text:
                    transcript_text = "(Video transcript unavailable. Analyzing description.)"

    # Final structured response
    return (
        f"=== VIDEO TITLE ===\n{title}\n\n"
        f"=== ACTUAL VIDEO TRANSCRIPT (PRIMARY CONTENT/SPEECH) ===\n{transcript_text}\n\n"
        f"=== VIDEO METADATA / DESCRIPTION (BOILERPLATE - IGNORE LINKS/EMAILS) ===\n{description}"
    )[:28000]

@mcp.tool()
async def turn_text_into_tasks(text: str) -> str:
    """Turns raw text into a list of actionable tasks with caching."""
    db = SessionLocal()
    try:
        # Get settings for AI
        with sqlite3.connect(DB_PATH) as conn:
            c = conn.cursor()
            c.execute("SELECT key, value FROM settings WHERE key IN ('ai_provider', 'ai_api_key')")
            settings_rows = dict(c.fetchall())
        
        ai_provider = settings_rows.get("ai_provider", "local")
        ai_api_key = settings_rows.get("ai_api_key", "")

        return await optimization_layer.get_or_create_tasks(db, text, ai_provider, ai_api_key)
    finally:
        db.close()

@mcp.tool()
async def turn_pdf_into_tasks(pdf_path: str) -> str:
    """Reads a local PDF file and extracts a list of tasks from its contents."""
    import PyPDF2
    try:
        with open(pdf_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            text = " ".join([page.extract_text() for page in reader.pages if page.extract_text()])
        return await turn_text_into_tasks(text)
    except Exception as e:
        return f"Error reading PDF: {str(e)}"

@mcp.tool()
async def save_tasks_to_notion(tasks: str, api_key: str = "", database_id: str = "") -> str:
    """Saves a markdown formatted list of tasks to Notion."""
    import httpx
    # If keys are missing, we can fetch from DB
    if not api_key or not database_id:
        with get_db_conn() as conn:
            c = conn.cursor()
            c.execute("SELECT key, value FROM settings WHERE key IN ('notion_api_key', 'notion_data_source_id')")
            settings = {r[0]: r[1] for r in c.fetchall()}
            api_key = api_key or settings.get("notion_api_key")
            database_id = database_id or settings.get("notion_data_source_id")

    if not api_key or not database_id:
        return "Error: Notion API key and Data Source ID are required. Please provide them or configure them in NoteLink settings."

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            payload = {
                "notion_api_key": api_key,
                "notion_data_source_id": database_id,
            }
            task_lines = [line.replace('- [ ]', '').replace('- [x]', '').strip() for line in tasks.split('\n') if line.strip().startswith('- [')]
            if task_lines:
                payload["tasks"] = task_lines
            else:
                payload["title"] = "Generated Tasks"
                payload["content"] = tasks
            
            response = await client.post("http://127.0.0.1:8002/export/notion", json=payload)
            if response.status_code == 200:
                data = response.json()
                return f"Successfully saved to Notion. URL: {data.get('url', 'Unknown URL')}"
            return f"Failed to save to Notion: {response.text}"
    except Exception as e:
        return f"Error connecting to backend for Notion export: {str(e)}"

@mcp.tool()
async def save_tasks_to_obsidian(tasks: str) -> str:
    """Provides a URI for Obsidian export."""
    import urllib.parse
    title = urllib.parse.quote('Generated Tasks')
    content = urllib.parse.quote(tasks)
    return f"To export to Obsidian, tell the user to click or open this link: obsidian://new?name={title}&content={content}"

@mcp.tool()
async def save_tasks_to_google_calendar(tasks: str) -> str:
    """Google Calendar export notification."""
    return "Google Calendar export requires Google OAuth authentication, which can only be done securely through the NoteLink web UI. Please instruct the user to use the 'To Google Calendar' button in the NoteLink application for this export."

@mcp.tool()
async def save_tasks_to_notes(tasks: str, note_title: str = "Generated Tasks") -> str:
    """Saves tasks to the local NoteLink SQLite database as a new note."""
    import time
    note_id = str(time.time()).replace('.', '')
    with get_db_conn() as conn:
        c = conn.cursor()
        c.execute("INSERT INTO notes (id, title, content, lastModified) VALUES (?, ?, ?, ?)",
                  (note_id, note_title, tasks, int(time.time() * 1000)))
        conn.commit()
    return f"Successfully saved to NoteLink notes with ID {note_id}."

if __name__ == "__main__":
    mcp.run()
