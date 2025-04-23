import * as vscode from 'vscode';
import { LettaClient } from '@letta-ai/letta-client';
import { isDockerInstalled, runLettaContainer, checkLettaHealth } from '../utils/dockerHelper';

/**
 * Singleton service for managing Letta client and server
 */
export class LettaService {
  private static instance: LettaService;
  private client: LettaClient | null = null;
  private initialized = false;
  private personaBlockId: string | null = null;
  private context: vscode.ExtensionContext | null = null;

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
        type: 'text',
        content: `You are a helpful VS Code extension assistant named Letta. You help users with coding tasks, answer questions about their code, and provide assistance with VS Code features. Be concise, friendly, and focus on providing accurate technical information.`,
        metadata: {
          name: 'VSCodePersona',
          description: 'VS Code assistant persona',
          type: 'persona'
        }
      } as any);
      
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
}