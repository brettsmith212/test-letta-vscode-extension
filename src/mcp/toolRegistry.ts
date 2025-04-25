import * as vscode from 'vscode';
import { z } from 'zod';
import { executeTerminalTool } from '../tools/terminalTools';
import { executeTool } from '../tools/fileTools';

// Import schemas from tools
import { 
  terminalTools, 
  runCommandSchema, 
  readTerminalOutputSchema
} from '../tools/terminalTools';

import { 
  fileTools,
  createFileSchema,
  updateFileSchema,
  deleteFileSchema,
  readFileSchema,
  searchFilesSchema,
  listFilesSchema
} from '../tools/fileTools';

// Type for tool registry entries
export type ToolDefinition = {
  name: string;
  description: string;
  schema: any;
  handler: (params: any) => Promise<any>;
};

// All schemas are now imported from their respective tool modules

/**
 * Tool registry for the MCP server
 * Each tool has a name, schema, and handler function
 */
export const toolRegistry: ToolDefinition[] = [
  // Terminal Tools
  {
    name: 'run_command',
    description: terminalTools[0].description,
    schema: runCommandSchema,
    // Handler delegates to the existing executeTerminalTool function
    handler: async (params: z.infer<typeof runCommandSchema>) => {
      // Check if the user approved the command execution
      const approved = await showCommandApprovalDialog(params.command);
      if (!approved) {
        return "Command execution cancelled by user.";
      }

      // Execute the command using the existing terminal tool implementation
      return await executeTerminalTool("run_command", params);
    }
  },
  {
    name: 'read_terminal_output',
    description: terminalTools[1].description,
    schema: readTerminalOutputSchema,
    handler: async (params: z.infer<typeof readTerminalOutputSchema>) => {
      return await executeTerminalTool("read_terminal_output", params);
    }
  },
  
  // File Tools
  {
    name: 'create_file',
    description: fileTools[0].description,
    schema: createFileSchema,
    handler: async (params: z.infer<typeof createFileSchema>) => {
      return await executeTool("create_file", params, true);
    }
  },
  {
    name: 'update_file',
    description: fileTools[1].description,
    schema: updateFileSchema,
    handler: async (params: z.infer<typeof updateFileSchema>) => {
      return await executeTool("update_file", params, true);
    }
  },
  {
    name: 'delete_file',
    description: fileTools[2].description,
    schema: deleteFileSchema,
    handler: async (params: z.infer<typeof deleteFileSchema>) => {
      return await executeTool("delete_file", params, true);
    }
  },
  {
    name: 'read_file',
    description: fileTools[3].description,
    schema: readFileSchema,
    handler: async (params: z.infer<typeof readFileSchema>) => {
      return await executeTool("read_file", params, true);
    }
  },
  {
    name: 'search_files',
    description: fileTools[4].description,
    schema: searchFilesSchema,
    handler: async (params: z.infer<typeof searchFilesSchema>) => {
      return await executeTool("search_files", params, true);
    }
  },
  {
    name: 'list_files',
    description: fileTools[5].description,
    schema: listFilesSchema,
    handler: async (params: z.infer<typeof listFilesSchema>) => {
      return await executeTool("list_files", params, true);
    }
  },
];

/**
 * Shows a dialog asking the user to approve command execution
 * @param command The command to approve
 * @returns Promise that resolves to true if approved, false otherwise
 */
async function showCommandApprovalDialog(command: string): Promise<boolean> {
  const response = await vscode.window.showWarningMessage(
    `Do you want to run this command?\n\n${command}`,
    { modal: true },
    'Yes, run it',
    'Cancel'
  );
  
  return response === 'Yes, run it';
}