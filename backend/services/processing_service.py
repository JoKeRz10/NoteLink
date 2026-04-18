try:
    import whisper
except ImportError:
    whisper = None
import os
import httpx
import sqlite3
from ..database import DB_PATH  # Still need this for settings retrieval or move settings to SQLAlchemy later

async def transcribe_media(file_path: str) -> str:
    """Transcribes audio/video using Whisper with fallback."""
    if whisper is None:
        return f"Mock Transcription for {os.path.basename(file_path)} (Whisper not installed)"
    model = whisper.load_model("base")
    result = model.transcribe(file_path)
    return result["text"]

async def generate_summary(content: str, length: int, mode: str, ai_provider: str, ai_api_key: str) -> str:
    """Generates AI summary based on content and settings."""
    OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
    
    mode_instruction = "Provide a deep, professional text summary." if mode == 'text' else "Provide a detailed narration-style script / transcription."
    prompt_settings = f"MODE: {mode_instruction}. TARGET LENGTH: {length} words. "
    
    lang_instruction = ""
    if mode == 'audio':
        lang_instruction = "IMPORTANT: For this Voice Narration script, you MUST respond in ENGLISH exclusively."
    else:
        lang_instruction = "IMPORTANT: You MUST respond in the SAME language as the source content."

    prompt = (
        f"{prompt_settings}\n"
        "Analyze the provided content and provide the requested output. "
        f"{lang_instruction}\n"
        f"CONTENT:\n{content}"
    )

    async with httpx.AsyncClient(timeout=None) as client:
        if ai_provider == "gemini" and ai_api_key:
            gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={ai_api_key}"
            response = await client.post(gemini_url, json={
                "contents": [{"parts": [{"text": prompt}]}]
            })
            if response.status_code == 200:
                return response.json()["candidates"][0]["content"]["parts"][0]["text"]
        else:
            response = await client.post(OLLAMA_URL, json={
                "model": "gemma4:latest",
                "prompt": prompt,
                "stream": False
            })
            if response.status_code == 200:
                return response.json().get("response", "Could not generate response.")
    
    return "AI generation failed."

async def extract_tasks(content: str, ai_provider: str, ai_api_key: str) -> str:
    """Extracts actionable tasks from content."""
    prompt = "Review the content below and extract all actionable tasks and to-do items. Format them as a clear markdown checklist using '- [ ] Task' syntax.\n\nCONTENT:\n" + content
    
    async with httpx.AsyncClient(timeout=None) as client:
        if ai_provider == "gemini" and ai_api_key:
            gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={ai_api_key}"
            response = await client.post(gemini_url, json={
                "contents": [{"parts": [{"text": prompt}]}]
            })
            if response.status_code == 200:
                return response.json()["candidates"][0]["content"]["parts"][0]["text"]
        else:
            response = await client.post("http://127.0.0.1:11434/api/generate", json={
                "model": "gemma4:latest",
                "prompt": prompt,
                "stream": False
            })
            if response.status_code == 200:
                return response.json().get("response", "Could not generate tasks.")
                
    return "Task extraction failed."
