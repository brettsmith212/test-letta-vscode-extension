import * as vscode from 'vscode';
import { writeMcpConfig } from '../mcp/config';
import { getOrCreateMcpServer } from '../mcp/server';

const LETTA_PORT = 8283;

/**
 * Checks if Docker is installed and accessible
 * We're skipping the actual Docker check since we know it's running
 */
export async function isDockerInstalled(): Promise<boolean> {
  try {
    console.log('Skipping Docker check - assuming Docker is installed...');
    // Just check if the Letta server is accessible instead
    return await checkLettaHealth();
  } catch (error: any) {
    console.error('Docker check failed:', error);
    return false;
  }
}

/**
 * This function is normally used to run the Letta container if not already running
 * Since we know you already have a Letta container running, we'll just check if it's healthy
 */
export async function runLettaContainer(): Promise<void> {
  try {
    console.log('Skipping running Letta container - assuming it\'s already running...');
    
    // Skip the Docker interaction and just check if the server is healthy
    const isHealthy = await checkLettaHealth();
    
    if (isHealthy) {
      console.log('Letta server is healthy');
      vscode.window.showInformationMessage('Connected to existing Letta server');
      return;
    }
    
    // If not healthy, throw an error
    throw new Error(`Letta server is not responding. Please check if your container is running correctly on port ${LETTA_PORT}.`);
  } catch (error: any) {
    console.error('Failed to connect to Letta server:', error);
    vscode.window.showErrorMessage(`Failed to connect to Letta server: ${error.message || 'Unknown error'}. Check if it's running on port ${LETTA_PORT}.`);
    throw error;
  }
}

/**
 * Checks if the Letta server is healthy
 */
export async function checkLettaHealth(): Promise<boolean> {
  try {
    // Get the server URL from settings or use default
    const config = vscode.workspace.getConfiguration('lettaChat');
    const serverUrl = config.get<string>('serverUrl') || `http://localhost:${LETTA_PORT}`;
    
    // Try a generic connection test to the root endpoint since /health returned 404
    console.log(`Checking Letta connection at ${serverUrl}...`);
    const response = await fetch(serverUrl, {
      // Add timeout to avoid hanging if server is unreachable
      signal: AbortSignal.timeout(5000)
    });
    
    // Any response (even redirect) is considered healthy as long as the server responds
    const healthy = response.status < 500; // Accept any non-server error as "healthy"
    console.log(`Letta connection test result: ${healthy} (status: ${response.status})`);
    if (healthy) {
      // If healthy, show a status message
      vscode.window.setStatusBarMessage('Letta: Connected', 5000);
      
      // Write MCP config with current port setting
      const mcpPort = config.get<number>('mcpPort') || 7428;
      writeMcpConfig(mcpPort);
    } else {
      vscode.window.setStatusBarMessage('Letta: Connection failed', 5000);
    }
    return healthy;
  } catch (error: any) {
    console.error('Letta connection test failed:', error);
    vscode.window.setStatusBarMessage('Letta: Connection error', 5000);
    return false;
  }
}

/**
 * Reconnects to the Letta server:
 * 1. Re-checks health
 * 2. Re-writes MCP config
 * 3. Re-attaches tools
 */
export async function reconnectLetta(): Promise<boolean> {
  try {
    // First attempt to kill any existing MCP server process
    try {
      console.log('Checking for existing MCP processes...');
      // We can't directly kill processes from an extension, but we can attempt to restart ours
      const mcpServer = getOrCreateMcpServer();
      console.log('Stopping current MCP server if it exists...');
      await mcpServer.stop();
    } catch (stopError) {
      console.warn('Error stopping existing MCP server:', stopError);
      // Continue anyway
    }

    // Check if Letta is healthy
    const isHealthy = await checkLettaHealth();
    if (!isHealthy) {
      vscode.window.showErrorMessage(
        'Letta server is not responding. Make sure Docker is running and the container is started with "npm run start:letta" or the start_docker.sh script.',
        'Show Details'
      ).then(selection => {
        if (selection === 'Show Details') {
          vscode.commands.executeCommand('letta-ai.showErrorDetails');
        }
      });
      return false;
    }
    
    // Get MCP server instance and start it with retry logic (it will find an available port)
    const mcpServer = getOrCreateMcpServer();
    console.log('Starting MCP server with port retry logic...');
    await mcpServer.start();
    
    // Config file is written by the start method when port is determined
    
    vscode.window.showInformationMessage('Successfully reconnected to Letta server');
    return true;
  } catch (error: any) {
    console.error('Failed to reconnect to Letta server:', error);
    vscode.window.showErrorMessage(`Failed to reconnect to Letta: ${error.message || 'Unknown error'}`);
    return false;
  }
}