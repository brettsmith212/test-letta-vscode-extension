import * as vscode from 'vscode';
import { LettaClient } from '@letta-ai/letta-client';
import { isDockerInstalled, runLettaContainer, checkLettaHealth } from '../utils/dockerHelper';
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
      await this.ensureServer();
      
      // Create Letta client
      const config = vscode.workspace.getConfiguration('lettaChat');
      const serverUrl = config.get<string>('serverUrl') || 'http://localhost:8000';
      
      this.client = new LettaClient({
        baseUrl: serverUrl,
      });
      
      // Attempt to restore persona block ID from global state
      this.personaBlockId = context.globalState.get<string>('lettaPersonaBlockId') || null;
      
      // Restore workspace agent mappings from global state
      const savedMappings = context.globalState.get<Record<string, {agentId: string, projectBlockId: string}>>('lettaWorkspaceAgents') || {};
      Object.entries(savedMappings).forEach(([key, value]) => {
        this.workspaceAgentMap.set(key, value);
      });
      
      this.initialized = true;
      
    } catch (error) {
      console.error('Failed to initialize LettaService:', error);
      vscode.window.showErrorMessage('Failed to initialize Letta service');
      throw error;
    }
  }

  /**
   * Ensure the Letta server is running
   */
  public async ensureServer(): Promise<void> {
    // Check if Docker is available
    const dockerAvailable = await isDockerInstalled();
    if (!dockerAvailable) {
      throw new Error('Docker is not installed or not running');
    }
    
    // Check if Letta server is healthy
    const isHealthy = await checkLettaHealth();
    if (!isHealthy) {
      // If not healthy, try to start the container
      await runLettaContainer();
      
      // Wait for server to be ready (up to 30 seconds)
      const maxRetries = 15;
      let retries = 0;
      let serverReady = false;
      
      while (retries < maxRetries && !serverReady) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        serverReady = await checkLettaHealth();
        retries++;
      }
      
      if (!serverReady) {
        throw new Error('Failed to start Letta server after multiple attempts');
      }
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
    
    // If we already have a persona block ID, return it
    if (this.personaBlockId) {
      return this.personaBlockId;
    }
    
    try {
      const client = this.getClient();
      
      // Create a persona block with VS Code assistant persona information
      const block = await client.blocks.create({
        value: `You are a helpful VS Code extension assistant named Letta. You help users with coding tasks, answer questions about their code, and provide assistance with VS Code features. Be concise, friendly, and focus on providing accurate technical information.`,
        label: 'VSCodePersona'
      });
      
      this.personaBlockId = block.id || null;
      
      // Store the block ID in extension's global state
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
   * @param workspaceUri The URI of the workspace
   * @returns Promise resolving to agent ID and project block ID
   */
  public async getAgentForWorkspace(workspaceUri: vscode.Uri): Promise<{agentId: string, projectBlockId: string}> {
    if (!this.context) {
      throw new Error('LettaService not initialized with context');
    }

    // Get workspace key
    const workspaceKey = this.getWorkspaceKey(workspaceUri);
    
    // Check if we already have an agent for this workspace
    const existingAgent = this.workspaceAgentMap.get(workspaceKey);
    if (existingAgent) {
      return existingAgent;
    }

    try {
      const client = this.getClient();
      const personaBlockId = await this.getOrCreatePersonaBlock();
      
      // Create project block for this workspace
      const workspaceName = workspaceUri.fsPath.split('/').pop() || 'Workspace';
      const projectBlock = await client.blocks.create({
        value: `This is the project memory for the ${workspaceName} workspace.`,
        label: `${workspaceName}ProjectMemory`
      });

      // Create agent with persona and project blocks
      const agent = await client.agents.create({
        name: `VSCode-${workspaceName}-Agent`,
        description: `VS Code agent for the ${workspaceName} workspace`,
        blockIds: [personaBlockId, projectBlock.id || ''],
        model: vscode.workspace.getConfiguration('lettaChat').get<string>('model') || 'openai/gpt-4o'
      });

      // Register VS Code tools with the agent
      if (agent.id) {
        // Create and attach file tools
        for (const tool of fileTools) {
          const createdTool = await client.tools.create({
            description: tool.description,
            sourceCode: JSON.stringify({
              name: tool.name,
              description: tool.description,
              parameters: tool.input_schema
            }),
            sourceType: 'function',
            jsonSchema: {
              name: tool.name,
              description: tool.description,
              parameters: tool.input_schema
            }
          });
          
          if (createdTool.id) {
            await client.agents.tools.attach(agent.id, createdTool.id);
          }
        }
        
        // Create and attach terminal tools
        for (const tool of terminalTools) {
          const createdTool = await client.tools.create({
            description: tool.description,
            sourceCode: JSON.stringify({
              name: tool.name,
              description: tool.description,
              parameters: tool.input_schema
            }),
            sourceType: 'function',
            jsonSchema: {
              name: tool.name,
              description: tool.description,
              parameters: tool.input_schema
            }
          });
          
          if (createdTool.id) {
            await client.agents.tools.attach(agent.id, createdTool.id);
          }
        }
      }

      // Store the mapping
      const agentData = {
        agentId: agent.id || '',
        projectBlockId: projectBlock.id || ''
      };
      
      this.workspaceAgentMap.set(workspaceKey, agentData);
      
      // Persist to global state
      await this.saveWorkspaceAgentMap();
      
      return agentData;
    } catch (error) {
      console.error('Failed to create agent for workspace:', error);
      throw error;
    }
  }

  /**
   * Computes a stable key for the workspace based on its path
   * @param workspaceUri The workspace URI
   * @returns A SHA-256 hash of the workspace path
   */
  private getWorkspaceKey(workspaceUri: vscode.Uri): string {
    return crypto.createHash('sha256')
      .update(workspaceUri.fsPath)
      .digest('hex');
  }

  /**
   * Saves the workspace agent map to global state
   */
  private async saveWorkspaceAgentMap(): Promise<void> {
    if (!this.context) {
      return;
    }
    
    const mappingsObject: Record<string, {agentId: string, projectBlockId: string}> = {};
    this.workspaceAgentMap.forEach((value, key) => {
      mappingsObject[key] = value;
    });
    
    await this.context.globalState.update('lettaWorkspaceAgents', mappingsObject);
  }
}