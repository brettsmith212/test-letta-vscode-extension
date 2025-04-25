# Implementation Plan

## 1 – Environment & Dependencies
- [x] Step 1.1: Add Letta SDK and Docker-CLI helper
  - **Task**: Install `@letta/sdk` and `dockerode`; update dependencies and add helper for checking/running Docker.
  - **Description**: Ensures we have the Letta client library and can programmatically detect or launch Docker for the Letta server.
  - **Files**:
    - `package.json`: add dependencies `@letta/sdk`, `dockerode` and script `"start:letta"`
    - `src/utils/dockerHelper.ts`: new file with functions:
      - `isDockerInstalled(): Promise<boolean>`
      - `runLettaContainer(): Promise<void>`
      - `checkLettaHealth(): Promise<boolean>`
  - **Step Dependencies**: none
  - **User Instructions**: run `npm install` after merge.

- [x] Step 1.2: Add VS Code settings schema
  - **Task**: Extend `package.json` → `contributes.configuration` with new keys under `lettaChat.*`.
  - **Description**: Exposes controls for server URL, model choices, embedding model, agent scope, and indexing toggle.
  - **Files**:
    - `package.json`: add settings entries for
      - `lettaChat.serverUrl`
      - `lettaChat.model`
      - `lettaChat.embeddingModel`
      - `lettaChat.agentScope`
      - `lettaChat.enableFileIndexing`
  - **Step Dependencies**: 1.1

## 2 – Core Letta Service
- [x] Step 2.1: Create `LettaService` singleton
  - **Task**: Implement `LettaService` that initializes the Letta SDK client, ensures the server is running via `dockerHelper`, and handles persona block creation.
  - **Description**: Centralizes server lifecycle, SDK instantiation, and persona-memory setup; stores persona `blockId` in `globalState`.
  - **Files**:
    - `src/services/LettaService.ts`: new with methods:
      - `initialize(): Promise<void>`
      - `ensureServer(): Promise<void>`
      - `getClient(): LettaClient`
      - `getOrCreatePersonaBlock(): Promise<string>`
  - **Step Dependencies**: 1.1

- [x] Step 2.2: Implement workspace agent mapping
  - **Task**: In `LettaService`, add `getAgentForWorkspace(workspaceUri: Uri): Promise<{agentId:string, projectBlockId:string}>`.
  - **Description**: Computes SHA-256 of `workspaceUri.fsPath`, looks up or creates agent, attaches persona & project blocks, and persists mapping in `globalState`.
  - **Files**:
    - `src/services/LettaService.ts`: update to include agent registry logic
  - **Step Dependencies**: 2.1

- [x] Step 2.3: Register VS Code tools with Letta agent
  - **Task**: At agent creation, call Letta SDK to register `fileTools` and `terminalTools` specs as agent tools.
  - **Description**: Enables the agent to invoke the existing file/terminal operations via Letta’s built-in tool system.
  - **Files**:
    - `src/services/LettaService.ts`: extend agent-creation logic
    - `src/tools/fileTools.ts`: export Letta-compatible JSON spec
    - `src/tools/terminalTools.ts`: export Letta-compatible JSON spec
  - **Step Dependencies**: 2.2

## 3 – Chat Flow Refactor
- [x] Step 3.1: Build `ChatAdapter` for Letta streaming
  - **Task**: Create `src/services/ChatAdapter.ts` to wrap `LettaService.sendMessage()`, handle streaming tokens and tool-use blocks, and emit events matching existing UI protocol.
  - **Description**: Abstracts Letta-specific messaging into an adapter that the UI code can consume without changes.
  - **Files**:
    - `src/services/ChatAdapter.ts`: new
  - **Step Dependencies**: 2.3

- [x] Step 3.2: Wire `ChatPanel` to `ChatAdapter`
  - **Task**: Replace instantiation of `ChatService` with `ChatAdapter` in `ChatPanel`, adjust method calls to use Letta-based streams.
  - **Description**: Connects the UI to the new Letta-powered message flow.
  - **Files**:
    - `src/panels/ChatPanel.ts`
    - `src/extension.ts`: minor import adjustments
  - **Step Dependencies**: 3.1

- [x] Step 3.3: Remove old Anthropic integration
  - **Task**: Uninstall `@anthropic-ai/sdk`, delete `ChatService.ts`, and clean up related imports.
  - **Description**: Cleans obsolete code and dependencies now replaced by Letta.
  - **Files**:
    - `package.json`: remove `@anthropic-ai/sdk`
    - `src/services/ChatService.ts`: delete
    - imports in `ChatPanel.ts`, `ChatAdapter.ts`, etc.
  - **Step Dependencies**: 3.2

## 4 – Workspace Indexing & Memory Commands
- [x] Step 4.1: Add “Index Workspace” command
  - **Task**: Create `src/commands/indexWorkspace.ts` to scan workspace files, chunk & upload to Letta archival source, attach to agent. Register command in `extension.ts`.
  - **Description**: Provides on-demand ingestion of workspace code into agent’s long-term memory.
  - **Files**:
    - `src/commands/indexWorkspace.ts`: new
    - `src/extension.ts`: register new command
  - **Step Dependencies**: 2.3

- [x] Step 4.2: Add memory-flush commands
  - **Task**: Create `src/commands/flushMemory.ts` with two commands: clear project block and clear persona block. Register in `extension.ts`.
  - **Description**: Allows user to manually reset either memory tier.
  - **Files**:
    - `src/commands/flushMemory.ts`
    - `src/extension.ts`
  - **Step Dependencies**: 2.3

## 5 – UI Enhancements
- [ ] Step 5.1: Implement status-bar indicator
  - **Task**: Add `src/ui/statusBar.ts` to create a VS Code status item that reflects Letta server health, polling every 30s via `LettaService.checkHealth()`.
  - **Description**: Gives at-a-glance feedback on Letta server status.
  - **Files**:
    - `src/ui/statusBar.ts`: new
    - `src/extension.ts`: activate status bar on startup
  - **Step Dependencies**: 2.1

- [ ] Step 5.2: Toasts for server and Docker errors
  - **Task**: In `LettaService`, emit events on Docker missing or server-down; handle in `ChatPanel` to post message to webview for toast display.
  - **Description**: Provides immediate feedback when prerequisites or server fail.
  - **Files**:
    - `src/services/LettaService.ts`
    - `src/panels/ChatPanel.ts`
  - **Step Dependencies**: 5.1

## 6 – Testing & CI
- [ ] Step 6.1: Unit tests for LettaService
  - **Task**: Write Jest tests mocking Letta SDK & Docker helper to verify persona creation, agent mapping, restart logic.
  - **Description**: Ensures core logic is correct and resilient to errors.
  - **Files**:
    - `__tests__/LettaService.test.ts`
  - **Step Dependencies**: 2.3

- [ ] Step 6.2: CI integration with Letta Docker
  - **Task**: Create `.github/workflows/ci.yml` that starts `letta/letta:latest` container, then runs `npm test` and basic health-checks.
  - **Description**: Validates extension and service integration in CI environment.
  - **Files**:
    - `.github/workflows/ci.yml`
  - **Step Dependencies**: 6.1

## 7 – Documentation
- [ ] Step 7.1: Update README
  - **Task**: Document setup, Docker auto-run behavior, settings keys, commands, and persona seed.
  - **Description**: Provides clear instructions for end users to install and configure the extension.
  - **Files**:
    - `README.md`
  - **Step Dependencies**: all previous steps
  - **User Instructions**: After merge, review README and try extension in a fresh workspace.
