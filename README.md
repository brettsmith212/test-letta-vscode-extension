# Letta AI VS Code Extension

A VS Code extension for interacting with Letta AI, a powerful assistant for developers.

## Features

- Chat with Letta AI directly within VS Code
- Use AI-powered tools to analyze and modify your code
- Context-aware assistance based on your open files
- Workspace indexing for more relevant responses

## Requirements

- Docker Desktop (for running the Letta server)
- Node.js 18+ and npm

## Installation

1. Install the extension from the VS Code marketplace
2. Run the Letta server container using Docker

## Setting up the Docker Container

### Automatic Setup

The extension can automatically start the Docker container for you:

1. Open the Command Palette (Ctrl+Shift+P or Cmd+Shift+P)
2. Run `Letta AI: Reconnect to Server`

### Manual Setup

If you prefer to set up Docker manually:

1. Run the container using the included script:
   ```bash
   npm run start:letta
   ```

2. Or run the Docker command directly:
   ```bash
   docker run --rm \
     -p 8283:8283 \
     --add-host=host.docker.internal:host-gateway \
     -v "$HOME/.letta:/root/.letta" \
     lettaai/letta-server:latest
   ```

## Configuration

This extension contributes the following settings:

* `lettaChat.serverUrl`: URL of the Letta server (default: http://localhost:8283)
* `lettaChat.mcpPort`: Port for the MCP server that the Letta Docker container connects to (default: 7428)
* `lettaChat.model`: Model to use for chat completion (default: letta/letta-free)
* `lettaChat.embeddingModel`: Model to use for text embeddings (default: letta/letta-free)
* `lettaChat.agentScope`: Scope for the Letta agent memory (workspace, global, or folder-specific)
* `lettaChat.enableFileIndexing`: Automatically index workspace files for agent memory

## Troubleshooting

### MCP Configuration

Letta uses the Model Context Protocol (MCP) to provide tools for accessing your files and running commands. The extension automatically creates a configuration file at `~/.letta/mcp_config.json`. 

If you encounter issues with tool execution:

1. Delete the existing MCP config file: `rm ~/.letta/mcp_config.json`
2. Restart the extension or reload your VS Code window
3. The extension will recreate the file with the correct format

### Docker Connection

If the extension cannot connect to the Docker container:

1. Ensure Docker Desktop is running
2. Check that port 8283 is not in use by another application
3. Verify the container is running: `docker ps | grep letta`
4. Check container logs: `docker logs $(docker ps -q --filter ancestor=lettaai/letta-server:latest)`

## License

This extension is licensed under the MIT License.