
# 🤖 AI Agent Handoff: Note-Taking System Deployment

Greetings, Agent. You are tasked with initializing this AI-powered Note-Taking System on a new host machine. This system integrates **FastAPI**, **React/Vite**, **MCP (Model Context Protocol)**, and **Ollama**.

Follow this technical protocol to ensure a zero-error deployment.

---

## 🏗️ System Architecture Core
- **Frontend**: React + Vite (Port 5173 default).
- **Backend**: FastAPI (Port 8002).
- **Database**: Local SQLite (`backend/notes.db`).
- **Context Layer**: FastMCP Server (`backend/mcp_server.py`).
- **Inference**: Ollama (Mistral:latest).

---

## 🛠️ Phase 1: Environment Validation & Prerequisites
Before executing code, verify the following dependencies on the host:
1. **Python 3.10+**: Must be in PATH.
2. **Node.js & npm**: Latest LTS recommended.
3. **Ollama**: Service must be active on port `11434`.

**Agent Action**: Run `ollama pull mistral` immediately to ensure the model is cached locally.

---

## 🚀 Phase 2: Backend & MCP Initialization
Navigate to `/backend` and execute:

1. **Venv Creation**:
   ```powershell
   python -m venv venv
   .\venv\Scripts\activate
   ```
2. **Dependency Injection**:
   ```powershell
   pip install fastapi uvicorn httpx mcp sqlite3
   # OR: pip install -r requirements.txt
   ```
3. **Internal Tool Test**:
   Execute `python test_mcp_tools.py` to verify the SQLite connection and MCP tool logic.

4. **Launch Server**:
   ```powershell
   python main.py
   ```
   *CRITICAL: If port 8002 is bound, use `taskkill /F /PID <PID>` to clear it.*

---

## 💻 Phase 3: Frontend Deployment
Navigate to the root directory and execute:

1. **Install**: `npm install`
2. **Launch**: `npm run dev`
3. **URL Mapping**: Verify the app is reachable at `http://localhost:5173`.

---

## ⚠️ Known Edge Cases & Debugging (Agent Knowledge Base)

### 1. `httpx.ReadTimeout`
Gemma/Mistral may be slow on initial inference. The backend `AsyncClient` is configured with `timeout=None`. Do not revert to default timeouts.

### 2. Port Conflict (Errno 10048)
Windows frequently keeps port 8002 alive after a crash. Use `netstat -ano | findstr :8002` to find the zombie PID and terminate it.

### 3. Smart Selection Logic
The `AIPanel.jsx` component uses a selection-first priority logic. If `Analyzing content...` hangs, verify if the user has a large selection causing an Ollama bottleneck.

### 4. MCP Handoff
The Backend acts as an MCP Client. Ensure `mcp_server.py` is imported correctly in `main.py`. The AI Tools tab in the UI will fail if the internal `read_current_note` tool cannot interface with `notes.db`.

---

## 🎯 Verification Checklist
- [ ] Ollama responds to `curl http://127.0.0.1:11434/api/tags`.
- [ ] Backend console shows `Application startup complete`.
- [ ] Frontend "AI Tools" panel opens without console errors.
- [ ] "Generate Summary" returns a valid response from Mistral.

**Agent Guidance**: If the user experiences "Connection Error", check the CORS middleware in `main.py` and ensure the `OLLAMA_URL` is pointing to `127.0.0.1`.
