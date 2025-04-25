import * as vscode from 'vscode';
import { LettaClient } from '@letta-ai/letta-client';
import * as crypto from 'crypto';

/**
 * Singleton service for managing Letta client and server
 */
export class LettaService {
  private static instance: LettaService;
  private client: LettaClient | null = null;
  private initialized = false;
  private personaBlockId: string | null = null;
  private context: vscode.ExtensionContext | null = null;
  private workspaceAgentMap: Map<string, {agentId: string, projectBlockId: string}> = new Map();
  private toolsCache: Map<string, string> = new Map(); // Map<toolName, toolId>

  private constructor() {}

  /**
   * Get the singleton instance of LettaService
   */
  public static getInstance(): LettaService {
    if (!LettaService.instance) {
      LettaService.instance = new LettaService();
    }
    return LettaService.instance;
  }

  /**
   * Initialize the LettaService with extension context
   */
  public async initialize(context: vscode.ExtensionContext): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.context = context;

    try {
      // Create Letta client
      const config = vscode.workspace.getConfiguration('lettaChat');
      const serverUrl = config.get<string>('serverUrl') || 'http://localhost:8283';

      console.log(`Initializing Letta client with server URL: ${serverUrl}`);
      this.client = new LettaClient({ baseUrl: serverUrl });

      // Restore persona block ID
      this.personaBlockId = context.globalState.get<string>('lettaPersonaBlockId') || null;

      // Restore saved workspace-agent mappings
      const savedMappings = context.globalState.get<Record<string, {agentId: string, projectBlockId: string}>>('lettaWorkspaceAgents') || {};
      Object.entries(savedMappings).forEach(([key, value]) => {
        this.workspaceAgentMap.set(key, value);
      });

      // Restore tool cache
      const savedTools = context.globalState.get<Record<string, string>>('lettaToolsCache') || {};
      Object.entries(savedTools).forEach(([key, value]) => {
        this.toolsCache.set(key, value);
      });

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize LettaService:', error);
      vscode.window.showErrorMessage('Failed to initialize Letta service');
      throw error;
    }
  }

  /**
   * Get the Letta client instance
   */
  public getClient(): LettaClient {
    if (!this.client) {
      throw new Error('LettaService not initialized');
    }
    return this.client;
  }

  /**
   * Get existing persona block or create a new one
   */
  public async getOrCreatePersonaBlock(): Promise<string> {
    if (!this.context) {
      throw new Error('LettaService not initialized with context');
    }

    if (this.personaBlockId) {
      return this.personaBlockId;
    }

    try {
      const client = this.getClient();
      const block = await client.blocks.create({
        value: `You are a helpful VS Code extension assistant named Letta. You help users with coding tasks, answer questions about their code, and provide assistance with VS Code features. Be concise, friendly, and focus on providing accurate technical information.`,
        label: 'VSCodePersona'
      });
      this.personaBlockId = block.id || null;
      if (block.id) {
        await this.context.globalState.update('lettaPersonaBlockId', block.id);
      }
      return block.id || '';
    } catch (error) {
      console.error('Failed to create persona block:', error);
      throw error;
    }
  }

  /**
   * Gets or creates an agent for a specific workspace
   */
  public async getAgentForWorkspace(workspaceUri: vscode.Uri): Promise<{agentId: string, projectBlockId: string}> {
    if (!this.context) {
      throw new Error('LettaService not initialized with context');
    }

    const workspaceKey = this.getWorkspaceKey(workspaceUri);
    const existing = this.workspaceAgentMap.get(workspaceKey);

    if (existing) {
      try {
        // Verify that the agent still exists on the server
        const client = this.getClient();
        await client.agents.retrieve(existing.agentId);
        return existing;
      } catch (error: any) {
        // If we get a 404, the agent no longer exists on the server
        if (error?.statusCode === 404) {
          console.log(`Agent ${existing.agentId} no longer exists on the server. Creating a new one.`);
          // Remove the stale mapping
          this.workspaceAgentMap.delete(workspaceKey);
          await this.saveWorkspaceAgentMap();
          // Continue to create a new agent
        } else {
          // For other errors, propagate them up
          throw error;
        }
      }
    }

    try {
      const client = this.getClient();
      const personaBlockId = await this.getOrCreatePersonaBlock();

      // Create a project-specific memory block
      const workspaceName = workspaceUri.fsPath.split('/').pop() || 'Workspace';
      const projectBlock = await client.blocks.create({
        value: `This is the project memory for the ${workspaceName} workspace.`,
        label: `${workspaceName}ProjectMemory`
      });

      // Create standard memory blocks for the agent
      const humanBlock = await client.blocks.create({
        value: `Information about the human user.`,
        label: `human`
      });

      const systemBlock = await client.blocks.create({
        value: `System information for the agent.`,
        label: `system`
      });

      // Read config
      const config = vscode.workspace.getConfiguration('lettaChat');
      const model = config.get<string>('model') || 'openai/gpt-4o';
      const embeddingModel = config.get<string>('embeddingModel') || 'letta/letta-free';

      // Include all necessary blocks
      const blockIds = [
        personaBlockId,
        projectBlock.id || '',
        humanBlock.id || '',
        systemBlock.id || ''
      ].filter(id => id !== '');

      // Create the agent, passing `embedding` (string) to satisfy the API
      const agent = await client.agents.create({
        name: `VSCode-${workspaceName}-Agent`,
        description: `VS Code agent for the ${workspaceName} workspace`,
        blockIds: blockIds,
        model,
        embedding: embeddingModel
      } as any);

      // Attach file and terminal tools
      if (agent.id) {
        await this.attachToolsToAgent(agent.id);
      }

      const agentData = { agentId: agent.id || '', projectBlockId: projectBlock.id || '' };
      this.workspaceAgentMap.set(workspaceKey, agentData);
      await this.saveWorkspaceAgentMap();
      return agentData;
    } catch (error) {
      console.error('Failed to create agent for workspace:', error);
      throw error;
    }
  }

  /**
   * Attach tools to an agent using the MCP server
   */
  private async attachToolsToAgent(agentId: string): Promise<void> {
    const client = this.getClient();
    console.log(`[DEBUG] Starting MCP-based attachToolsToAgent for agent ${agentId}`);

    // First, register the MCP server with Letta if not already registered
    try {
      // Check if our MCP server is already registered
      console.log(`[DEBUG] Checking for existing MCP servers`);
      const mcpServers = await client.tools.listMcpServers();
      const isVSCodeServerRegistered = Object.keys(mcpServers).includes('vscode');

      if (!isVSCodeServerRegistered) {
        console.log(`[DEBUG] Registering VS Code MCP server with Letta`);
        await client.tools.addMcpServer({
          serverName: 'vscode',
          serverUrl: 'http://localhost:7428/mcp'
        });
        console.log(`[DEBUG] Successfully registered VS Code MCP server`);
      } else {
        console.log(`[DEBUG] VS Code MCP server already registered`);
      }

      // List all MCP tools available from our server
      console.log(`[DEBUG] Listing MCP tools from VS Code server`);
      const mcpTools = await client.tools.listMcpToolsByServer('vscode');
      console.log(`[DEBUG] Found ${mcpTools.length} MCP tools available`);

      // List tools already attached to the agent
      let attachedTools: any[] = [];
      try {
        console.log(`[DEBUG] Listing tools already attached to agent ${agentId}`);
        attachedTools = await client.agents.tools.list(agentId);
        console.log(`[DEBUG] Found ${attachedTools.length} tools already attached to agent ${agentId}`);
      } catch (error) {
        console.warn(`[DEBUG] Failed to list tools for agent ${agentId}:`, error);
        // Continue with empty list if we can't get existing tools
      }

      // Create map of tool names to track which tools are already attached
      const attachedToolNames = new Set<string>();
      for (const tool of attachedTools) {
        if (tool.name) {
          attachedToolNames.add(tool.name);
        }
      }

      // List of MCP tools we want to use
      const desiredTools = [
        'create_file',
        'update_file',
        'delete_file',
        'read_file',
        'search_files',
        'list_files',
        'run_command',  // Use consistent name with toolRegistry.ts
        'read_terminal_output'
      ];

      // Attach each MCP tool to the agent if not already attached
      for (const toolName of desiredTools) {
        if (attachedToolNames.has(toolName)) {
          console.log(`[DEBUG] Tool ${toolName} already attached to agent ${agentId}, skipping`);
          continue;
        }

        try {
          console.log(`[DEBUG] Adding MCP tool ${toolName} to agent ${agentId}`);
          await client.tools.addMcpTool('vscode', toolName);
          const toolFromLetta = await client.tools.listMcpToolsByServer('vscode')
            .then(tools => tools.find(t => t.name === toolName));

          if (toolFromLetta && toolFromLetta.id) {
            await client.agents.tools.attach(agentId, toolFromLetta.id);
            console.log(`[DEBUG] Successfully attached MCP tool ${toolName} to agent ${agentId}`);
          } else {
            console.error(`[DEBUG] Tool ${toolName} was created but ID couldn't be retrieved`);
          }
        } catch (error) {
          console.error(`[DEBUG] Error attaching MCP tool ${toolName} to agent:`, error);
          // Continue with other tools even if one fails
        }
      }

      console.log(`[DEBUG] Completed MCP-based attachToolsToAgent for agent ${agentId}`);
    } catch (error) {
      console.error(`[DEBUG] Failed to register or attach MCP tools:`, error);
      throw error;
    }
  }

  /**
   * This class no longer needs the old tool creation and attachment methods
   * since we're now using the MCP server for tools. The methods below have
   * been removed:
   * - deleteAndRemoveFromCache
   * - forceCreateAndAttachTool
   * - attachToolToAgent
   */

  /** Hash the workspace path to form a stable key */
  private getWorkspaceKey(workspaceUri: vscode.Uri): string {
    return crypto.createHash('sha256').update(workspaceUri.fsPath).digest('hex');
  }

  /** Persist the workspace-agent map */
  private async saveWorkspaceAgentMap(): Promise<void> {
    if (!this.context) return;
    const obj: Record<string, {agentId: string, projectBlockId: string}> = {};
    this.workspaceAgentMap.forEach((v, k) => obj[k] = v);
    await this.context.globalState.update('lettaWorkspaceAgents', obj);
  }

  /** Persist the tools cache */
  private async saveToolsCache(): Promise<void> {
    if (!this.context) return;
    const obj: Record<string, string> = {};
    this.toolsCache.forEach((v, k) => obj[k] = v);
    await this.context.globalState.update('lettaToolsCache', obj);
  }
}