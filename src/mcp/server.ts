import express from 'express';
import type { Request, Response } from 'express';
import { McpServer } from "@modelcontextprotocol/sdk/esm/server/mcp";

import * as vscode from 'vscode';
import { toolRegistry } from './toolRegistry';

const PORT = 7428; // MCP server port

class McpExpressServer {
  private app = express();
  private server: ReturnType<typeof this.app.listen> | null = null;
  private mcpServer: McpServer | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.setupRoutes();

    // Register all tools from the registry
    for (const tool of toolRegistry) {
      this.registerTool(tool.name, tool.schema, tool.handler);
    }
  }

  private setupRoutes() {
    // MCP endpoint using Server-Sent Events for streaming responses
    this.app.get('/mcp', (req: Request, res: Response) => {
      // Set headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      // Start MCP server with this connection
      this.mcpServer = new McpServer({
        sendEvent: (event: any) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      });

      // Register all tools with the new connection
      for (const tool of toolRegistry) {
        this.mcpServer.registerTool({
          name: tool.name,
          description: tool.schema.description || "",
          parameters: tool.schema,
          handler: async (params: any) => {
            try {
              return await tool.handler(params);
            } catch (error) {
              console.error(`Error executing tool ${tool.name}:`, error);
              // Return structured error object
              return {
                type: "error",
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
              };
            }
          },
        });
      }

      // Process incoming data
      req.on('data', (chunk) => {
        try {
          const data = JSON.parse(chunk.toString());
          this.mcpServer?.receiveEvent(data);
        } catch (error) {
          console.error('Error processing client message:', error);
        }
      });

      // Handle client disconnection
      req.on('close', () => {
        console.log('Client disconnected from MCP');
        this.mcpServer = null;
      });

      // Send heartbeat every 30 seconds to keep connection alive
      this.heartbeatInterval = setInterval(() => {
        res.write(`data: {"type":"heartbeat"}\n\n`);
      }, 30000);
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(PORT, () => {
        console.log(`MCP server started on port ${PORT}`);
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      // Clear heartbeat interval
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // Dispose all registered disposables
      for (const disposable of this.disposables) {
        disposable.dispose();
      }
      this.disposables = [];

      // Close the server if running
      if (this.server) {
        this.server.close(() => {
          console.log('MCP server stopped');
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Register a tool with the MCP server
  public registerTool(
    name: string,
    schema: any,
    handler: (params: any) => Promise<any>
  ): vscode.Disposable {
    const disposable = {
      dispose: () => {
        // Tool unregistration logic (if needed)
      }
    };

    // Register the tool with the MCP server (when connected)
    if (this.mcpServer) {
      this.mcpServer.registerTool({
        name,
        description: schema.description || "",
        parameters: schema,
        handler: async (params: any) => {
          try {
            return await handler(params);
          } catch (error) {
            console.error(`Error executing tool ${name}:`, error);
            // Return structured error object for better handling
            return {
              type: "error",
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined
            };
          }
        },
      });
    }

    // Add an event listener to register this tool for future connections
    const mcpSetupListener = {
      dispose: () => {}
    };

    this.disposables.push(disposable);
    return disposable;
  }
}

// Export a singleton instance
let serverInstance: McpExpressServer | null = null;

export function getOrCreateMcpServer(): McpExpressServer {
  if (!serverInstance) {
    serverInstance = new McpExpressServer();
  }
  return serverInstance;
}