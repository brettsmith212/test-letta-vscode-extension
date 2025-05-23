import * as vscode from 'vscode';
import { writeMcpConfig } from '../mcp/config';
import { getOrCreateMcpServer, getCurrentMcpPort } from '../mcp/server';

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
    
    // Try both /health and / endpoints in order
    const tryPaths = ['/health', '/'];
    let healthy = false;
    let statusCode = 0;
    
    // Use the timeout only for the entire process, not per request
    const timeout = 5000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      for (const path of tryPaths) {
        const fullUrl = `${serverUrl}${path}`;
        console.log(`Trying health check at ${fullUrl}...`);
        
        try {
          const response = await fetch(fullUrl, {
            signal: controller.signal
          });
          
          statusCode = response.status;
          // Consider any non-server error as "healthy"
          if (response.status < 500) {
            healthy = true;
            console.log(`Health check successful at ${fullUrl} with status ${statusCode}`);
            break;
          } else {
            console.log(`Endpoint ${fullUrl} returned server error ${statusCode}, trying next path`);
          }
        } catch (error) {
          const fetchError = error as Error;
          // If this specific endpoint failed but not due to timeout, try the next one
          if (!controller.signal.aborted) {
            console.log(`Endpoint ${fullUrl} failed: ${fetchError.message}, trying next path`);
          } else {
            throw fetchError; // Re-throw if aborted
          }
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }
    
    console.log(`Final Letta health check result: ${healthy} (status: ${statusCode})`);
    
    if (healthy) {
      // If healthy, show a status message
      vscode.window.setStatusBarMessage('Letta: Connected', 5000);
      
      // Post status to any active chat panels
      notifyWebviewOfStatus('connected');
      
      // Write MCP config with current port setting
      // Get the actual running port from the MCP server if available
      const currentServerPort = getCurrentMcpPort(); 
      const mcpPort = currentServerPort || config.get<number>('mcpPort') || 7428;
      writeMcpConfig(mcpPort);
    } else {
      vscode.window.setStatusBarMessage('Letta: Connection failed', 5000);
      notifyWebviewOfStatus('disconnected');
    }
    
    return healthy;
  } catch (error: any) {
    console.error('Letta health check failed:', error);
    vscode.window.setStatusBarMessage('Letta: Connection error', 5000);
    notifyWebviewOfStatus('error');
    return false;
  }
}

/**
 * Notifies any active webviews of the current Letta connection status
 * @param status The connection status ('connected', 'disconnected', or 'error')
 */
function notifyWebviewOfStatus(status: 'connected' | 'disconnected' | 'error'): void {
  try {
    // Try to get the current chat panel instance if it exists
    const { ChatPanel } = require('../panels/ChatPanel');
    const panel = ChatPanel.getInstance(vscode.Uri.parse('file://'), undefined);
    
    if (panel && panel._panel && panel._panel.webview) {
      // Send the status to the webview
      panel._panel.webview.postMessage({
        command: 'lettaStatus',
        status
      });
    }
  } catch (error) {
    console.log('Could not notify webview of status change:', error);
    // Non-critical error, so we don't need to handle it further
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