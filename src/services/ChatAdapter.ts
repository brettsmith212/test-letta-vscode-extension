import * as vscode from 'vscode';
import type { MessageCreate, MessageCreateRole } from '@letta-ai/letta-client/api/types';
import { LettaService } from './LettaService';
import { Message, ContentBlock, TextBlock, ToolUseBlock, ToolResultBlock } from '../types';
import { executeTool } from '../tools/fileTools';
import { executeTerminalTool } from '../tools/terminalTools';

/**
 * Adapter to convert Letta's messaging protocol to match the UI expectations
 * set by the original Claude-based ChatService
 */
export class ChatAdapter {
  private _messages: Message[] = [];
  private lettaService: LettaService;
  private currentStreamController: AbortController | null = null;
  private pendingCommands: { [commandId: string]: { block: ToolUseBlock, resolve: Function, reject: Function } } = {};
  private workspaceUri: vscode.Uri | null = null;

  constructor() {
    this.lettaService = LettaService.getInstance();
  }

  /**
   * Set the current workspace URI for agent association
   */
  public setWorkspaceUri(uri: vscode.Uri): void {
    this.workspaceUri = uri;
  }

  /**
   * Send a message to the Letta agent and handle the streaming response
   */
  public async sendMessage(userMessage: string): Promise<Message> {
    const message: Message = {
      role: 'user',
      content: userMessage
    };
    this._messages.push(message);

    try {
      const response = await this._getLettaResponse(userMessage);
      this._messages.push(response);
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorResponse: Message = {
        role: 'assistant',
        content: `Error processing request: ${errorMessage}`
      };
      this._messages.push(errorResponse);
      return errorResponse;
    }
  }

  /**
   * Get the current message history
   */
  public getMessages(): Message[] {
    return this._messages;
  }

  /**
   * Cancel the current streaming message if one is active
   */
  public cancelCurrentStream(): boolean {
    if (this.currentStreamController) {
      this.currentStreamController.abort();
      this.currentStreamController = null;
      return true;
    }
    return false;
  }

