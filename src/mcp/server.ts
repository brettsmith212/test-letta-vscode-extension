import express from 'express';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import * as vscode from 'vscode';
import { toolRegistry } from './toolRegistry';
import { writeMcpConfig } from './config';

const DEFAULT_PORT = 7428; // MCP server port that Docker container expects

class McpExpressServer {
  /**
   * Gets the current port the server is running on
   */
  public getPort(): number {
    return this.port;
  }
  private app = express();
  private server: ReturnType<typeof this.app.listen> | null = null;
  private transports: Record<string, StreamableHTTPServerTransport> = {};
  private sessions: Record<string, McpServer> = {};
  private disposables: vscode.Disposable[] = [];
  private port: number = DEFAULT_PORT;

  constructor() {
    this.setupRoutes();
    this.app.use(express.json()); // Parse JSON request bodies
  }

  private setupRoutes() {
    // POST /mcp - handle client requests (initialization and subsequent RPC calls)
    this.app.post('/mcp', async (req: Request, res: Response) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      try {
        if (sessionId && this.transports[sessionId]) {
          // Reuse existing session transport for subsequent requests
          transport = this.transports[sessionId];
        } else if (!sessionId && isInitializeRequest(req.body)) {
          // New client initialization -> create a new server + transport
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (newId) => {
              this.transports[newId] = transport;
              console.log(`New MCP session initialized: ${newId}`);
            }
          });

          // Clean up when the session/transport closes
          transport.onclose = () => {
            if (transport.sessionId) {
              console.log(`MCP session closed: ${transport.sessionId}`);
              delete this.transports[transport.sessionId];
              delete this.sessions[transport.sessionId];
            }
          };

          // Create and configure the MCP server instance
          const server = new McpServer({ 
            name: "letta-vscode-mcp", 
            version: "1.0.0"
          });
          
          // Register all tools from the registry
          for (const tool of toolRegistry) {
            try {
              server.tool(
                tool.name,
                tool.schema,
                async (args: any, extra: any) => {
                  try {
                    const result = await tool.handler(args);
                    return {
                      content: [{ type: "text" as const, text: JSON.stringify(result) }]
                    };
                  } catch (error) {
                    console.error(`Error executing tool ${tool.name}:`, error);
                    return {
                      content: [{ 
                        type: "text" as const, 
                        text: error instanceof Error ? error.message : String(error)
                      }],
                      isError: true
                    };
                  }
                }
              );
              console.log(`Registered tool: ${tool.name}`);
            } catch (error) {
              console.error(`Error registering tool ${tool.name}:`, error);
            }
          }

          // Store the server in our sessions map
          if (transport.sessionId) {
            this.sessions[transport.sessionId] = server;
          }

          await server.connect(transport);  // Link the transport to the MCP server
        } else {
          // If no valid session ID and not an initialization, reject the request
          res.status(400).json({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Bad Request: No valid session ID provided" },
            id: null
          });
          return;
        }

        // Let the transport handle this HTTP request
        await transport.handleRequest(req, res, req.body);
      } catch (err) {
        console.error("Error handling MCP request:", err);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null
          });
        }
      }
    });

    // GET /mcp - handle SSE connection for server-to-client events
    this.app.get('/mcp', async (req: Request, res: Response) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      
      if (sessionId && this.transports[sessionId]) {
        const transport = this.transports[sessionId];
        // This will keep the response open and stream events via SSE
        await transport.handleRequest(req, res);
      } else {
        // For the initial connection (no session yet), create a transport
        // The client will get the session ID and then make a POST with initialize
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newId) => {
            this.transports[newId] = transport;
            console.log(`New MCP session initialized on GET: ${newId}`);
          }
        });

        transport.onclose = () => {
          if (transport.sessionId) {
            console.log(`MCP session closed: ${transport.sessionId}`);
            delete this.transports[transport.sessionId];
            delete this.sessions[transport.sessionId];
          }
        };

        await transport.handleRequest(req, res);
      }
    });

    // DELETE /mcp - allow clients to close a session
    this.app.delete('/mcp', async (req: Request, res: Response) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (!sessionId || !this.transports[sessionId]) {
        res.status(400).send("Invalid or missing MCP session ID");
        return;
      }
      
      const transport = this.transports[sessionId];
      await transport.handleRequest(req, res);
      // After handling, the onclose handler will cleanup
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const tryPort = (port: number, maxRetries = 3, retryCount = 0) => {
        try {
          // Log server start attempt with binding to all interfaces (0.0.0.0) for Docker access
          console.log(`Attempting to start MCP server on port ${port} (binding to all interfaces)...`);
          // Bind to all network interfaces (0.0.0.0) so Docker can connect
          this.server = this.app.listen(port, '0.0.0.0', () => {
            this.port = port;
            console.log(`MCP server started successfully on port ${port}`);
            // Write config with the actual port we're using
            writeMcpConfig(port);
            resolve();
          });

          // Add error handler to the server
          this.server.on('error', (err) => {
            // Most common error is port already in use (EADDRINUSE)
            if ((err as any).code === 'EADDRINUSE') {
              console.warn(`Port ${port} is already in use. ${retryCount < maxRetries ? 'Trying another port...' : 'Too many retries.'}`);
              
              // Close current failed server attempt
              if (this.server) {
                this.server.close();
                this.server = null;
              }
              
              // Try another port if we haven't exceeded max retries
              // Since Docker is expecting us to use exactly port 7428, we can't retry with another port
              // Instead, show a specific message about port 7428 being required
              vscode.window.showErrorMessage(
                `Cannot start MCP server on required port 7428. This port is already in use. Please check if another instance of the extension is running or restart VS Code.`,
                'Close Docker',
                'Details'
              ).then(selection => {
                if (selection === 'Close Docker') {
                  vscode.window.showInformationMessage('Please manually close the Letta Docker container and then try again.');
                } else if (selection === 'Details') {
                  vscode.commands.executeCommand('letta-ai.showErrorDetails');
                }
              });
              reject(err);
            } else {
              console.error(`Failed to start MCP server: ${err.message}`);
              reject(err);
            }
          });
        } catch (error) {
          console.error('Unexpected error starting MCP server:', error);
          reject(error);
        }
      };
      
      // Start with the default port
      tryPort(DEFAULT_PORT);
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      // Dispose all registered disposables
      for (const disposable of this.disposables) {
        disposable.dispose();
      }
      this.disposables = [];

      // Close all active transports
      Object.values(this.transports).forEach(transport => {
        transport.close();
      });
      this.transports = {};
      this.sessions = {};

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

  // Register a tool with the MCP server for future sessions
  public registerTool(
    name: string,
    schema: any,
    handler: (params: any) => Promise<any>
  ): vscode.Disposable {
    const description = schema.description || 'No description provided';
    // This disposable will be returned to allow unregistering the tool
    const disposable = {
      dispose: () => {
        // No need to do anything specific for unregistration
        // since tools are registered per-session
      }
    };

    // Add the tool to the registry for future sessions
    toolRegistry.push({
      name,
      description,
      schema,
      handler
    });

    // Register with any active sessions
    Object.values(this.sessions).forEach(server => {
      try {
        server.tool(
          name,
          schema,
          async (args: any, extra: any) => {
            try {
              const result = await handler(args);
              return {
                content: [{ type: "text" as const, text: JSON.stringify(result) }]
              };
            } catch (error) {
              console.error(`Error executing tool ${name}:`, error);
              return {
                content: [{ 
                  type: "text" as const, 
                  text: error instanceof Error ? error.message : String(error)
                }],
                isError: true
              };
            }
          }
        );
      } catch (error) {
        console.error(`Error registering tool ${name} with active session:`, error);
      }
    });

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

/**
 * Gets the current port the MCP server is running on
 */
export function getCurrentMcpPort(): number | null {
  if (!serverInstance) {
    return null;
  }
  return serverInstance.getPort();
}