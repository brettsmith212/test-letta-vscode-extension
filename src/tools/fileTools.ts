import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { z } from 'zod';

// Define Zod schemas for file tools
export const createFileSchema = z.object({
  path: z.string().describe("The relative path to the file, e.g., 'src/newfile.ts'"),
  content: z.string().describe("The content to write to the file")
});

export const updateFileSchema = z.object({
  path: z.string().describe("The relative path to the file"),
  content: z.string().describe("The new content to write to the file")
});

export const deleteFileSchema = z.object({
  path: z.string().describe("The relative path to the file")
});

export const readFileSchema = z.object({
  path: z.string().describe("The file name or relative path to the file")
});

export const searchFilesSchema = z.object({
  query: z.string().describe("The search query string")
});

export const listFilesSchema = z.object({
  maxResults: z.number().optional().describe("Maximum number of files to return (default: 100)")
});

// JSON Schema versions for tools
export const createFileJsonSchema = {
  type: "object",
  properties: {
    path: { type: "string", description: "The relative path to the file, e.g., 'src/newfile.ts'" },
    content: { type: "string", description: "The content to write to the file" }
  },
  required: ["path", "content"]
};

export const updateFileJsonSchema = {
  type: "object",
  properties: {
    path: { type: "string", description: "The relative path to the file" },
    content: { type: "string", description: "The new content to write to the file" }
  },
  required: ["path", "content"]
};

export const deleteFileJsonSchema = {
  type: "object",
  properties: {
    path: { type: "string", description: "The relative path to the file" }
  },
  required: ["path"]
};

export const readFileJsonSchema = {
  type: "object",
  properties: {
    path: { type: "string", description: "The file name or relative path to the file" }
  },
  required: ["path"]
};

export const searchFilesJsonSchema = {
  type: "object",
  properties: {
    query: { type: "string", description: "The search query string" }
  },
  required: ["query"]
};

export const listFilesJsonSchema = {
  type: "object",
  properties: {
    maxResults: { type: "number", description: "Maximum number of files to return (default: 100)", default: 100 }
  },
  required: []
};

// Define tool schema in Letta-compatible format with single-source definitions
export const fileTools = [
  {
    name: "create_file",
    description: "Creates a new file with the specified content at the given path, or overwrites it if it already exists. Use this when you need to create a new file or replace an existing one in the project. The path should be relative to the workspace root.",
    zod: createFileSchema,
    jsonSchema: createFileJsonSchema,
    input_schema: createFileJsonSchema
  },
  {
    name: "update_file",
    description: "Updates the entire content of an existing file at the given path. Use this when you need to modify an existing file. The path should be relative to the workspace root. Note: This will replace the entire file content, so ensure the new content is complete and correct.",
    zod: updateFileSchema,
    jsonSchema: updateFileJsonSchema,
    input_schema: updateFileJsonSchema
  },
  {
    name: "delete_file",
    description: "Deletes the file at the given path. Use this when you need to remove a file from the project. The path should be relative to the workspace root.",
    zod: deleteFileSchema,
    jsonSchema: deleteFileJsonSchema,
    input_schema: deleteFileJsonSchema
  },
  {
    name: "read_file",
    description: "Reads the content of a file by searching for it recursively in the workspace, including the root directory. Use this to inspect a file to answer a question or perform an action. Provide the file name (e.g., 'main.go') or a relative path (e.g., 'cmd/main.go'). If multiple files match, you will need to specify the full path. If you do not know the path, use the 'search_files' tool first to find the file before reading or operating on it.",
    zod: readFileSchema,
    jsonSchema: readFileJsonSchema,
    input_schema: readFileJsonSchema
  },
  {
    name: "search_files",
    description: "Searches for files in the workspace that match the given query. Returns a list of file paths. Use this tool to find the location of a file before operating on it if the path is not fully specified.",
    zod: searchFilesSchema,
    jsonSchema: searchFilesJsonSchema,
    input_schema: searchFilesJsonSchema
  },
  {
    name: "list_files",
    description: "Lists all files in the workspace recursively, excluding node_modules, with diagnostics including readability status. Use this to verify which files are visible or accessible.",
    zod: listFilesSchema,
    jsonSchema: listFilesJsonSchema,
    input_schema: listFilesJsonSchema
  }
];

