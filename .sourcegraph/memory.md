# Letta VS Code Extension Development Memory

## Project Structure
This project is a VS Code extension that integrates with the Letta agent framework. It replaces the original Claude-based AI chat functionality with Letta-powered capabilities.

## Important Commands
- `npm install` - Install dependencies (remember to do this after adding new dependencies)
- `npm run compile` - Compile TypeScript files
- `npm run watch` - Watch TypeScript files and compile on change
- `npm run build:webviews` - Build webview UI components
- `npm run watch:webviews` - Watch and build webview UI on change
- `npm run start:letta` - Start the Letta container

## Progress Tracking
- When you complete a step be sure to mark it completed in implementation.md as well.
- Do not do more than one step without having the Developer review your work. We don't want to get ahead of ourselves too quickly.

## Helpful Notes
- Always import letta sdk as `@letta-ai/letta-client`
- When implementing the letta sdk use `prompts/letta-sdk-documentation.md` as a reference
- Also if possible, search .node_modules for dependencies help when you need type help.
- For tools, we're now using the MCP server approach (Model Context Protocol) which exposes VSCode-powered tools to Letta via a local HTTP server on port 7428
- The MCP server starts automatically when the extension starts and is shut down when the extension is deactivated