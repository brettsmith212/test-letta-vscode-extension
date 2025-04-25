# Letta VS Code Extension Development Memory

## Project Structure
This project is a VS Code extension that integrates with the Letta agent framework. It replaces the original Claude-based AI chat functionality with Letta-powered capabilities.

## Expected Behavior of this Project
I am building a VS Code extension that integrates with the Letta agent framework. The VSCode Extension sends the user requests to a Letta server running in a Docker container. This Letta server then makes the call to the llm model, and makes a call back to the VSCode Extension to access some MCP servers I have in the extension to run things like shell commands or list files in the project directory. The MCP server in the VSCode Extension then responds back to the Letta server in docker with the response, and the letta server processes and sends the llm response back to the VSCode Extension to be put in the UI.

## Important Commands
- `npm install` - Install dependencies (remember to do this after adding new dependencies)
- `npm run compile` - Compile TypeScript files
- `npm run watch` - Watch TypeScript files and compile on change
- `npm run build:webviews` - Build webview UI components
- `npm run watch:webviews` - Watch and build webview UI on change
- `npm run start:letta` - Start the Letta container

## Progress Tracking
- Do not do more than one step without having the Developer review your work. We don't want to get ahead of ourselves too quickly.

## Important thing to remember
- Always import letta sdk as `@letta-ai/letta-client`
- When implementing the letta sdk use `prompts/letta-sdk-documentation.md` as a reference
- Also if possible, search .node_modules for dependencies help when you need type help.
- For tools, we're now using the MCP server approach (Model Context Protocol) which exposes VSCode-powered tools to Letta via a local HTTP server on port 7428
- The MCP server starts automatically when the extension starts and is shut down when the extension is deactivated
- Architecture: Letta server runs in Docker container, MCP server runs in VSCode extension
- Docker must reach OUT to the host's MCP server, not the other way around
- MCP server must bind to all interfaces (0.0.0.0) to be accessible from Docker
- Docker uses `host.docker.internal` DNS name to connect to the host machine (set with `--add-host` flag)
- Tool names must be consistent (e.g., "run_command") between all components