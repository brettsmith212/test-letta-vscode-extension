# Implementation Plan

## 0 – Project Setup
- [x] Step 0.1: **Add runtime dependencies**
  - **Task**: Install and commit `express`, `@modelcontextprotocol/sdk`, `zod`, and accompanying type packages.
  - **Description**: These libraries are the backbone of our MCP integration—`express` hosts the HTTP/SSE endpoint, `@modelcontextprotocol/sdk` handles the MCP handshake/protocol framing, and `zod` validates tool-input JSON schemas at runtime. Without them, no tool exposure is possible.
  - **Files**
    - `package.json`: add dependencies and an optional `"postinstall"` rebuild for native modules.
    - `package-lock.json`/`yarn.lock`: auto-generated.
  - **Step Dependencies**: —
  - **User Instructions**: Run `npm install` (or `yarn`) after the step lands.

- [x] Step 0.2: **Patch TypeScript config**
  - **Task**: Enable `esModuleInterop` (needed for `express` imports) and ensure node typings are referenced.
  - **Description**: Aligns the TypeScript compiler so it can import CommonJS modules (e.g. `const express = require('express')`) with ES module syntax. Prevents build errors later when we introduce the server.
  - **Files**: `tsconfig.json`
  - **Step Dependencies**: 0.1

## 1 – Scaffold MCP Server
- [x] Step 1.1: **Create `src/mcp/server.ts`**
  - **Task**: Stand-up an Express server with `/mcp` SSE endpoint, heartbeat, and graceful shutdown hooks.
  - **Description**: This is the single entry-point Letta will dial via SSE. Establishing it early lets us test tool registration incrementally.
  - **Files**: `src/mcp/server.ts`
  - **Dependencies**: 0.x

- [x] Step 1.2: **Bootstrap server from extension**
  - **Task**: In `extension.ts`, start the MCP server during `activate` and dispose it during `deactivate`.
  - **Description**: Wiring the server into VS Code’s lifecycle guarantees tools are available whenever the extension is active, and resources are freed when it unloads.
  - **Files**: `src/extension.ts`
  - **Dependencies**: 1.1

## 2 – Expose First Tool (Proof of Concept)
- [x] Step 2.1: **Register `execute_command`**
  - **Task**: Import the JSON schema from `terminalTools`, add a resolver that delegates to `executeTerminalTool`, and surface the existing user-approval flow.
  - **Description**: Validates the full round-trip: Letta calls a tool → MCP server routes it → VS Code executes it → response returns. Proving this path before porting all tools de-risks later steps.
  - **Files**
    - `src/mcp/server.ts`
    - `src/tools/terminalTools.ts` (export schema separately if needed)
    - `src/panels/ChatPanel.ts` (tiny tweak for approval flow)
  - **Dependencies**: 1.1

- [x] Step 2.2: **Create MCP config helper**
  - **Task**: Auto-write `~/.letta/mcp_config.json` with the local SSE URL if it’s missing.
  - **Description**: New users shouldn’t hand-edit config files; this step guarantees Letta can discover the VS Code tool server on first run.
  - **Files**:
    - `src/mcp/config.ts`
    - `src/extension.ts`
  - **Dependencies**: 1.2

## 3 – Refactor Tool Definitions for MCP
- [x] Step 3.1: **Centralise tool registry**
  - **Task**: Add `src/mcp/toolRegistry.ts` exporting an array `{ name, schema, handler }`. Import it from the server.
  - **Description**: Keeps tool metadata in one place, eliminating duplication between MCP server and existing TypeScript utilities. Simplifies adding new tools later.
  - **Files**: `src/mcp/toolRegistry.ts`, plus small refactor touches.
  - **Dependencies**: 2.1

- [x] Step 3.2: **Port file-manipulation tools**
  - **Task**: Register `create_file`, `update_file`, `delete_file`, `read_file`, `search_files`, and `list_files`, pointing each to the corresponding `executeTool` switch branch.
  - **Description**: Gives the assistant access to filesystem/IDE actions without the old “Python stub” indirection.
  - **Files**: `src/tools/fileTools.ts`, `src/mcp/toolRegistry.ts`
  - **Dependencies**: 3.1

