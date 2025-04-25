import * as vscode from 'vscode';
import { z } from 'zod';
import { executeTerminalTool } from '../tools/terminalTools';
import { executeTool } from '../tools/fileTools';

// Import schemas from tools
import { terminalTools } from '../tools/terminalTools';
import { fileTools } from '../tools/fileTools';

// Type for tool registry entries
export type ToolDefinition = {
  name: string;
  description: string;
  schema: any;
  handler: (params: any) => Promise<any>;
};

// Convert JSON schema to zod schema
const commandSchema = z.object({
  command: z.string().describe("The command to execute in the terminal. Should be a valid shell command."),
  cwd: z.string().optional().describe("Optional. The current working directory where the command should be executed. If not provided, the workspace root will be used."),
  captureOutput: z.boolean().optional().describe("Optional. Whether to capture the output of the command. If true, the command will be run in a way that captures output, if false it just runs in the terminal visibly. Default is false.")
});

// Create zod schemas for file operations
const createFileSchema = z.object({
  path: z.string().describe("The relative path to the file, e.g., 'src/newfile.ts'"),
  content: z.string().describe("The content to write to the file")
});

const updateFileSchema = z.object({
  path: z.string().describe("The relative path to the file"),
  content: z.string().describe("The new content to write to the file")
});

const deleteFileSchema = z.object({
  path: z.string().describe("The relative path to the file")
});

const readFileSchema = z.object({
  path: z.string().describe("The file name or relative path to the file")
});

const searchFilesSchema = z.object({
  query: z.string().describe("The search query string")
});

const listFilesSchema = z.object({
  maxResults: z.number().optional().describe("Maximum number of files to return (default: 100)")
});

const readTerminalOutputSchema = z.object({
  maxLines: z.number().optional().describe("Optional. Maximum number of lines to read from the terminal output.")
});

/**
 * Tool registry for the MCP server
 * Each tool has a name, schema, and handler function
 */
export const toolRegistry: ToolDefinition[] = [
  // Terminal Tools
  {
    name: 'run_command',
    description: terminalTools[0].description,
    schema: commandSchema,
    // Handler delegates to the existing executeTerminalTool function
    handler: async (params: z.infer<typeof commandSchema>) => {
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