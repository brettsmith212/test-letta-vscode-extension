import * as vscode from 'vscode';
import { LettaService } from '../services/LettaService';

/**
 * Command to clear the project memory block for the current workspace
 */
export async function clearProjectMemory() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder is open');
        return;
    }

    try {
        const lettaService = LettaService.getInstance();
        const client = lettaService.getClient();
        
        // Get agent for current workspace
        const { agentId, projectBlockId } = await lettaService.getAgentForWorkspace(workspaceFolder.uri);
        
        // Clear the project block content
        await client.blocks.modify(projectBlockId, {
            value: `This is the project memory for the workspace, freshly reset on ${new Date().toLocaleString()}.`
        });
        
        // Also reset agent's message history
        await client.agents.messages.reset(agentId);
        
        vscode.window.showInformationMessage('Project memory has been cleared');
    } catch (error: unknown) {
        console.error('Error clearing project memory:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to clear project memory: ${errorMessage}`);
    }
}

/**
 * Command to clear the persona memory block shared across all workspaces
 */
export async function clearPersonaMemory() {
    try {
        const lettaService = LettaService.getInstance();
        const client = lettaService.getClient();
        
        // Get persona block ID
        const personaBlockId = await lettaService.getOrCreatePersonaBlock();
        
        // Clear the persona block, retaining basic personality
        await client.blocks.modify(personaBlockId, {
            value: `You are a helpful VS Code extension assistant named Letta. You help users with coding tasks, answer questions about their code, and provide assistance with VS Code features. Be concise, friendly, and focus on providing accurate technical information.`
        });
        
        vscode.window.showInformationMessage('Persona memory has been cleared');
    } catch (error: unknown) {
        console.error('Error clearing persona memory:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to clear persona memory: ${errorMessage}`);
    }
}