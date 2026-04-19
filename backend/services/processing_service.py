try:
    import whisper
except ImportError:
    whisper = None
import os
import httpx
import sqlite3
import database
import re

def detect_language(text: str) -> str:
    """Detect if the content is primarily Arabic or English, focusing on the transcript."""
    if not text: return "en"
    
    # Try to isolate the actual transcript if the marker exists
    transcript_section = text
    if "=== ACTUAL VIDEO TRANSCRIPT" in text:
        try:
            transcript_section = text.split("=== ACTUAL VIDEO TRANSCRIPT")[1].split("===")[0].strip()
        except:
            pass # Fallback to whole text
            
    arabic_chars = re.findall(r'[\u0600-\u06FF]', transcript_section)
    ratio = len(arabic_chars) / (len(transcript_section) + 1)
    
    # Log for debugging
    print(f"DEBUG: Lang Detection (Service) | Ratio: {ratio:.4f} | Detected: {'ar' if ratio > 0.05 else 'en'}")
    
    return "ar" if ratio > 0.05 else "en"

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
    
    # Language detection
    detected_lang = detect_language(content)
    
    # Actually, let's keep it simple for the service but improve the language logic.
    if mode == 'audio':
        # Default conversion since duration might not be directly passed to this service
        # or we can assume 'length' is duration if we know mode is audio.
        # To be safe, we use the word target but emphasize repetition-free narration.
        mode_instruction = (
            "Provide a natural, structured narration-style script. "
            "STRICT RULES:\n"
            "1. NO REPETITION: Do not repeat any facts, points, or phrases. Every sentence must add new value.\n"
            "2. STRUCTURE: Include a brief intro, a comprehensive body covering the source, and a clear conclusion."
        )
    else:
        mode_instruction = (
            "Provide a deep, professional text summary. "
            "STRICT NO-REPETITION POLICY: Do not repeat information or concepts."
        )
    
    length_constraint = f"TARGET LENGTH: {length} words."
    
    if detected_lang == "ar":
        lang_instruction = (
            "PRIMARY LANGUAGE: ARABIC. You MUST respond in professional ARABIC only. "
            "STRICT RULE: Do not translate to English. Do not use English words unless they are technical terms with no Arabic equivalent."
        )
    else:
        lang_instruction = (
            "PRIMARY LANGUAGE: ENGLISH. You MUST respond in professional ENGLISH only. "
            "STRICT RULE: Do not translate to Arabic. The output must be 100% in English."
        )

    prompt = (
        f"MODE: {mode_instruction}\n"
        f"{length_constraint}\n"
        "Analyze the provided content and provide the requested output. "
        f"{lang_instruction}\n"
        "Focus STRICTLY on the actual narrative, educational, or informative content. "
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
            # Choose model based on mode: Speed for audio, depth for text
            ollama_model = "llama3.2:latest" if mode == 'audio' else "gemma4:latest"
            response = await client.post(OLLAMA_URL, json={
                "model": ollama_model,
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
