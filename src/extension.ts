import * as vscode from 'vscode';
import { ChatPanel } from './panels/ChatPanel';
import { LettaService } from './services/LettaService';

export async function activate(context: vscode.ExtensionContext) {
    console.log('Letta AI extension is now active!');

    try {
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

export function deactivate() {}