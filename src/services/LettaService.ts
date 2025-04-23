import * as vscode from 'vscode';
import { LettaClient } from '@letta-ai/letta-client';
import * as crypto from 'crypto';
import { fileTools } from '../tools/fileTools';
import { terminalTools } from '../tools/terminalTools';

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
   * Attach tools to an agent, reusing existing tools if possible
   */
  private async attachToolsToAgent(agentId: string): Promise<void> {
    const client = this.getClient();
    
    // Get tools already attached to the agent
    let attachedTools: any[] = [];
    try {
      attachedTools = await client.agents.tools.list(agentId);
    } catch (error) {
      console.warn(`Failed to list tools for agent ${agentId}:`, error);
      // Continue with empty list if we can't get existing tools
    }
    
    // Create map of tool names to IDs for easy lookup
    const attachedToolMap = new Map<string, string>();
    for (const tool of attachedTools) {
      if (tool.jsonSchema && typeof tool.jsonSchema === 'object' && 'name' in tool.jsonSchema) {
        const name = tool.jsonSchema.name;
        if (name && tool.id) {
          attachedToolMap.set(name, tool.id);
          
          // Update our cache while we're at it
          this.toolsCache.set(name, tool.id);
        }
      }
    }
    
    // Process all the tools we need
    const allTools = [...fileTools, ...terminalTools];
    for (const tool of allTools) {
      // Skip if tool is already attached
      if (attachedToolMap.has(tool.name)) {
        console.log(`Tool ${tool.name} already attached to agent ${agentId}`);
        continue;
      }
      
      // Otherwise attach the tool
      await this.attachToolToAgent(agentId, tool.name, tool.description, tool.input_schema);
    }
    
    // Save the tool cache
    await this.saveToolsCache();
  }
  
  /**
   * Attach a single tool to an agent, reusing existing tool if possible
   */
  private async attachToolToAgent(agentId: string, name: string, description: string, inputSchema: any): Promise<void> {
    const client = this.getClient();
    let toolId = this.toolsCache.get(name);
    
    // Check if we have a cached tool ID
    if (toolId) {
      try {
        // Verify that the tool still exists
        await client.tools.retrieve(toolId);
        
        // Tool exists, attach it to the agent
        await client.agents.tools.attach(agentId, toolId);
        return;
      } catch (error: any) {
        // If we get a 404, the tool no longer exists
        if (error?.statusCode === 404) {
          console.log(`Tool ${name} (${toolId}) no longer exists on the server. Creating a new one.`);
          // Clear the stale tool ID
          this.toolsCache.delete(name);
          toolId = undefined;
        } else {
          // For other errors, propagate them up
          throw error;
        }
      }
    }
    
    try {
      // Try to create a new tool
      const created = await client.tools.create({
        description: description,
        sourceCode: JSON.stringify({ name, description, parameters: inputSchema }),
        sourceType: 'function',
        jsonSchema: { name, description, parameters: inputSchema }
      });
      
      if (created.id) {
        // Cache the tool ID
        this.toolsCache.set(name, created.id);
        
        // Attach to the agent
        await client.agents.tools.attach(agentId, created.id);
      }
    } catch (error: any) {
      // Handle the case where the tool already exists (409 Conflict)
      if (error?.statusCode === 409) {
        console.log(`Tool ${name} already exists on the server. Trying to find it.`);
        
        // Try to find the tool by listing all tools and filtering
        const allTools = await client.tools.list();
        const existingTool = allTools.find(tool => 
          tool.jsonSchema && 
          typeof tool.jsonSchema === 'object' && 
          'name' in tool.jsonSchema && 
          tool.jsonSchema.name === name
        );
        
        if (existingTool && existingTool.id) {
          // Found the existing tool
          console.log(`Found existing tool ${name} with ID ${existingTool.id}`);
          
          // Cache the tool ID
          this.toolsCache.set(name, existingTool.id);
          
          // Attach to the agent
          await client.agents.tools.attach(agentId, existingTool.id);
        } else {
          // Couldn't find the tool
          console.error(`Tool ${name} exists but couldn't be found`);
          throw error;
        }
      } else {
        // For other errors, propagate them up
        throw error;
      }
    }
  }

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