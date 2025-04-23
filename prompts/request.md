# Project Name
Persistent Letta-Powered VS Code AI Assistant

## Project Description
A VS Code extension that swaps its Claude-only backend for a **Letta-powered stateful agent**.  
The extension auto-pulls & launches a local Letta Docker container, then routes all chat through the Letta TypeScript SDK while keeping the existing React/TS UI.  
Goals: long-term memory (core + archival), on-demand workspace indexing, seamless tool usage, and automatic self-healing if the Letta server stops.

## Target Audience
- [x] Individual developers seeking a privacy-respecting, stateful coding assistant

## Desired Features
### Core Chat / Agent Integration
- [ ] Replace `ChatService` Anthropic client with Letta SDK  
- [ ] **Hybrid scope agent management**  
    - [ ] Create one **shared persona block** (seed text below) on first run; store `blockId` in global Memento  
    - [ ] For each workspace session  
        1. **Workspace ID** = SHA-256(`workspaceRootPath`)  
        2. Lookup `{workspaceId → agentId}` in `globalState`  
        3. If absent → `POST /agents` to create agent  
        4. Attach shared persona block  
        5. Create / attach **project block** labeled `project-{workspaceId}`  
        6. Persist mapping `{workspaceId → {agentId, projectBlockId}}`  
- [ ] At agent-creation time, **register VS Code file & terminal tools** so the agent can call them (Letta’s built-ins already cover memory tools)  
- [ ] Stream replies to UI (unchanged)

### Memory Management
- [ ] Shared persona block (coding style, prefs)  
- [ ] Per-workspace project block  
- [ ] “Index Workspace” command → full file upload to archival source  
- [ ] Commands: Flush Project Memory / Flush Persona Memory

### Server Management
- [ ] Startup sequence  
    1. Probe `http://localhost:8283/health`  
    2. If missing → `docker run -d --name letta -p 8283:8283 letta/letta:latest`  
    3. If Docker CLI not found → toast with link **https://www.docker.com/get-started/**  
- [ ] Status-bar “Letta ●” (green ✓ / red ✗)  
- [ ] On server crash → toast “Letta server offline, attempting restart…”, auto-restart once, toast on failure

### Configuration & Settings
- Default chat models: `gpt-4o-mini`, `gpt-4o-nano`, `claude-3-5-sonnet-20241022`, `claude-3-7-sonnet-20250215`  
- Default embedding: `openai/text-embedding-3-small`
- Settings keys  
    - `lettaChat.serverUrl`  
    - `lettaChat.model`  
    - `lettaChat.embeddingModel`  
    - `lettaChat.agentScope` (default **"hybrid"**)  
    - `lettaChat.enableFileIndexing`

### UI / UX
- Preserve existing dark-mode webviews  
- Toast for Docker-missing, server errors, restart attempts

### Testing & CI
- CI: spin up Docker Letta, run integration tests  
- Unit: agent mapping, server restart logic

### Security & Privacy
- HTTPS for non-localhost URLs  
- Respect `enableFileIndexing` flag  
- Confirm shell commands

## Design Requests
- Maintain current UI  
- Status-bar “Letta ●” indicator

## Other Notes
- **Persona seed text:**  
  ```
  You are an extremely great software engineer. You will help the user build
  software using the best coding practices and idiomatic code.
  ```
- Workspace-ID hashing (`crypto.createHash('sha256').update(path).digest('hex')`) avoids leaking absolute paths inside Letta memory.  
- Build flow (`tsc`, `vite build:webviews`) unchanged.
