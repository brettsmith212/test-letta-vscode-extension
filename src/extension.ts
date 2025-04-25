import * as vscode from 'vscode';
import { ChatPanel } from './panels/ChatPanel';
import { LettaService } from './services/LettaService';
import { getOrCreateMcpServer } from './mcp/server';
import { writeMcpConfig } from './mcp/config';
import { indexWorkspace } from './commands/indexWorkspace';
import { clearProjectMemory, clearPersonaMemory } from './commands/flushMemory';
import { reconnectLetta } from './utils/dockerHelper';

export async function activate(context: vscode.ExtensionContext) {
    console.log('Letta AI extension is now active!');

    // Add a command to show detailed error information and retry activation
    context.subscriptions.push(vscode.commands.registerCommand('letta-ai.showErrorDetails', async () => {
        const config = vscode.workspace.getConfiguration('lettaChat');
        const serverUrl = config.get<string>('serverUrl') || 'http://localhost:8283';
        vscode.window.showInformationMessage(
            `Letta Server URL: ${serverUrl}\n` +
            `To reconnect: Run 'Letta AI: Reconnect to Server' from command palette`
        );
    }));

    try {
        console.log('Starting activation sequence...');
        // Start the MCP server
        console.log('Getting or creating MCP server...');
        const mcpServer = getOrCreateMcpServer();
        console.log('Starting MCP server...');
        await mcpServer.start();
        console.log('MCP server started successfully');
        context.subscriptions.push({ dispose: () => mcpServer.stop() });
        
        // Write MCP config file for Letta to discover our tools
        console.log('Writing MCP config...');
        writeMcpConfig();
        console.log('MCP config written successfully');
        
        // Ensure connection to Letta server on startup
        console.log('Reconnecting to Letta server...');
        await reconnectLetta();
        console.log('Reconnection to Letta server complete');
        
        // Initialize the Letta service before registering commands
        console.log('Initializing Letta service...');
        const lettaService = LettaService.getInstance();
        await lettaService.initialize(context);
        console.log('Letta service initialized successfully');

        const openChatCommand = vscode.commands.registerCommand('letta-ai.openChat', () => {
            const panel = ChatPanel.getInstance(context.extensionUri, context);
            panel.reveal();
        });
        
        const indexWorkspaceCommand = vscode.commands.registerCommand(
            'letta-ai.indexWorkspace', 
            () => indexWorkspace()
        );
        
        const clearProjectMemoryCommand = vscode.commands.registerCommand(
            'letta-ai.clearProjectMemory',
            () => clearProjectMemory()
        );
        
        const clearPersonaMemoryCommand = vscode.commands.registerCommand(
            'letta-ai.clearPersonaMemory',
            () => clearPersonaMemory()
        );
        
        const reconnectCommand = vscode.commands.registerCommand(
            'letta-ai.reconnect',
            () => reconnectLetta()
        );

        context.subscriptions.push(
            openChatCommand, 
            indexWorkspaceCommand,
            clearProjectMemoryCommand,
            clearPersonaMemoryCommand,
            reconnectCommand
        );
    } catch (error) {
        console.error('Failed to activate Letta AI extension:', error);
        vscode.window.showErrorMessage(
            'Failed to initialize Letta AI extension. Click "Details" for troubleshooting information.', 
            { modal: false },
            'Details'
        ).then(result => {
            if (result === 'Details') {
                vscode.commands.executeCommand('letta-ai.showErrorDetails');
            }
        });
        
        // Register the command anyway so user can try to reconnect
        const reconnectCommand = vscode.commands.registerCommand(
            'letta-ai.reconnect',
            () => reconnectLetta()
        );
        context.subscriptions.push(reconnectCommand);
    }
}

export async function deactivate() {
    // Stop the MCP server when the extension is deactivated
    const mcpServer = getOrCreateMcpServer();
    await mcpServer.stop();
    console.log('Letta AI extension deactivated');
}