- [x] Step 3.3: **Port remaining terminal tool**
  - **Task**: Register `read_terminal_output` in the registry, hook to `readTerminalOutput`.
  - **Description**: Completes parity with the toolset we had under Python stubs, ensuring nothing is lost in the migration.
  - **Files**: `src/mcp/toolRegistry.ts`
  - **Dependencies**: 3.1

## 4 – Clean Up LettaService
- [ ] Step 4.1: **Remove dynamic Python stub creation**
  - **Task**: Rip out `attachToolsToAgent`, `forceCreateAndAttachTool`, etc., and replace agent creation with a static `tools: [...]` array.
  - **Description**: With MCP the agent no longer needs server-side code objects. Simplifying this logic avoids API errors and speeds agent creation.
  - **Files**: `src/services/LettaService.ts`
  - **Dependencies**: 3.x

- [ ] Step 4.2: **Trim ChatAdapter’s tool interception**
  - **Task**: Delete `handleToolUse` and pending-command plumbing; approval now happens inside the MCP resolver.
  - **Description**: Prevents double-handling of tool calls and keeps message flow clean.
  - **Files**: `src/services/ChatAdapter.ts`, `src/panels/ChatPanel.ts`
  - **Dependencies**: 4.1

## 5 – Security & UX Enhancements
- [ ] Step 5.1: **Command allow-/deny-list**
  - **Task**: Read a `lettaChat.allowedCommands` setting; block or prompt for disallowed commands.
  - **Description**: Protects users from accidental destructive operations now that the AI can truly run shell commands.
  - **Files**: `src/tools/terminalTools.ts`
  - **Dependencies**: 2.x

- [ ] Step 5.2: **Standardised error envelope**
  - **Task**: Wrap resolver errors into `{ type:"error", message, stack? }` so Letta can parse them.
  - **Description**: Improves debuggability by giving the agent structured feedback instead of plain strings.
  - **Files**: `src/mcp/server.ts`
  - **Dependencies**: 3.x

## 6 – Testing
- [ ] Step 6.1: **Introduce Jest**
  - **Task**: Add `jest.config.ts`, install `ts-jest`, and a trivial passing test.
  - **Description**: Establishes a testing harness early so later tools/tests drop in easily.
  - **Files**: `jest.config.ts`, `tests/smoke.test.ts`
  - **Dependencies**: 3.x

- [ ] Step 6.2: **Unit-test tool handlers**
  - **Task**: Mock VS Code API, assert success and error paths for `fileTools` and `terminalTools`.
  - **Description**: Ensures refactor didn’t break core logic and prevents regressions.
  - **Files**: `tests/fileTools.test.ts`, `tests/terminalTools.test.ts`
  - **Dependencies**: 6.1

## 7 – Documentation & Scripts
- [ ] Step 7.1: **Update README**
  - **Task**: Document MCP architecture, setup commands, and security settings.
  - **Description**: Provides onboarding context for new contributors and clarifies why the project moved away from Python stubs.
  - **Files**: `README.md`
  - **Dependencies**: 0–5

- [ ] Step 7.2: **Dev helper scripts**
  - **Task**: Add `dev:letta` and `dev:vscode` npm scripts for launching Docker + VSIX debugging.
  - **Description**: Streamlines local development so contributors don’t repeat manual steps.
  - **Files**: `package.json`
  - **Dependencies**: —

## 8 – Packaging & Release
- [ ] Step 8.1: **VSIX build & changelog**
  - **Task**: Increment version, ensure new deps bundled, update `CHANGELOG.md`.
  - **Description**: Final polish so users can install the updated extension from Marketplace or a VSIX file.
  - **Files**: `package.json`, `CHANGELOG.md`
  - **Dependencies**: all previous
