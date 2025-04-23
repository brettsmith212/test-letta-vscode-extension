import * as vscode from 'vscode';
import Docker from 'dockerode';
import type { ContainerInfo, Container } from 'dockerode';

/**
 * Checks if Docker is installed and accessible
 */
export async function isDockerInstalled(): Promise<boolean> {
  try {
    const docker = new Docker();
    await docker.ping();
    return true;
  } catch (error) {
    console.error('Docker check failed:', error);
    return false;
  }
}

/**
 * Runs the Letta container if not already running
 */
export async function runLettaContainer(): Promise<void> {
  try {
    const docker = new Docker();
    
    // Check if Letta container is already running
    const containers = await docker.listContainers();
    const lettaContainer = containers.find((container: ContainerInfo) => 
      container.Names.some((name: string) => name.includes('letta'))
    );
    
    if (lettaContainer) {
      console.log('Letta container already running');
      return;
    }
    
    // Pull latest Letta image if needed
    await new Promise<void>((resolve, reject) => {
      docker.pull('letta/letta:latest', (err: any, stream: any) => {
        if (err) {
          reject(err);
          return;
        }
        
        docker.modem.followProgress(stream, (err: any) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
    
    // Start the container
    await docker.createContainer({
      Image: 'letta/letta:latest',
      name: 'letta-agent-server',
      ExposedPorts: {
        '8000/tcp': {}
      },
      HostConfig: {
        PortBindings: {
          '8000/tcp': [{ HostPort: '8000' }]
        }
      }
    }).then((container: Container) => container.start());
    
    vscode.window.showInformationMessage('Letta server started successfully');
  } catch (error) {
    console.error('Failed to run Letta container:', error);
    vscode.window.showErrorMessage('Failed to start Letta server. Make sure Docker is running.');
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
    const serverUrl = config.get<string>('serverUrl') || 'http://localhost:8000';
    
    // Try to connect to the health endpoint
    const response = await fetch(`${serverUrl}/health`);
    return response.ok;
  } catch (error) {
    console.error('Letta health check failed:', error);
    return false;
  }
}