import * as vscode from 'vscode';
import { z } from 'zod';
import { executeTerminalTool } from '../tools/terminalTools';

// Import schemas from terminal tools
import { terminalTools } from '../tools/terminalTools';

// Convert JSON schema to zod schema
const commandSchema = z.object({
  command: z.string().describe("The command to execute in the terminal. Should be a valid shell command."),
  cwd: z.string().optional().describe("Optional. The current working directory where the command should be executed. If not provided, the workspace root will be used."),
  captureOutput: z.boolean().optional().describe("Optional. Whether to capture the output of the command. If true, the command will be run in a way that captures output, if false it just runs in the terminal visibly. Default is false.")
});

/**
 * Tool registry for the MCP server
 * Each tool has a name, schema, and handler function
 */
export const toolRegistry = [
  {
    name: 'execute_command',
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