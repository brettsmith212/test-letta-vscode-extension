import * as vscode from 'vscode';
import { ChatPanel } from './panels/ChatPanel';
import { LettaService } from './services/LettaService';
import { getOrCreateMcpServer } from './mcp/server';
import { writeMcpConfig } from './mcp/config';
import { indexWorkspace } from './commands/indexWorkspace';
import { clearProjectMemory, clearPersonaMemory } from './commands/flushMemory';
import { reconnectLetta } from './utils/dockerHelper';

/**
 * Handles the graceful shutdown of MCP server when VS Code is about to shutdown
 */
function registerShutdownHandler(context: vscode.ExtensionContext) {
    // Handle VS Code shutdown
    const shutdownListener = vscode.workspace.onDidChangeConfiguration(async event => {
        if (event.affectsConfiguration('lettaChat.mcpPort')) {
            console.log('MCP port setting changed, restarting MCP server...');
            try {
                // Stop existing server
                const mcpServer = getOrCreateMcpServer();
                await mcpServer.stop();
                
                // Restart with new port
                await mcpServer.start();
                console.log('MCP server restarted with new port setting');
                
                // Update the Letta connection
                await reconnectLetta();
            } catch (error) {
                console.error('Failed to restart MCP server with new port:', error);
                vscode.window.showErrorMessage(
                    'Failed to restart MCP server with new port setting. See Output panel for details.'
                );
            }
        }
    });
    context.subscriptions.push(shutdownListener);
    
    // Register for window shutdown event
    const windowShutdownListener = vscode.window.onDidChangeWindowState(async state => {
        if (!state.focused) {
            // Window lost focus (might be closing) - we'll log this but not stop the server
            // as this also fires when user simply switches to another window
            console.log('Window lost focus');
        }
    });
    context.subscriptions.push(windowShutdownListener);
    
    // Listen for the VS Code shutdown event
    const shutdownHandler = vscode.workspace.onWillSaveTextDocument(async e => {
        if (e.document.uri.scheme === 'untitled') {
            // This is a heuristic - when VS Code is closing an untitled document it might be
            // saving temp state which indicates window is closing
            console.log('Detected possible window close via untitled document save');
            const mcpServer = getOrCreateMcpServer();
            await mcpServer.stop();
        }
    });
    context.subscriptions.push(shutdownHandler);
    
    // This is the most reliable shutdown handler
    context.subscriptions.push(new vscode.Disposable(() => {
        console.log('Extension is being disposed, stopping MCP server...');
        const mcpServer = getOrCreateMcpServer();
        mcpServer.stop().catch(err => {
            console.error('Error stopping MCP server during shutdown:', err);
        });
    }));
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('Letta AI extension is now active!');

    // Add a command to show detailed error information and retry activation
    context.subscriptions.push(vscode.commands.registerCommand('letta-ai.showErrorDetails', async () => {
        const config = vscode.workspace.getConfiguration('lettaChat');
        const serverUrl = config.get<string>('serverUrl') || 'http://localhost:8283';
        
        // Import getCurrentMcpPort here to avoid circular dependencies
        const { getCurrentMcpPort } = require('./mcp/server');
        const currentPort = getCurrentMcpPort() || 'Not started';
        
        // Try to connect to Letta and get detailed info
        let connectionStatus = 'Unknown';
        try {
            const response = await fetch(serverUrl, { 
                signal: AbortSignal.timeout(3000) 
            });
            connectionStatus = `${response.status} ${response.statusText}`;
        } catch (error) {
            connectionStatus = `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
        
        vscode.window.showInformationMessage(
            `Letta Server URL: ${serverUrl} (Connection Status: ${connectionStatus})\n` +
            `VSCode MCP Server Port: ${currentPort} (should be different from Docker's 7428)\n` +
            `Config File Location: ~/.letta/mcp_config.json\n` +
            `To reconnect: Run 'Letta AI: Reconnect to Server' from the command palette`
        );
    }));
    
    // Register shutdown handler to ensure graceful cleanup
    registerShutdownHandler(context);

    try {
        console.log('Starting activation sequence...');
        // Start the MCP server
        console.log('Getting or creating MCP server...');
        const mcpServer = getOrCreateMcpServer();
        console.log('Starting MCP server with port retry logic...');
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