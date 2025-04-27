import * as vscode from 'vscode';

/**
 * Updates the VS Code setting for MCP port
 */
export async function updateMcpPortSetting(port: number): Promise<void> {
  try {
    const config = vscode.workspace.getConfiguration('lettaChat');
    await config.update('mcpPort', port, vscode.ConfigurationTarget.Global);
    console.log(`Updated lettaChat.mcpPort setting to ${port}`);
  } catch (error) {
    console.error('Failed to update MCP port setting:', error);
  }
}

/**
 * Gets the configured MCP port from settings or returns the default
 */
export function getMcpPortFromSettings(defaultPort: number = 7428): number {
  try {
    const config = vscode.workspace.getConfiguration('lettaChat');
    return config.get<number>('mcpPort') || defaultPort;
  } catch (error) {
    console.error('Failed to get MCP port from settings:', error);
    return defaultPort;
  }
}