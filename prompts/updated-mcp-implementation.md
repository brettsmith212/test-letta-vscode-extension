# Implementation Plan (revised – TS build already OK)

## 1 — Network & configuration plumbing
- [x] Step 1.1: Make Docker → host MCP endpoint resolvable
  - **Task**: Update `writeMcpConfig()` to write `endpoint":"http://host.docker.internal:7428/mcp"` (Linux users add `--add-host=host.docker.internal:host-gateway` when running Letta’s container).
  - **Files**:  
    - `src/mcp/config.ts`
  - **User Instructions**: Re-start the container with `-p 7428:7428`; verify `curl http://host.docker.internal:7428/health` from inside the container.

- [x] Step 1.2: Health-reconnect command
  - **Task**: Add VS Code command `letta-ai.reconnect` that re-checks `/health`, re-writes MCP config, and re-attaches tools.
  - **Files**:  
    - `src/utils/dockerHelper.ts` (new `reconnectLetta()` helper)  
    - `src/extension.ts` (register command)

## 2 — Tool registry consistency
- [ ] Step 2.1: Canonicalise tool names
  - **Task**: Pick **`run_command`** (shorter). Rename everywhere:
    - `terminalTools`, `toolRegistry`, and `ChatAdapter.handleToolUse`.
  - **Files**:  
    - `src/tools/terminalTools.ts`  
    - `src/mcp/toolRegistry.ts`  
    - `src/services/ChatAdapter.ts`

- [ ] Step 2.2: Single-source JSON/Zod schemas
  - **Task**: Export each tool definition as `{ name, description, zod, jsonSchema }` and import from registry.
  - **Files**:  
    - `src/tools/terminalTools.ts`  
    - `src/tools/fileTools.ts`  
    - `src/mcp/toolRegistry.ts`

## 3 — Chat stream & role fixes
- [ ] Step 3.1: Adopt Letta official streaming helpers
  - **Task**: Replace manual event parsing in `ChatAdapter.createMessageStream` with `@letta-ai/letta-client/streaming`.
  - **Files**: `src/services/ChatAdapter.ts`

- [ ] Step 3.2: Correct role mapping
  - **Task**: Push assistant replies back as `{ role: 'assistant' }`, reserve `'system'` for meta-messages.
  - **Files**: `src/services/ChatAdapter.ts`

## 4 — Tool execution flow improvements
- [ ] Step 4.1: User-approval handshake
  - **Task**: On `run_command` tool-call, suspend Letta stream, wait for approval, then `POST /tool_result`. Implement with an async queue.
  - **Files**: `src/services/ChatAdapter.ts`

- [ ] Step 4.2: Structured tool results
  - **Task**: Tool handlers return `{ success: boolean, output: string }`; MCP server wrapper `JSON.stringify`s it.
  - **Files**:  
    - `src/mcp/toolRegistry.ts`  
    - `src/mcp/server.ts`  
    - `src/tools/*`

## 5 — Indexing & memory hygiene
- [ ] Step 5.1: Chunked file uploads
  - **Task**: In `indexWorkspace`, stream large files in ≤2 K-token chunks (approx 8 KB each) using `client.blocks.createMultipart`.
  - **Files**: `src/commands/indexWorkspace.ts`

- [ ] Step 5.2: Clean stale project blocks
  - **Task**: When agent recreation happens, delete old project block via API.
  - **Files**: `src/services/LettaService.ts`

## 6 — UX polish
- [ ] Step 6.1: Status-bar “Letta: Connected”
  - **Task**: Show connection state, click = run “Reconnect”.
  - **Files**:  
    - `src/extension.ts`  
    - `src/utils/dockerHelper.ts`

- [ ] Step 6.2: Settings webview panel
  - **Task**: Provide GUI for server URL, model, embedding model.
  - **Files**:  
    - `src/panels/SettingsPanel.tsx` (React)  
    - `package.json` (new command contribution)

## 7 — Testing & CI
- [ ] Step 7.1: Jest unit tests for tool helpers
  - **Files**: `test/tools.test.ts`

- [ ] Step 7.2: Supertest integration test for MCP server
  - **Files**: `test/mcp.test.ts`

- [ ] Step 7.3: GitHub Actions workflow
  - **Files**: `.github/workflows/ci.yml`

## 8 — Documentation
- [ ] Step 8.1: Update README & CONTRIBUTING
  - **Task**: Explain Docker port mapping, reconnection flow, settings UI.
  - **Files**: `README.md`, `CONTRIBUTING.md`
