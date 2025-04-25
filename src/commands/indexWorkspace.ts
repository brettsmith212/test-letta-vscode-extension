import * as vscode from 'vscode';
import { LettaService } from '../services/LettaService';
import * as path from 'path';
import * as fs from 'fs/promises';
import { LettaClient } from '@letta-ai/letta-client';
import Letta from '@letta-ai/letta-client';

/**
 * Command to index the entire workspace for the Letta agent
 * Scans files, chunks them, and uploads to Letta as archival memory
 */
export async function indexWorkspace() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder is open');
        return;
    }

    // Show progress indicator
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Indexing workspace for Letta agent...',
            cancellable: true,
        },
        async (progress, token) => {
            try {
                const lettaService = LettaService.getInstance();
                const client = lettaService.getClient();
                
                // Get agent for current workspace
                const { agentId, projectBlockId } = await lettaService.getAgentForWorkspace(workspaceFolder.uri);
                
                // Get list of files to index (excluding node_modules, .git, etc.)
                const filePaths = await getWorkspaceFiles(workspaceFolder.uri.fsPath, token);
                const totalFiles = filePaths.length;
                
                if (totalFiles === 0) {
                    vscode.window.showInformationMessage('No suitable files found for indexing');
                    return;
                }
                
                // No need to create archival source as we're directly adding to agent memory
                
                // Process files in batches
                let processedFiles = 0;
                for (const filePath of filePaths) {
                    if (token.isCancellationRequested) {
                        vscode.window.showInformationMessage('Workspace indexing was cancelled');
                        return;
                    }
                    
                    try {
                        // Read file content
                        const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
                        const content = await fs.readFile(filePath, 'utf-8');
                        
                        // Add the file content directly to agent memory
                        const formattedContent = content.length > 8000 ? content.substring(0, 8000) + '... (truncated)' : content;
                        await client.agents.messages.create(agentId, {
                            messages: [{
                                role: 'user',
                                content: `File: ${relativePath}\n\n${formattedContent}`
                            }]
                        });
                        
                        // Update progress
                        processedFiles++;
                        progress.report({
                            message: `Indexed ${processedFiles} of ${totalFiles} files`,
                            increment: (1 / totalFiles) * 100
                        });
                    } catch (err) {
                        console.error(`Error indexing file ${filePath}:`, err);
                        // Continue with other files
                    }
                }
                
                // No need to connect sources, as we're directly creating passages for the agent
                
                // Reset agent messages since we've added a lot of content
                await client.agents.messages.reset(agentId);
                
                vscode.window.showInformationMessage(
                    `Workspace indexed: ${processedFiles} files added to Letta agent memory`
                );
            } catch (error: unknown) {
                console.error('Error indexing workspace:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                vscode.window.showErrorMessage(`Failed to index workspace: ${errorMessage}`);
            }
        }
    );
}

/**
 * Gets all workspace files suitable for indexing
 */
async function getWorkspaceFiles(rootPath: string, token: vscode.CancellationToken): Promise<string[]> {
    // Get workspace configuration for file exclusions
    const config = vscode.workspace.getConfiguration('lettaChat');
    const enableFileIndexing = config.get<boolean>('enableFileIndexing', true);
    
    if (!enableFileIndexing) {
        return [];
    }
    
    // Default exclusion patterns
    const excludePatterns = [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.vscode/**',
        '**/*.{jpg,jpeg,png,gif,bmp,ico,webp,mp3,mp4,wav,webm,zip,gz,tar}'
    ];
    
    // Create glob pattern to match all files except excluded ones
    const include = '**/*';
    const exclude = excludePatterns;
    
    // Use VS Code's built-in file finding
    const files = await vscode.workspace.findFiles(include, excludePatterns.join(','), undefined, token);
    
    // Convert to file paths
    return files.map(file => file.fsPath);
}

// No longer needed since we're directly creating passages for the agent