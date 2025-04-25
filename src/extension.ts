import * as vscode from 'vscode';
import { ChatPanel } from './panels/ChatPanel';
import { LettaService } from './services/LettaService';
import { getOrCreateMcpServer } from './mcp/server';
import { writeMcpConfig } from './mcp/config';

export async function activate(context: vscode.ExtensionContext) {
    console.log('Letta AI extension is now active!');

    try {
        // Start the MCP server
        const mcpServer = getOrCreateMcpServer();
        await mcpServer.start();
        context.subscriptions.push({ dispose: () => mcpServer.stop() });
        
        // Write MCP config file for Letta to discover our tools
        writeMcpConfig();
        
        // Initialize the Letta service before registering commands
        const lettaService = LettaService.getInstance();
        await lettaService.initialize(context);

        const openChatCommand = vscode.commands.registerCommand('letta-ai.openChat', () => {
            const panel = ChatPanel.getInstance(context.extensionUri, context);
            panel.reveal();
        });

        context.subscriptions.push(openChatCommand);
    } catch (error) {
        console.error('Failed to activate Letta AI extension:', error);
        vscode.window.showErrorMessage('Failed to initialize Letta AI extension. Please check if Docker is installed and running.');
    }
}

export async function deactivate() {
    // Stop the MCP server when the extension is deactivated
    const mcpServer = getOrCreateMcpServer();
    await mcpServer.stop();
    console.log('Letta AI extension deactivated');
}