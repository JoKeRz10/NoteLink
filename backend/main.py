from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
import sqlite3
import os
import json
import sys
import database
import models
from services import storage_service, optimization_layer
from sqlalchemy.orm import Session
from fastapi import Depends

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

app = FastAPI()

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "notes.db")

# Global connection helper to avoid repeated file opens
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Access columns by name
    return conn

# Initialize both old SQLite and new SQLAlchemy
def init_db():
    # Old SQLite init
    with get_db() as conn:
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS notes
                     (id TEXT PRIMARY KEY, title TEXT, content TEXT, lastModified INTEGER, ai_summary TEXT)''')
        c.execute('''CREATE TABLE IF NOT EXISTS url_summaries
                     (id TEXT PRIMARY KEY, url TEXT, title TEXT, summary TEXT, mode TEXT, timestamp INTEGER)''')
        c.execute('''CREATE TABLE IF NOT EXISTS settings
                     (key TEXT PRIMARY KEY, value TEXT)''')
        try:
            c.execute("CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(title, content, content='notes', content_rowid='rowid')")
        except sqlite3.OperationalError:
            print("FTS5 not supported, skipping search optimization.")
        conn.commit()
    
    # New SQLAlchemy init
    # New SQLAlchemy init
    database.Base.metadata.create_all(bind=database.engine)

init_db()

@app.post("/settings")
async def save_settings(settings: dict = Body(...)):
    with get_db() as conn:
        c = conn.cursor()
        for k, v in settings.items():
            c.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (k, v))
        conn.commit()
    return {"status": "success"}

@app.get("/settings")
async def get_settings():
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT key, value FROM settings")
        rows = c.fetchall()
    return {r["key"]: r["value"] for r in rows}

@app.post("/sync")
async def sync_notes(notes: list = Body(...)):
    """Delta Sync: Preserves AI summaries if content hasn't changed."""
    with get_db() as conn:
        c = conn.cursor()
        
        # 1. Get existing IDs
        incoming_ids = [note['id'] for note in notes if note.get('type') == 'file']
        
        # 2. Efficient deletion
        if incoming_ids:
            placeholders = ','.join(['?'] * len(incoming_ids))
            c.execute(f"DELETE FROM notes WHERE id NOT IN ({placeholders})", incoming_ids)
        else:
            c.execute("DELETE FROM notes")

        # 3. Smart Merge: Preserve AI summary if content is identical
        for note in notes:
            if note.get('type') == 'file':
                # Check current content
                c.execute("SELECT content, ai_summary FROM notes WHERE id = ?", (note['id'],))
                existing = c.fetchone()
                
                # If content matches exactly, keep the old summary
                final_summary = existing["ai_summary"] if existing and existing["content"] == note["content"] else None
                
                c.execute(
                    "INSERT OR REPLACE INTO notes (id, title, content, lastModified, ai_summary) VALUES (?, ?, ?, ?, ?)",
                    (note['id'], note['title'], note['content'], note['lastModified'], final_summary)
                )
            
        c.execute("INSERT INTO notes_fts(notes_fts) VALUES('rebuild')")
        conn.commit()
    return {"status": "success"}

import urllib.parse

def extract_youtube_video_id(url):
    parsed = urllib.parse.urlparse(url)
    if parsed.hostname == 'youtu.be':
        return parsed.path[1:]
    if parsed.hostname in ('www.youtube.com', 'youtube.com'):
        if parsed.path == '/watch':
            p = urllib.parse.parse_qs(parsed.query)
            return p.get('v', [None])[0]
        if parsed.path.startswith('/embed/'):
            return parsed.path.split('/')[2]
        if parsed.path.startswith('/v/'):
            return parsed.path.split('/')[2]
    return None

# Core transcription and fetching logic moved to mcp_server.py

async def get_url_metadata(url: str):
    """Fetch the title of the video or web page with multi-stage fallback."""
    print(f"DEBUG: Fetching metadata for {url}")
    try:
        if "youtube" in url or "youtu.be" in url:
            import yt_dlp
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': True,
                'skip_download': True
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                title = info.get('title')
                if title: return f"VIDEO: {title}"
        
        # Generic Web Fallback
        import requests
        from bs4 import BeautifulSoup
        headers = {'User-Agent': 'Mozilla/5.0'}
        resp = requests.get(url, timeout=5, headers=headers)
        soup = BeautifulSoup(resp.text, 'html.parser')
        title = soup.title.string.strip() if soup.title else None
        if title: return f"PAGE: {title}"
        
        return "Analysis Result"
    except Exception as e:
        print(f"Metadata Fetch Error: {str(e)}")
        return "Untitled Analysis"

@app.post("/summarize")
async def summarize_note(
    note_id: str = Body(None), 
    content: str = Body(None),
    url: str = Body(None),
    options: dict = Body(None),
    prompt: str = Body(None)
):
    """Generates AI response based on content, url, or note_id."""
    
    length = options.get('length', 150) if options else 150
    duration = options.get('duration', 120) if options else 120
    mode = options.get('mode', 'text') if options else 'text'

    title = "Analysis Result"
    if url:
        title = await get_url_metadata(url)
        print(f"DEBUG: URL Analysis | Title: {title} | Mode: {mode}")
        from mcp_server import transcribe_youtube, fetch_web_content
        if "youtube.com" in url or "youtu.be" in url:
            content = await transcribe_youtube(url)
        else:
            content = await fetch_web_content(url)

    if not content:
        if not note_id:
            raise HTTPException(status_code=400, detail="Either note_id, url, or content must be provided.")
        
        # SMART RETRIEVAL: Check if we already have a summary for this note
        # Use new optimization layer first if possible
        db = database.SessionLocal()
        try:
            # Get settings for AI
            with get_db() as conn:
                c = conn.cursor()
                c.execute("SELECT key, value FROM settings WHERE key IN ('ai_provider', 'ai_api_key')")
                settings_rows = dict(c.fetchall())
            
            ai_provider = settings_rows.get("ai_provider", "local")
            ai_api_key = settings_rows.get("ai_api_key", "")

            # Check if note exists in old DB to get content
            with get_db() as conn:
                c = conn.cursor()
                c.execute("SELECT content, ai_summary FROM notes WHERE id = ?", (note_id,))
                row = c.fetchone()
                if row:
                    content = row["content"]
                    # Try to get cached summary from optimization layer
                    cached_summary = await optimization_layer.get_or_create_summary(
                        db, content, length, mode, ai_provider, ai_api_key
                    )
                    return {"summary": cached_summary, "title": "Optimized Analysis", "cached": True}
        finally:
            db.close()

        # Fallback to old MCP logic if content still not found
        try:
            from mcp_server import read_current_note
            content = await read_current_note(note_id)
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"MCP Tool Error: {str(e)}")
    
    if content == "Note not found.":
        raise HTTPException(status_code=404, detail="Note not found.")
    
    # Refined prompt for holistic analysis of the entire content
    mode_instruction = "Provide a deep, professional text summary." if mode == 'text' else "Provide a detailed narration-style script / transcription."
    prompt_settings = f"MODE: {mode_instruction}. TARGET LENGTH: {length} words. "
    if url and ("youtube" in url or "youtu.be" in url):
        prompt_settings += f"IMPORTANT: Analyze the ENTIRE video transcript provided below. Do not truncate the source material. Your summary must cover all major points from start to finish within the requested {length} word limit."

    # Dynamic language logic based on mode
    if mode == 'audio':
        lang_instruction = "IMPORTANT: For this Voice Narration script, you MUST respond in ENGLISH exclusively, even if the source video/content is in Arabic or another language. This is to ensure compatibility with audio playback systems."
    else:
        lang_instruction = "IMPORTANT: You MUST respond in the SAME language as the source content. If the content is in Arabic, provide the summary in professional Arabic. If it is in English, use professional English."

    default_prompt = (
        f"{prompt_settings}\n"
        "Analyze the provided content and provide the requested output. "
        f"{lang_instruction}\n"
        "Focus STRICTLY on the actual narrative, educational, or informative content. "
        "Ignore all social media links, donation platforms (PayPal, etc.), contact emails, "
        "and generic channel support information."
    )
    
    final_prompt = prompt if prompt else f"{default_prompt}\n\nCONTENT TO ANALYZE:\n{content}"
    
    # If the prompt contains a placeholder for content, we can use it
    if "{content}" in final_prompt:
        final_prompt = final_prompt.format(content=content)
    else:
        # If not formatted, we've already prepended it above in the default case 
        # but let's ensure it's handled if a custom prompt was passed without {content}
        if prompt and content not in final_prompt:
             final_prompt = f"{prompt}\n\nCONTENT:\n{content}"

    # Fetch AI settings
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT key, value FROM settings WHERE key IN ('ai_provider', 'ai_api_key')")
    settings_rows = dict(c.fetchall())
    conn.close()
    
    ai_provider = settings_rows.get("ai_provider", "local")
    ai_api_key = settings_rows.get("ai_api_key", "")

    print(f"DEBUG: Constructing prompt for {ai_provider}. Model: gemma4:latest/gemini-2.5-flash")
    try:
        async with httpx.AsyncClient(timeout=None) as client:
            if ai_provider == "gemini" and ai_api_key:
                print("DEBUG: Calling Google Gemini API...")
                gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={ai_api_key}"
                response = await client.post(gemini_url, json={
                    "contents": [{"parts": [{"text": final_prompt}]}]
                })
                
                print(f"DEBUG: Gemini response status: {response.status_code}")
                if response.status_code != 200:
                    return {"summary": f"Error: Gemini API error: {response.text}"}
                
                data = response.json()
                try:
                    ai_response = data["candidates"][0]["content"]["parts"][0]["text"]
                except (KeyError, IndexError):
                    return {"summary": "Error parsing Gemini response."}
            else:
                print(f"DEBUG: Calling Ollama API at {OLLAMA_URL}...")
                response = await client.post(OLLAMA_URL, json={
                    "model": "gemma4:latest",
                    "prompt": final_prompt,
                    "stream": False
                })
                
                print(f"DEBUG: Ollama response status: {response.status_code}")
                if response.status_code != 200:
                    return {"summary": "Error: Ollama is not responding correctly. Check server logs."}
                
                result = response.json()
                ai_response = result.get("response", "Could not generate response.")
            
            print(f"DEBUG: AI Generation complete. Saving to DB...")
            
            # PERSISTENCE: Save the summary if it's tied to a note_id
            if note_id and ai_response:
                with get_db() as conn:
                    c = conn.cursor()
                    c.execute("UPDATE notes SET ai_summary = ? WHERE id = ?", (ai_response, note_id))
                    conn.commit()

            return {"summary": ai_response, "title": title, "cached": False}

            
    except Exception as e:
        import traceback
        print(f"AI Generation Error: {str(e)}")
        print(traceback.format_exc())
        return {"summary": f"Connection Error: {str(e)}", "title": title}



@app.get("/notes")
async def get_notes(full: bool = False):
    """Fetches notes. Use full=true to get content, otherwise returns metadata only."""
    with get_db() as conn:
        c = conn.cursor()
        if full:
            c.execute("SELECT id, title, content, lastModified FROM notes")
            rows = c.fetchall()
            return [dict(r) for r in rows]
        else:
            # OPTIMIZATION: Metadata only by default to save bandwidth
            c.execute("SELECT id, title, lastModified FROM notes")
            rows = c.fetchall()
            return [dict(r) for r in rows]

@app.get("/notes/{note_id}")
async def get_note_detail(note_id: str):
    """Fetch specific note content only when needed."""
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM notes WHERE id = ?", (note_id,))
        row = c.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Note not found")
        return dict(row)

@app.get("/url_summaries")
async def get_url_summaries():
    """Fetches all persistent URL analysis summaries."""
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM url_summaries ORDER BY timestamp DESC")
        rows = c.fetchall()
        return [dict(r) for r in rows]

@app.post("/url_summaries")
async def save_url_summary(summary: dict = Body(...)):
    """Saves or updates a URL analysis summary."""
    with get_db() as conn:
        c = conn.cursor()
        c.execute(
            "INSERT OR REPLACE INTO url_summaries (id, url, title, summary, mode, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
            (summary['id'], summary['url'], summary['title'], summary['summary'], summary['mode'], summary['timestamp'])
        )
        conn.commit()
    return {"status": "success"}

@app.delete("/url_summaries/{summary_id}")
async def delete_url_summary(summary_id: str):
    """Deletes a URL analysis summary."""
    with get_db() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM url_summaries WHERE id = ?", (summary_id,))
        conn.commit()
    return {"status": "success"}

from fastapi import UploadFile, File, Form
import tempfile
import shutil

@app.post("/upload")
async def handle_file_upload(
    file: UploadFile = File(...), 
    type: str = Form("auto"),
    db: Session = Depends(database.get_db)
):
    """Extracts text from various file types with hashing and caching."""
    filename = file.filename
    print(f"DEBUG: Processing file upload: {filename} (Type: {type})")
    
    # Save to storage first to calculate hash
    stored_path = storage_service.save_uploaded_file(file.file, filename)
    ext = os.path.splitext(filename)[1].lower()

    try:
        if ext == '.pdf':
            # PDF doesn't use the full media optimization layer yet in this PR, 
            # but we can still deduplicate based on content hash if we want.
            # For now, let's just use the existing PDF logic but via storage.
            import PyPDF2
            with open(stored_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                content = " ".join([page.extract_text() for page in reader.pages])
        elif ext in ['.mp3', '.mp4', '.wav', '.webm', '.m4a']:
            # Use Optimization Layer for media
            content = await optimization_layer.get_or_create_transcript(db, stored_path, 'media')
        else:
            content = f"Error: Unsupported file format {ext}."

        return {"text": content}
        
    except Exception as e:
        print(f"Extraction Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"text": f"Error: Extraction failed. ({str(e)})"}
    finally:
        # We keep the file in storage as our "Object Storage" but could delete if we wanted
        # For deduplication to work better, we should probably keep it.
        pass

@app.post("/export/notion")
async def export_to_notion(
    title: str = Body(None),
    content: str = Body(None),
    tasks: list = Body(None),
    notion_api_key: str = Body(None),
    notion_data_source_id: str = Body(None)
):
    """Exports a note to a Notion data source."""
    # Allow fallback to env vars if not provided by client
    notion_api_key = notion_api_key or os.environ.get("NOTION_API_KEY")
    notion_data_source_id = notion_data_source_id or os.environ.get("NOTION_DATA_SOURCE_ID")
    
    if not notion_api_key or not notion_data_source_id:
        raise HTTPException(
            status_code=400, 
            detail="Notion integration not fully configured. Please provide your API Key and Data Source ID."
        )
        
    import re
    match = re.search(r'([a-fA-F0-9]{8}-?[a-fA-F0-9]{4}-?[a-fA-F0-9]{4}-?[a-fA-F0-9]{4}-?[a-fA-F0-9]{12})', notion_data_source_id)
    if match:
        notion_data_source_id = match.group(1)
        
    headers = {
        "Authorization": f"Bearer {notion_api_key}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
    }

    # Cache the working configuration to avoid repeated 400s
    notion_config = {
        "parent_type": "database_id",
        "title_prop": "Name"
    }

    async def create_notion_page(client, page_title, page_content):
        chunk_size = 1900
        chunks = [page_content[i:i+chunk_size] for i in range(0, len(page_content), chunk_size)] if page_content else [""]
        children = []
        for chunk in chunks:
            if chunk:
                children.append({
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [{"type": "text", "text": {"content": chunk}}]
                    }
                })
        
        payload = {
            "parent": {notion_config["parent_type"]: notion_data_source_id},
            "properties": {notion_config["title_prop"]: {"title": [{"text": {"content": page_title or "Untitled"}}]}},
            "children": children[:100]
        }
        
        resp = await client.post("https://api.notion.com/v1/pages", json=payload, headers=headers)
        
        # Fallbacks (only triggers if the cached config is wrong, which should only be the first time)
        if resp.status_code != 200 and "property" in resp.text.lower():
            notion_config["title_prop"] = "title"
            payload["properties"] = {notion_config["title_prop"]: {"title": [{"text": {"content": page_title or "Untitled"}}]}}
            resp = await client.post("https://api.notion.com/v1/pages", json=payload, headers=headers)

        if resp.status_code != 200 and ("database" in resp.text.lower() or resp.status_code == 404):
            notion_config["parent_type"] = "page_id"
            notion_config["title_prop"] = "title"
            payload["parent"] = {notion_config["parent_type"]: notion_data_source_id}
            payload["properties"] = {notion_config["title_prop"]: {"title": [{"text": {"content": page_title or "Untitled"}}]}}
            resp = await client.post("https://api.notion.com/v1/pages", json=payload, headers=headers)

        if resp.status_code != 200:
            raise Exception(resp.json().get('message', 'Unknown error'))
        return resp.json().get('url')

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            if tasks and len(tasks) > 0:
                urls = []
                for task in tasks:
                    url = await create_notion_page(client, task, "")
                    if url: urls.append(url)
                return {"status": "success", "url": urls[0] if urls else None}
            else:
                url = await create_notion_page(client, title, content)
                return {"status": "success", "url": url}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"detail": str(e)})

@app.post("/export/trello")
async def export_to_trello(
    title: str = Body(None),
    content: str = Body(None),
    tasks: list = Body(None),
    trello_api_key: str = Body(None),
    trello_token: str = Body(None),
    trello_list_id: str = Body(None)
):
    """Exports tasks or notes to Trello cards."""
    if not trello_api_key or not trello_token or not trello_list_id:
        raise HTTPException(
            status_code=400, 
            detail="Trello configuration missing. Please provide API Key, Token, and List ID."
        )
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            actual_list_id = trello_list_id.strip()
            import re
            board_match = re.search(r'trello\.com/b/([^/]+)', actual_list_id)
            board_id = board_match.group(1) if board_match else None
            
            if not board_id and len(actual_list_id) != 24 and actual_list_id.isalnum():
                board_id = actual_list_id
                
            if board_id:
                list_resp = await client.get(
                    f"https://api.trello.com/1/boards/{board_id}/lists",
                    params={"key": trello_api_key, "token": trello_token}
                )
                if list_resp.status_code == 200:
                    lists = list_resp.json()
                    if lists and len(lists) > 0:
                        actual_list_id = lists[0]['id']
                    else:
                        raise Exception("The specified Trello board has no lists.")
                else:
                    raise Exception(f"Failed to fetch lists for board (Trello returned: {list_resp.text})")

            results = []
            
            import datetime
            import re
            
            def parse_trello_date(text_str):
                now = datetime.datetime.utcnow()
                # Default date: tomorrow at 12:00 PM UTC
                default_date = now.replace(hour=12, minute=0, second=0) + datetime.timedelta(days=1)
                
                match = re.search(r'(?:\s-\s|\s—\s)\*?\*?([^*]+)\*?\*?$', text_str.strip())
                clean_string = text_str
                date_obj = default_date
                
                if match:
                    date_str = match.group(1).strip().lower()
                    clean_string = text_str[:match.start()].strip()
                    
                    if date_str == 'today':
                        date_obj = now.replace(hour=23, minute=59, second=59)
                    elif date_str == 'tomorrow':
                        date_obj = now.replace(hour=23, minute=59, second=59) + datetime.timedelta(days=1)
                    else:
                        try:
                            # Try to parse YYYY-MM-DD
                            parsed_date = datetime.datetime.strptime(date_str, "%Y-%m-%d")
                            date_obj = parsed_date.replace(hour=12, minute=0, second=0)
                        except ValueError:
                            try:
                                # Fallback for 'Month DD, YYYY' if AI didn't follow the exact format
                                parsed_date = datetime.datetime.strptime(date_str, "%B %d, %Y")
                                date_obj = parsed_date.replace(hour=12, minute=0, second=0)
                            except ValueError:
                                # If parsing completely fails, fallback to default date,
                                # but DO NOT restore the date text back into the clean_string.
                                pass
                            
                return clean_string, date_obj.strftime("%Y-%m-%dT%H:%M:%S.000Z")

            if tasks and len(tasks) > 0:
                for task in tasks:
                    clean_name, due_date_iso = parse_trello_date(task)
                    resp = await client.post(
                        "https://api.trello.com/1/cards", 
                        params={
                            "key": trello_api_key,
                            "token": trello_token,
                            "idList": actual_list_id,
                            "name": clean_name,
                            "due": due_date_iso
                        }
                    )
                    if resp.status_code == 200:
                        results.append(resp.json().get('shortUrl'))
                    else:
                        raise Exception(f"Trello error: {resp.text}")
            else:
                card_name = title or "New Card"
                clean_name, due_date_iso = parse_trello_date(card_name)
                resp = await client.post(
                    "https://api.trello.com/1/cards", 
                    params={
                        "key": trello_api_key,
                        "token": trello_token,
                        "idList": actual_list_id,
                        "name": clean_name,
                        "desc": content or "",
                        "due": due_date_iso
                    }
                )
                if resp.status_code == 200:
                    results.append(resp.json().get('shortUrl'))
                else:
                    raise Exception(f"Trello error: {resp.text}")
            
            return {"status": "success", "url": results[0] if results else None}
        except Exception as e:
            return JSONResponse(status_code=500, content={"detail": str(e)})

# Mount the FastMCP server via Server-Sent Events (SSE) so MCP clients can connect over HTTP
from mcp_server import mcp
app.mount("/mcp", mcp.sse_app())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