  /**
   * Create a streaming message connection to Letta for UI updates
   */
  public async createMessageStream(messages: Message[], panel: vscode.WebviewPanel) {
    if (!this.workspaceUri) {
      throw new Error('No workspace URI set. Please open a folder in VS Code.');
    }

    try {
      const client = this.lettaService.getClient();
      const { agentId } = await this.lettaService.getAgentForWorkspace(this.workspaceUri);

      if (!agentId) {
        throw new Error('Could not find or create an agent for the current workspace');
      }

      this.currentStreamController = new AbortController();

      // Convert messages to Letta format
      const lettaMessages: MessageCreate[] = messages.map(msg => ({
        role: msg.role as MessageCreateRole,
        content: typeof msg.content === 'string' 
          ? msg.content 
          : msg.content
              .map(block => {
                if (block.type === 'text') return (block as TextBlock).text;
                if (block.type === 'tool_result') return (block as ToolResultBlock).content;
                return '';
              })
              .filter(Boolean)
              .join('\n')
      }));

      // Generate a new messageId for the response
      const messageId = this._messages.length;

      // Notify UI that assistant response is starting
      panel.webview.postMessage({
        command: 'startAssistantResponse',
        messageId
      });

      // Create Letta streaming request
      const stream = await client.agents.messages.createStream(
        agentId,
        {
          messages: lettaMessages,
          streamTokens: true
        },
        {
          abortSignal: this.currentStreamController.signal
        }
      );

      let assistantContent: ContentBlock[] = [];
      let currentTextBlock: TextBlock | null = null;
      let toolBlock: ToolUseBlock | null = null;
      let currentToolName: string | null = null;
      let currentToolInput: Record<string, any> | null = null;
      
      // Process the Letta stream
      for await (const chunk of stream) {
        // Handle different chunk types based on the response structure
        if (chunk && typeof chunk === 'object') {
          // Check for type property (for assistant_message_start, assistant_message_delta, etc)
          if ('type' in chunk) {
            const chunkType = chunk.type as string;
            
            // Handle assistant message start
            if (chunkType === 'assistant_message_start') {
              // Stream start, initialize
              currentTextBlock = { type: 'text', text: '' };
            }
            // Handle assistant message delta
            else if (chunkType === 'assistant_message_delta' && 'delta' in chunk && chunk.delta) {
              if (currentTextBlock && chunk.delta && typeof chunk.delta === 'object' && 'content' in chunk.delta) {
                // Append text to the current block
                currentTextBlock.text += chunk.delta.content || '';
                
                // Stream text to UI
                panel.webview.postMessage({
                  command: 'appendAssistantResponse',
                  text: chunk.delta.content || '',
                  messageId
                });
              }
            }
            // Handle tool calls
            else if (chunkType === 'tool_call' && 'id' in chunk && 'name' in chunk) {
              // Handle tool call
              const id = chunk.id as string;
              const name = chunk.name as string;
              const args = ('args' in chunk && typeof chunk.args === 'object' && chunk.args !== null) 
                ? chunk.args as Record<string, any>
                : {} as Record<string, any>;
              
              toolBlock = {
                type: 'tool_use',
                id,
                name,
                input: args
              };
              
              if (toolBlock) {
                // Process tool usage immediately
                await this.handleToolUse(toolBlock, panel, messageId);
                
                // Add to assistant content
                assistantContent.push(toolBlock);
              }
              
              // Reset tool state
              toolBlock = null;
              currentToolName = null;
              currentToolInput = null;
            }
            // Handle assistant message stop
            else if (chunkType === 'assistant_message_stop') {
              // Message complete, finalize
              if (currentTextBlock && currentTextBlock.text) {
                assistantContent.push(currentTextBlock);
                currentTextBlock = null;
              }
              
              // Add assistant message to history
              if (assistantContent.length > 0) {
                this._messages.push({ role: 'assistant', content: assistantContent });
              }
              
              // Send the complete message to the UI
              let finalText = '';
              for (const block of assistantContent) {
                if (block.type === 'text') {
                  finalText += (block as TextBlock).text;
                }
              }
              
              // Add a final message to clear any UI spinner and show complete response
              panel.webview.postMessage({
                command: 'addAssistantMessage',
                text: finalText,
                messageId
              });
              
              break;
            }
          } 
          // Check for other formats (in case the API returns differently)
          else if ('content' in chunk && typeof chunk.content === 'string') {
            // Direct content chunk
            if (!currentTextBlock) {
              currentTextBlock = { type: 'text', text: '' };
            }
            
            // Append text to the current block
            currentTextBlock.text += chunk.content;
            
            // Stream text to UI
            panel.webview.postMessage({
              command: 'appendAssistantResponse',
              text: chunk.content,
              messageId
            });
          }
        }
      }

      // If we didn't get an explicit stop message but the stream ended, 
      // we should still finalize the response
      if (currentTextBlock && currentTextBlock.text) {
        assistantContent.push(currentTextBlock);
                
        // Add assistant message to history
        if (assistantContent.length > 0) {
          this._messages.push({ role: 'assistant', content: assistantContent });
        }
        
        // Send the complete message to the UI
        let finalText = '';
        for (const block of assistantContent) {
          if (block.type === 'text') {
            finalText += (block as TextBlock).text;
          }
        }
        
        // Add a final message to clear any UI spinner and show complete response
        panel.webview.postMessage({
          command: 'addAssistantMessage',
          text: finalText,
          messageId
        });
      }

      return assistantContent;
    } catch (error) {
      console.error('createMessageStream: Error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      panel.webview.postMessage({
        command: 'error',
        text: errorMessage
      });
      
      throw error;
    } finally {
      this.currentStreamController = null;
    }
  }

  /**
   * Handle a tool use request from Letta
   */
  private async handleToolUse(toolBlock: ToolUseBlock, panel: vscode.WebviewPanel, messageId: number): Promise<void> {
    try {
      const { name, input, id } = toolBlock;
      let result: string;

      // For terminal commands, we need user approval
      if (name === 'run_command') {
        // Create command ID
        const commandId = id || Math.random().toString(36).substring(2, 10);
        
        // Wait for user approval
        const userApproval = await new Promise<{ cancelled?: boolean }>((resolve) => {
          this.pendingCommands[commandId] = {
            block: toolBlock,
            resolve: (value?: any) => resolve(value || {}),
            reject: () => resolve({ cancelled: true }),
          };
          
          panel.webview.postMessage({
            command: 'proposeCommand',
            text: 'Approve running this terminal command?',
            commandString: input.command,
            commandId
          });
        });
        
        if (userApproval.cancelled) {
          result = 'User cancelled the command before execution.';
        } else {
          // User approved, execute terminal command
          result = await executeTerminalTool(name, input);
        }
      } else if (['create_file', 'update_file', 'delete_file', 'read_file', 'search_files', 'list_files'].includes(name)) {
        // Handle file tools
        result = await executeTool(name, input, true);
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }

      // Create tool result block
      const toolResult: ToolResultBlock = {
        type: 'tool_result',
        tool_use_id: id,
        content: result
      };
      
      // Add tool result to message history for context
      this._messages.push({
        role: 'user',
        content: [toolResult]
      });
      
      // Only display tool results that aren't just confirmations
      if (result && result !== 'Read successful' && !result.startsWith('File contents')) {
        panel.webview.postMessage({
          command: 'addAssistantMessage',
          text: result,
          messageId
        });
      }
    } catch (error) {
      console.error('handleToolUse: Error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      panel.webview.postMessage({
        command: 'error',
        text: `Error executing tool ${toolBlock.name}: ${errorMessage}`
      });
    }
  }

  /**
   * Handle command approvals from UI
   */
  public handleCommandApproval(commandId: string): void {
    if (this.pendingCommands[commandId]) {
      this.pendingCommands[commandId].resolve();
      delete this.pendingCommands[commandId];
    }
  }

  /**
   * Handle command cancellations from UI
   */
  public handleCommandCancellation(commandId: string): void {
    if (this.pendingCommands[commandId]) {
      this.pendingCommands[commandId].resolve({ cancelled: true });
      delete this.pendingCommands[commandId];
    }
    this.cancelCurrentStream();
  }

  /**
   * Get a response from Letta for a user message
   * @private
   */
  private async _getLettaResponse(userMessage: string): Promise<Message> {
    if (!this.workspaceUri) {
      return {
        role: 'assistant',
        content: 'No workspace is open. Please open a folder in VS Code.'
      };
    }

    try {
      const client = this.lettaService.getClient();
      const { agentId } = await this.lettaService.getAgentForWorkspace(this.workspaceUri);

      if (!agentId) {
        throw new Error('Could not find or create an agent for this workspace');
      }

      // Send message to Letta
      const response = await client.agents.messages.create(agentId, {
        messages: [{
          role: 'user' as MessageCreateRole,
          content: userMessage
        }]
      });

      // Convert Letta response to Message format
      let content: string | ContentBlock[] = '';
      
      if (response && 'content' in response) {
        if (Array.isArray(response.content)) {
          // Convert Letta content blocks to our format
          const contentBlocks: ContentBlock[] = response.content
            .filter(block => block && typeof block === 'object')
            .map(block => {
              if ('type' in block && block.type === 'text' && 'text' in block && typeof block.text === 'string') {
                return {
                  type: 'text',
                  text: block.text
                } as TextBlock;
              }
              // For other block types, just convert to string
              return {
                type: 'text',
                text: JSON.stringify(block)
              } as TextBlock;
            });
          
          content = contentBlocks;
        } else if (typeof response.content === 'string') {
          content = response.content;
        }
      }

      return {
        role: 'assistant',
        content
      };
    } catch (error) {
      console.error('_getLettaResponse: Error:', error);
      throw error;
    }
  }
}
