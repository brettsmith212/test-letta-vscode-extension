import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { z } from 'zod';

// Define Zod schemas for terminal tools
export const runCommandSchema = z.object({
  command: z.string().describe("The command to execute in the terminal. Should be a valid shell command."),
  cwd: z.string().optional().describe("Optional. The current working directory where the command should be executed. If not provided, the workspace root will be used."),
  captureOutput: z.boolean().optional().describe("Optional. Whether to capture the output of the command. If true, the command will be run in a way that captures output, if false it just runs in the terminal visibly. Default is false.")
});

export const readTerminalOutputSchema = z.object({
  maxLines: z.number().optional().describe("Optional. Maximum number of lines to read from the terminal output. If not specified, will return all available output.")
});

// JSON Schema versions for tools
export const runCommandJsonSchema = {
  type: "object",
  properties: {
    command: {
      type: "string",
      description: "The command to execute in the terminal. Should be a valid shell command."
    },
    cwd: {
      type: "string",
      description: "Optional. The current working directory where the command should be executed. If not provided, the workspace root will be used."
    },
    captureOutput: {
      type: "boolean",
      description: "Optional. Whether to capture the output of the command. If true, the command will be run in a way that captures output, if false it just runs in the terminal visibly. Default is false."
    }
  },
  required: ["command"]
};

export const readTerminalOutputJsonSchema = {
  type: "object",
  properties: {
    maxLines: {
      type: "number",
      description: "Optional. Maximum number of lines to read from the terminal output. If not specified, will return all available output."
    }
  },
  required: []
};

// Define tool schema in Letta-compatible format with single-source definitions
export const terminalTools = [
  {
    name: "run_command",
    description: "Executes the specified terminal command in the VS Code integrated terminal. Use this to run git commands, build commands, or any other CLI commands that would normally be run in a terminal.",
    zod: runCommandSchema,
    jsonSchema: runCommandJsonSchema,
    input_schema: runCommandJsonSchema
  },
  {
    name: "read_terminal_output",
    description: "Reads the output from the most recently executed terminal command if it was run with captureOutput=true. This allows analysis of command output to determine next steps. Useful for git status, npm outputs, curl responses, etc.",
    zod: readTerminalOutputSchema,
    jsonSchema: readTerminalOutputJsonSchema,
    input_schema: readTerminalOutputJsonSchema
  }
];

/**
 * Terminal instance used for executing commands
 */
let terminal: vscode.Terminal | undefined;

/**
 * Store the last command output
 */
let lastCommandOutput: string = '';

/**
 * Executes a command in the VS Code integrated terminal
 * @param command The command to execute
 * @param cwd Optional working directory
 * @param captureOutput Whether to capture the output of the command
 * @returns A string indicating the command was executed
 */
export async function executeTerminalCommand(
  command: string,
  cwd?: string,
  captureOutput: boolean = false
): Promise<string> {
  // Get the workspace root path
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    throw new Error("No workspace folder found. Please open a folder in VS Code.");
  }

  const workingDir = cwd || workspaceFolders[0].uri.fsPath;

  // If not capturing output, just run in the visible terminal
  if (!captureOutput) {
    // Get or create terminal
    if (!terminal || terminal.exitStatus !== undefined) {
      // If terminal doesn't exist or has been closed
      terminal = vscode.window.createTerminal({
        name: "Claude Terminal",
        cwd: workingDir
      });
    } else if (cwd) {
      // Change directory if specified and terminal already exists
      terminal.sendText(`cd "${cwd}"`, true);
    }

    // Show the terminal
    terminal.show();

    // Send the command
    terminal.sendText(command, true);

    // Clear previous output since we're not capturing this one
    lastCommandOutput = '';

    return `Command executed in terminal: ${command}`;
  }

  // If we want to capture output, use a different approach with child_process
  try {
    // Execute the command using child_process.exec, which allows us to capture the output
    const result = await new Promise<string>((resolve, reject) => {
      child_process.exec(command, { cwd: workingDir }, (error, stdout, stderr) => {
        if (error && error.code !== 0) {
          // Still resolve with the output, but include the error
          resolve(`Error (exit code ${error.code}): ${stdout}\n${stderr}`);
        } else {
          resolve(stdout || stderr || "Command executed successfully with no output.");
        }
      });
    });

    // Store the result
    lastCommandOutput = result;

    // Still show the command in the terminal for transparency, but without redirections
    if (!terminal || terminal.exitStatus !== undefined) {
      terminal = vscode.window.createTerminal({
        name: "Claude Terminal",
        cwd: workingDir
      });
    } else if (cwd) {
      terminal.sendText(`cd "${cwd}"`, true);
    }

    terminal.show();
    terminal.sendText(command, true);

    return `Command executed: ${command}`;
  } catch (error) {
    console.error('Error executing terminal command:', error);
    return `Error executing command: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Reads the output from the most recently executed terminal command
 * @param maxLines Optional maximum number of lines to read
 * @returns Terminal output as a string
 */
export async function readTerminalOutput(maxLines?: number): Promise<string> {
  if (!lastCommandOutput) {
    return "No terminal output available. Please run a command with captureOutput=true first.";
  }

  if (maxLines && maxLines > 0) {
    const lines = lastCommandOutput.split('\n');
    return lines.slice(0, maxLines).join('\n');
  }

  return lastCommandOutput;
}

/**
 * Handles execution of terminal tools
 * @param toolName The name of the tool to execute
 * @param input The input parameters for the tool
 * @returns A string response from the tool execution
 */
export async function executeTerminalTool(toolName: string, input: any): Promise<string> {
  console.log(`executeTerminalTool: Tool: ${toolName}, Input:`, input);

  try {
    if (toolName === "run_command") {
      // Validate input against schema
      const params = runCommandSchema.parse(input);
      return await executeTerminalCommand(
        params.command,
        params.cwd,
        params.captureOutput === true
      );
    } else if (toolName === "read_terminal_output") {
      // Validate input against schema
      const params = readTerminalOutputSchema.parse(input);
      return await readTerminalOutput(params.maxLines);
    } else {
      throw new Error(`Unknown terminal tool: ${toolName}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`executeTerminalTool: Error in ${toolName}: ${errorMessage}`);
    throw new Error(`Error executing terminal tool ${toolName}: ${errorMessage}`);
  }
}
