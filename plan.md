# Implementation Plan

## Environment & Configuration
- [x] **Step 1: Normalize `mcp_config.json` format**  
  - **Task**: Replace the single-endpoint structure with Letta’s `mcpServers` object and expose MCP host/port as a setting.  
  - **Description**: Ensures the Docker container discovers the VS Code MCP via SSE.  
  - **Files (6)**  
    - `src/mcp/config.ts`: rewrite `writeMcpConfig` to emit `{ mcpServers: { vscode: { url } } }`.  
    - `package.json`: add `"lettaChat.mcpPort"` setting (default 7428).  
    - `src/utils/dockerHelper.ts`: read the new setting when checking health.  
    - `README.md` (new): document manual Docker & config steps.  
    - `src/types/index.ts`: no change, but include in commit to assure compile passes.  
    - `test/mcpConfig.test.ts` (new): Vitest unit test to assert file contents.  
  - **Example code**  
    ```ts
    const config = { mcpServers: { vscode: { url: `http://${hostIp}:${port}/mcp` } } };
    ```  
  - **Step Dependencies**: none  
  - **User Instructions**: After running this step, delete your old `~/.letta/mcp_config.json` and let the extension re-create it.

- [x] **Step 2: Add real `/health` endpoint check**  
  - **Task**: Point Docker helper to `GET /health` (fallback to `/` if 404).  
  - **Description**: Speeds up startup and avoids false positives.  
  - **Files (3)**  
    - `src/utils/dockerHelper.ts`: update `checkLettaHealth`.  
    - `test/dockerHelper.test.ts` (new): mock fetch and verify logic.  
    - `package.json`: add `vitest` + `@vitest/coverage-istanbul` devDeps.  
  - **Example code**  
    ```ts
    const tryPaths = ['/health', '/']; for (const p of tryPaths) { ... }  
    ```  
  - **Step Dependencies**: Step 1 (test infra added).  
  - **User Instructions**: none.

## MCP Server Robustness
- [x] **Step 3: Port-in-use retry & friendly error**  
  - **Task**: Modify `src/mcp/server.ts` so that if 7428 is busy it shows a toast and offers “Change MCP Port”.  
  - **Description**: Prevents silent failures when multiple VS Code windows run the extension.  
  - **Files (4)**  
    - `src/mcp/server.ts`: extract `findOpenPort` helper, add retry up to +10 ports.  
    - `src/mcp/config.ts`: persist chosen port back to settings & config.  
    - `src/utils/dockerHelper.ts`: read updated port from settings when writing MCP config.  
    - `test/mcpServerPort.test.ts` (new): simulate EADDRINUSE and assert fallback port chosen.  
  - **Step Dependencies**: Step 1.  
  - **User Instructions**: Accept VS Code prompt if asked to reopen Docker port in firewall.

- [x] **Step 4: Graceful shutdown on VS Code deactivate & window reload**  
  - **Task**: Ensure `mcpServer.stop()` is called on extension reloads to free the port.  
  - **Description**: Avoids “port already in use” when reloading window.  
  - **Files (2)**  
    - `src/extension.ts`: hook `vscode.workspace.onDidChangeConfiguration` & `onWillShutdown`.  
    - `test/shutdown.test.ts` (new): mock server and assert `stop()` called.  
  - **Step Dependencies**: Step 3.  
  - **User Instructions**: none.

## Tool Safety & Validation
- [x] **Step 5: Zod validation before tool execution**  
  - **Task**: Call `schema.parse` for each incoming `input` in `executeTool` and `executeTerminalTool`.  
  - **Description**: Ensures bad inputs are rejected quickly.  
  - **Files (4)**  
    - `src/tools/fileTools.ts`  
    - `src/tools/terminalTools.ts`  
    - `test/fileToolsValidation.test.ts` (new)  
    - `test/terminalToolsValidation.test.ts` (new)  
  - **Example code**  
    ```ts
    const params = createFileSchema.parse(input);
    ```  
  - **Step Dependencies**: Step 2.  
  - **User Instructions**: none.

- [x] **Step 6: Confirmation dialog for `delete_file` & overwrite**  
  - **Task**: Before delete/overwrite, show VS Code modal “Yes / No”.  
  - **Description**: Prevents accidental destructive edits.  
  - **Files (3)**  
    - `src/tools/fileTools.ts`: wrap destructive branch.  
    - `src/mcp/toolRegistry.ts`: propagate cancelled result.  
    - `test/deleteConfirm.test.ts` (new): stub `vscode.window.showWarningMessage`.  
  - **Step Dependencies**: Step 5.

## Letta Service Reliability
- [x] **Step 7: Refactor `attachToolsToAgent` for SDK 0.1.102**  
  - **Task**: Replace deprecated `client.tools.listMcpToolsByServer` with `client.tools.listMcpTools('vscode')`.  
  - **Description**: Keeps code in sync with current SDK.  
  - **Files (2)**  
    - `src/services/LettaService.ts`  
    - `test/attachTools.test.ts` (new): mock SDK client and verify calls.  
  - **Step Dependencies**: Step 2.

- [x] **Step 8: Cache tool IDs to skip redundant `attach` calls**  
  - **Task**: Use `this.toolsCache` before making network calls.  
  - **Description**: Speeds up startup & avoids “tool already attached” errors.  
  - **Files (2)**  
    - `src/services/LettaService.ts`  
    - `test/toolsCache.test.ts` (new)  
  - **Step Dependencies**: Step 7.

## UI Enhancements
- [x] **Step 9: Connection status indicator in webview**  
  - **Task**: Expose `checkLettaHealth` result via `vscode.window.onDidChangeStatusBarMessage` and display in React webview (green / red dot).  
  - **Description**: Gives users real-time feedback.  
  - **Files (5)**  
    - `src/views/webview-content.ts`: add `<span id="letta-status"></span>`  
    - `media/build/*`: minimal React component update (index.tsx).  
    - `src/utils/dockerHelper.ts`: post `lettaStatus` message.  
    - `src/panels/ChatPanel.ts`: forward status to webview.  
    - `test/statusMessage.test.ts` (new)  
  - **Step Dependencies**: Step 2.  
  - **User Instructions**: Run `npm run watch:webviews` during dev for live reload.

- [x] **Step 10: Log viewer panel**  
  - **Task**: Add a new command `letta-ai.openLogs` that shows extension logs in a readonly editor.  
  - **Description**: Aids debugging without opening console.  
  - **Files (3)**  
    - `src/panels/LogPanel.ts` (new)  
    - `src/extension.ts`: register command.  
    - `test/logPanel.test.ts` (new)  
  - **Step Dependencies**: Step 9.

## Testing & CI
- [x] **Step 11: Vitest baseline & GitHub Actions workflow**  
  - **Task**: Add `vitest.config.ts`, update `package.json` scripts, and create `.github/workflows/ci.yml`.  
  - **Description**: Automates unit tests on PRs.  
  - **Files (5)**  
    - `vitest.config.ts` (new)  
    - `package.json` (scripts + devDeps)  
    - `.github/workflows/ci.yml` (new)  
    - `test/setup.ts` (new) mock VS Code.  
    - `README.md`: add badge & test command.  
  - **Step Dependencies**: Steps 1–6 introduce tests; CI after that makes sense.  
  - **User Instructions**: Ensure your repo has GitHub Actions enabled.

## Documentation
- [ ] **Step 12: CONTRIBUTING & Troubleshooting Guide**  
  - **Task**: Add doc with common startup issues, port conflicts, Docker tips.  
  - **Description**: Helps new contributors and future you.  
  - **Files (2)**  
    - `CONTRIBUTING.md` (new)  
    - `docs/troubleshooting.md` (new)  
  - **Step Dependencies**: none (can run anytime)  
  - **User Instructions**: Review and expand with any company-specific guidelines.