async function findFileRecursively(rootPath: string, fileName: string): Promise<string | null> {
  console.log(`findFileRecursively: Searching for ${fileName} in ${rootPath}`);
  try {
    const entries = await fs.readdir(rootPath, { withFileTypes: true });
    const lowerFileName = fileName.toLowerCase();
    for (const entry of entries) {
      const fullPath = path.join(rootPath, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        const result = await findFileRecursively(fullPath, fileName);
        if (result) {
          console.log(`findFileRecursively: Found ${fileName} at ${result}`);
          return result;
        }
      } else if (entry.isFile() && entry.name.toLowerCase() === lowerFileName) {
        console.log(`findFileRecursively: Found ${fileName} at ${fullPath}`);
        return fullPath;
      }
    }
    console.log(`findFileRecursively: No match for ${fileName} in ${rootPath}`);
    return null;
  } catch (error) {
    console.error(`findFileRecursively: Error in ${rootPath}:`, error);
    return null;
  }
}

export async function executeTool(toolName: string, input: any, showContents: boolean = false): Promise<string> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    console.error('executeTool: No workspace folder found');
    throw new Error("No workspace folder found. Please open a folder in VS Code.");
  }
  const rootPath = workspaceFolders[0].uri.fsPath;
  console.log(`executeTool: Workspace root: ${rootPath}, Tool: ${toolName}, Input:`, input);

  // Check workspace exclusions
  let excludePatterns = {};
  try {
    const settings = vscode.workspace.getConfiguration('files', workspaceFolders[0].uri);
    if (settings && typeof settings.get === 'function') {
      excludePatterns = settings.get<Record<string, boolean>>('exclude', {});
    }
  } catch (error) {
    console.warn('Failed to get workspace exclusions:', error);
  }
  console.log(`executeTool: Files.exclude patterns:`, excludePatterns);

  try {
    console.log(`Executing tool: ${toolName} with input:`, input);
    
    switch (toolName) {
      case "create_file": {
        // Validate input against schema
        const params = createFileSchema.parse(input);
        
        if (path.isAbsolute(params.path)) {
          throw new Error("Absolute paths are not allowed. Please provide a relative path to the workspace root.");
        }
        const filePath = path.join(rootPath, params.path);
        const relativePath = path.relative(rootPath, filePath);
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
          throw new Error("Path is outside the workspace");
        }
        const uri = vscode.Uri.file(filePath);
        console.log(`executeTool: ${toolName} at ${uri.fsPath}`);
        
        // Check if file exists before creating it
        try {
          await vscode.workspace.fs.stat(uri);
          
          // File exists, ask for confirmation before overwriting
          const choice = await vscode.window.showWarningMessage(
            `File ${params.path} already exists. Do you want to overwrite it?`,
            { modal: true },
            'Yes',
            'Cancel'
          );
          
          if (choice !== 'Yes') {
            console.log(`Create file operation cancelled for ${params.path}`);
            return `Operation cancelled: File ${params.path} was not overwritten.`;
          }
          
          console.log(`User confirmed overwrite of ${params.path}`);
        } catch (error) {
          // File doesn't exist, no confirmation needed
          console.log(`File ${params.path} doesn't exist yet, creating new file.`);
        }
        
        const encoder = new TextEncoder();
        await vscode.workspace.fs.writeFile(uri, encoder.encode(params.content));
        const result = `File ${params.path} has been created or updated.`;
        console.log(`Tool ${toolName} executed successfully:`, result);
        return result;
      }
      case "update_file": {
        // Validate input against schema
        const params = updateFileSchema.parse(input);
        
        if (path.isAbsolute(params.path)) {
          throw new Error("Absolute paths are not allowed. Please provide a relative path to the workspace root.");
        }
        const filePath = path.join(rootPath, params.path);
        const relativePath = path.relative(rootPath, filePath);
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
          throw new Error("Path is outside the workspace");
        }
        const uri = vscode.Uri.file(filePath);
        console.log(`executeTool: ${toolName} at ${uri.fsPath}`);
        
        // Check if file exists before updating it
        try {
          await vscode.workspace.fs.stat(uri);
        } catch (error) {
          throw new Error(`File ${params.path} does not exist. Use create_file instead.`);
        }
        
        // Show confirmation dialog before update
        const choice = await vscode.window.showWarningMessage(
          `Are you sure you want to update file ${params.path}? This will replace its entire contents.`,
          { modal: true },
          'Yes',
          'Cancel'
        );
        
        if (choice !== 'Yes') {
          console.log(`Update operation cancelled for ${params.path}`);
          return `Operation cancelled: File ${params.path} was not updated.`;
        }
        
        console.log(`User confirmed update of ${params.path}`);
        
        const encoder = new TextEncoder();
        await vscode.workspace.fs.writeFile(uri, encoder.encode(params.content));
        const result = `File ${params.path} has been updated.`;
        console.log(`Tool ${toolName} executed successfully:`, result);
        return result;
      }
      case "delete_file": {
        // Validate input against schema
        const params = deleteFileSchema.parse(input);
        
        if (path.isAbsolute(params.path)) {
          throw new Error("Absolute paths are not allowed. Please provide a relative path to the workspace root.");
        }
        const deletePath = path.join(rootPath, params.path);
        const deleteRelative = path.relative(rootPath, deletePath);
        if (deleteRelative.startsWith('..') || path.isAbsolute(deleteRelative)) {
          throw new Error("Path is outside the workspace");
        }
        const deleteUri = vscode.Uri.file(deletePath);
        console.log(`executeTool: delete_file at ${deleteUri.fsPath}`);
        
        // Show confirmation dialog before deletion
        const choice = await vscode.window.showWarningMessage(
          `Are you sure you want to delete file ${params.path}?`,
          { modal: true },
          'Yes',
          'Cancel'
        );
        
        if (choice !== 'Yes') {
          console.log(`Delete operation cancelled for ${params.path}`);
          return `Operation cancelled: File ${params.path} was not deleted.`;
        }
        
        console.log(`User confirmed deletion of ${params.path}`);
        await vscode.workspace.fs.delete(deleteUri);
        const deleteResult = `File ${params.path} has been deleted.`;
        console.log(`Tool delete_file executed successfully:`, deleteResult);
        return deleteResult;
      }
      case "read_file": {
        // Validate input against schema
        const params = readFileSchema.parse(input);
        
        if (path.isAbsolute(params.path)) {
          throw new Error("Absolute paths are not allowed. Please provide a relative path to the workspace root.");
        }
        console.log(`read_file: Attempting to find file: ${params.path}`);
        let readUri: vscode.Uri;
        // Try exact path first
        try {
          readUri = vscode.Uri.file(path.join(rootPath, params.path));
          console.log(`read_file: Checking exact path: ${readUri.fsPath}`);
          await fs.access(readUri.fsPath, fs.constants.R_OK);
          console.log(`read_file: Exact path is readable: ${readUri.fsPath}`);
        } catch (exactPathError) {
          console.log(`read_file: Exact path ${params.path} not accessible:`, exactPathError);
          // Try findFiles
          const fileName = path.basename(params.path);
          const patterns = [
            `**/${fileName}`,
            fileName,
            `*/${fileName}`,
            `cmd/${fileName}`,
            `src/${fileName}`
          ];
          let uris: vscode.Uri[] = [];
          for (const pattern of patterns) {
            console.log(`read_file: Trying pattern: ${pattern}`);
            uris = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 100);
            if (uris.length > 0) {
              console.log(`read_file: findFiles found ${uris.length} matches for pattern ${pattern}`);
              break;
            }
          }

          if (uris.length === 0) {
            console.log(`read_file: No matches with findFiles, trying recursive FS search`);
            const foundPath = await findFileRecursively(rootPath, fileName);
            if (!foundPath) {
              console.error(`read_file: No files found for ${params.path}`);
              throw new Error(`File ${params.path} not found in workspace. Try 'list files' to see all files or 'search files ${fileName}' to locate it. Check if the file is excluded in settings (files.exclude) or if the workspace needs to be re-opened.`);
            }
            readUri = vscode.Uri.file(foundPath);
            console.log(`read_file: FS search found: ${readUri.fsPath}`);
          } else if (uris.length > 1) {
            const paths = uris.map(uri => path.relative(rootPath, uri.fsPath)).join(', ');
            console.error(`read_file: Multiple matches for ${fileName}: ${paths}`);
            throw new Error(`Multiple files named ${fileName} found: ${paths}. Please specify the full path (e.g., cmd/${fileName} or src/${fileName}).`);
          } else {
            readUri = uris[0];
            console.log(`read_file: findFiles selected: ${readUri.fsPath}`);
          }

          // Verify readability of found file
          try {
            await fs.access(readUri.fsPath, fs.constants.R_OK);
            console.log(`read_file: Selected file is readable: ${readUri.fsPath}`);
          } catch (accessError) {
            console.error(`read_file: Cannot read selected file ${readUri.fsPath}:`, accessError);
            throw new Error(`Found ${params.path} at ${path.relative(rootPath, readUri.fsPath)}, but cannot read it due to permissions or system issues. Try checking file permissions or running VS Code with elevated privileges.`);
          }
        }

        // Ensure the found file is within the workspace
        const readPath = readUri.fsPath;
        const readRelative = path.relative(rootPath, readPath);
        if (readRelative.startsWith('..') || path.isAbsolute(readRelative)) {
          throw new Error("Found file is outside the workspace");
        }

        // Try VS Code FS first
        try {
          console.log(`read_file: Attempting VS Code fs.readFile: ${readUri.fsPath}`);
          const fileData = await vscode.workspace.fs.readFile(readUri);
          const content = new TextDecoder().decode(fileData);
          console.log(`read_file: Successfully read ${readUri.fsPath} with VS Code FS, content length: ${content.length}, showContents: ${showContents}`);
          const readResult = showContents ? content : 'Read successful';
          console.log(`Tool read_file executed successfully:`, readResult);
          return readResult;
        } catch (vscodeError) {
          console.log(`read_file: VS Code fs.readFile failed:`, vscodeError);
          // Fallback to Node.js FS
          try {
            console.log(`read_file: Falling back to Node.js fs.readFile: ${readUri.fsPath}`);
            const content = await fs.readFile(readUri.fsPath, 'utf8');
            console.log(`read_file: Successfully read ${readUri.fsPath} with Node.js FS, content length: ${content.length}, showContents: ${showContents}`);
            const readResult = showContents ? content : 'Read successful';
            console.log(`Tool read_file executed successfully:`, readResult);
            return readResult;
          } catch (nodeError) {
            console.error(`read_file: Node.js fs.readFile failed:`, nodeError);
            throw new Error(`Found ${params.path} at ${path.relative(rootPath, readUri.fsPath)}, but cannot read it: ${nodeError instanceof Error ? nodeError.message : String(nodeError)}. Try checking file permissions or running VS Code with elevated privileges.`);
          }
        }
      }
      case "search_files": {
        // Validate input against schema
        const params = searchFilesSchema.parse(input);
        
        const pattern = `**/*${params.query}*`;
        console.log(`search_files: Searching with pattern: ${pattern}`);
        const uris = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 100);
        const files = uris.map(uri => {
          const workspaceFolder = vscode.workspace.workspaceFolders?.find(folder =>
            uri.fsPath.startsWith(folder.uri.fsPath)
          );
          return workspaceFolder ? path.relative(workspaceFolder.uri.fsPath, uri.fsPath) : uri.fsPath;
        });
        const searchResult = files.join('\n');
        console.log(`Tool search_files executed successfully:`, searchResult);
        return searchResult;
      }
      case "list_files": {
        // Validate input against schema
        const params = listFilesSchema.parse(input);
        
        const maxResults = params.maxResults || 100;
        console.log(`list_files: Listing up to ${maxResults} files`);
        const listUris = await vscode.workspace.findFiles('**/*', '**/node_modules/**', maxResults);
        const listFiles: string[] = [];
        for (const uri of listUris) {
          const relPath = path.relative(rootPath, uri.fsPath);
          let status = 'Readable';
          try {
            await fs.access(uri.fsPath, fs.constants.R_OK);
          } catch {
            status = 'Not readable';
          }
          listFiles.push(`${relPath} (${status})`);
        }
        const diagnostics = [
          `Workspace root: ${rootPath}`,
          `Files.exclude: ${JSON.stringify(excludePatterns)}`
        ];
        const listResult = listFiles.length > 0 
          ? `${diagnostics.join('\n')}\n\nFiles:\n${listFiles.join('\n')}`
          : `${diagnostics.join('\n')}\n\nNo files found in workspace.`;
        console.log(`Tool list_files executed successfully:`, listResult);
        return listResult;
      }
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`executeTool: Error in ${toolName}: ${errorMessage}`);
    throw new Error(`Error executing tool ${toolName}: ${errorMessage}`);
  }
}

export async function searchFiles(query: string): Promise<string[]> {
  const pattern = `**/*${query}*`;
  try {
    const uris = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 100);
    const files = uris.map(uri => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.find(folder =>
        uri.fsPath.startsWith(folder.uri.fsPath)
      );
      return workspaceFolder ? path.relative(workspaceFolder.uri.fsPath, uri.fsPath) : uri.fsPath;
    });
    return files;
  } catch (error) {
    console.error('searchFiles: Error:', error);
    throw new Error('Failed to search files');
  }
}