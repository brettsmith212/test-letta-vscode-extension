import * as vscode from 'vscode';
import { ChatAdapter } from '../services/ChatAdapter';
import { getWebviewContent } from '../views/webview-content';
import { Message, ToolUseBlock, WebviewMessage } from '../types';

export class ChatPanel {
    public static readonly viewType = 'claudeChat';
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _conversationHistory: Message[] = [];
    private _chatAdapter: ChatAdapter;
    private readonly _context: vscode.ExtensionContext;
    private _pendingCommands: { [commandId: string]: { block: ToolUseBlock, resolve: Function, reject: Function } } = {};

    private static _instance: ChatPanel | undefined;

    public static getInstance(extensionUri: vscode.Uri, context: vscode.ExtensionContext): ChatPanel {
        if (!ChatPanel._instance) {
            ChatPanel._instance = new ChatPanel(extensionUri, context);
        }
        return ChatPanel._instance;
    }

    private constructor(private readonly _extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        this._context = context;
        this._chatAdapter = new ChatAdapter();

        // Set workspace URI for the chat adapter if a workspace folder is open
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            this._chatAdapter.setWorkspaceUri(vscode.workspace.workspaceFolders[0].uri);
        }

        // Initialize with empty conversation history (removed loading from globalState)
        this._conversationHistory = [];

        this._panel = vscode.window.createWebviewPanel(
            ChatPanel.viewType,
            'Letta Chat',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(_extensionUri, 'media', 'build')
                ],
                retainContextWhenHidden: true
            }
        );

        this._panel.webview.html = getWebviewContent(this._panel.webview, this._extensionUri);

        // Handle messages from webview
        this._panel.webview.onDidReceiveMessage(
            async (message: WebviewMessage) => {
                switch (message.command) {
                    case 'sendMessage':
                        if (message.text) {
                            await this._handleSendMessage(message.text);
                        }
                        break;
                    case 'cancelMessage':
                        if (message.commandId && this._pendingCommands[message.commandId]) {
                            // Instead of pushing tool_result, resolve with a cancellation object
                            this._pendingCommands[message.commandId].resolve({ cancelled: true });
                            delete this._pendingCommands[message.commandId];
                        }
                        this._cancelCurrentMessage();
                        break;
                    case 'approveCommand':
                        if (message.commandId) {
                            this._chatAdapter.handleCommandApproval(message.commandId);
                        }
                        break;
                    case 'newThread':
                        this._startNewThread();
                        break;
                    case 'restoreHistory':
                        // Send all messages in history to webview
                        this._conversationHistory.forEach((msg, index) => {
                            let text: string;
                            if (typeof msg.content === 'string') {
                                text = msg.content;
                            } else {
                                text = msg.content
                                    .map(block => {
                                        if (block.type === 'text') return block.text;
                                        if (block.type === 'tool_result') return block.content;
                                        return '';
                                    })
                                    .filter(Boolean)
                                    .join('\n');
                            }
                            if (text) {
                                this._panel.webview.postMessage({
                                    command: msg.role === 'user' ? 'addUserMessage' : 'addAssistantMessage',
                                    text,
                                    messageId: index
                                });
                            }
                        });
                        break;
                }
            },
            null,
            this._disposables
        );

        this._panel.onDidDispose(
            () => {
                ChatPanel._instance = undefined;
                this.dispose();
            },
            null,
            this._disposables
        );
    }

    private async _handleSendMessage(text: string) {
        try {
            // Add user message to history
            this._conversationHistory.push({ role: 'user', content: text });

            // Post user message to UI
            this._panel.webview.postMessage({
                command: 'addUserMessage',
                text,
                messageId: this._conversationHistory.length - 1
            });

            // Create stream for Letta messages - pass the panel directly
            await this._chatAdapter.createMessageStream(this._conversationHistory, this._panel);
            
            // Update conversation history with messages from the adapter
            this._conversationHistory = this._chatAdapter.getMessages();
        } catch (error) {
            console.error('handleSendMessage: Error:', error);
            const errorMessage = error instanceof Error ? error.message : 'An error occurred while processing your request.';
            const enhancedError = errorMessage.includes('cannot read') || errorMessage.includes('not found')
                ? `${errorMessage}\nTry running VS Code as administrator, checking file permissions, or ensuring the workspace folder includes the file. Use 'list files' to verify file accessibility.`
                : errorMessage;
            this._panel.webview.postMessage({
                command: 'error',
                text: enhancedError
            });
        }
    }

    private _cancelCurrentMessage() {
        try {
            const cancelSuccess = this._chatAdapter.cancelCurrentStream();
            if (cancelSuccess) {
                // Check if the most recent message is an assistant message with empty content
                // This would happen if cancellation occurs before any content is generated
                const lastMessage = this._conversationHistory[this._conversationHistory.length - 1];
                if (lastMessage && lastMessage.role === 'assistant') {
                    // If the assistant message has no content (empty array or empty string), remove it
                    if (Array.isArray(lastMessage.content) && lastMessage.content.length === 0) {
                        this._conversationHistory.pop();
                    } else if (typeof lastMessage.content === 'string' && lastMessage.content.trim() === '') {
                        this._conversationHistory.pop();
                    }
                }
                
                this._panel.webview.postMessage({
                    command: 'cancelSuccess',
                    text: 'Request cancelled by user'
                });
            }
        } catch (error) {
            console.error('Error cancelling message:', error);
        }
    }

    private _startNewThread() {
        this._conversationHistory = [];
        // Reset the adapter messages as well
        this._chatAdapter = new ChatAdapter();
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            this._chatAdapter.setWorkspaceUri(vscode.workspace.workspaceFolders[0].uri);
        }
        this._panel.webview.postMessage({
            command: 'clearChat'
        });
    }

    public reveal() {
        this._panel.reveal();
    }

    public dispose() {
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}