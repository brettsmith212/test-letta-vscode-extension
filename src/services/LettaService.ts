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
      return existing;
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

      // Read config
      const config = vscode.workspace.getConfiguration('lettaChat');
      const model = config.get<string>('model') || 'openai/gpt-4o';
      const embeddingModel = config.get<string>('embeddingModel') || 'letta/letta-free';

      // Create the agent, passing `embedding` (string) to satisfy the API
      const agent = await client.agents.create({
        name: `VSCode-${workspaceName}-Agent`,
        description: `VS Code agent for the ${workspaceName} workspace`,
        blockIds: [personaBlockId, projectBlock.id || ''],
        model,
        embedding: embeddingModel
      } as any);

      // Attach file and terminal tools
      if (agent.id) {
        for (const tool of fileTools) {
          const created = await client.tools.create({
            description: tool.description,
            sourceCode: JSON.stringify({ name: tool.name, description: tool.description, parameters: tool.input_schema }),
            sourceType: 'function',
            jsonSchema: { name: tool.name, description: tool.description, parameters: tool.input_schema }
          });
          if (created.id) {
            await client.agents.tools.attach(agent.id, created.id);
          }
        }
        for (const tool of terminalTools) {
          const created = await client.tools.create({
            description: tool.description,
            sourceCode: JSON.stringify({ name: tool.name, description: tool.description, parameters: tool.input_schema }),
            sourceType: 'function',
            jsonSchema: { name: tool.name, description: tool.description, parameters: tool.input_schema }
          });
          if (created.id) {
            await client.agents.tools.attach(agent.id, created.id);
          }
        }
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
}