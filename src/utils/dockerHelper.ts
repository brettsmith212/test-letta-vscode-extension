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
    
    console.log(`Checking Letta health at ${serverUrl}/health...`);
    // Try to connect to the health endpoint
    const response = await fetch(`${serverUrl}/health`);
    const healthy = response.ok;
    console.log(`Letta health check result: ${healthy}`);
    return healthy;
  } catch (error: any) {
    console.error('Letta health check failed:', error);
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
    // Check if Letta is healthy
    const isHealthy = await checkLettaHealth();
    if (!isHealthy) {
      vscode.window.showErrorMessage('Letta server is not responding. Check if it is running correctly.');
      return false;
    }
    
    // Re-write MCP config to ensure Letta can find our tools
    writeMcpConfig();
    
    // Get MCP server instance (doesn't create a new one if already exists)
    const mcpServer = getOrCreateMcpServer();
    
    // Restart the MCP server to re-register tools
    await mcpServer.stop();
    await mcpServer.start();
    
    vscode.window.showInformationMessage('Successfully reconnected to Letta server');
    return true;
  } catch (error: any) {
    console.error('Failed to reconnect to Letta server:', error);
    vscode.window.showErrorMessage(`Failed to reconnect to Letta: ${error.message || 'Unknown error'}`);
    return false;
  }
}