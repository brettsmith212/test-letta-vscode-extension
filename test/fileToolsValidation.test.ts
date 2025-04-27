import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeTool, createFileSchema, updateFileSchema, deleteFileSchema, readFileSchema, searchFilesSchema, listFilesSchema } from '../src/tools/fileTools';
import * as vscode from 'vscode';

// Mock vscode
// Mock vscode workspace and configuration
vi.mock('vscode', () => {
  const mockUris = [{ fsPath: '/test/workspace/test.txt' }];
  
  return {
    workspace: {
      workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
      fs: {
        writeFile: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockResolvedValue(new Uint8Array([116, 101, 115, 116])), // 'test' in bytes
        delete: vi.fn().mockResolvedValue(undefined)
      },
      getConfiguration: vi.fn().mockImplementation(() => ({
        get: vi.fn().mockReturnValue({})
      })),
      findFiles: vi.fn().mockImplementation(() => Promise.resolve(mockUris))
    },
    Uri: { file: (path: string) => ({ fsPath: path }) }
  };
});

// Mock fs/promises
vi.mock('fs/promises', async () => {
  return {
    access: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('file content'),
    readdir: vi.fn().mockResolvedValue([]),
    constants: { R_OK: 4 }
  };
});

describe('file tools validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('create_file tool', () => {
    it('should validate path and content parameters', async () => {
      // This should fail validation - missing content
      await expect(executeTool('create_file', {
        path: 'test.txt'
        // Missing required property 'content'
      })).rejects.toThrow();

      // This should fail validation - missing path
      await expect(executeTool('create_file', {
        content: 'test content'
        // Missing required property 'path'
      })).rejects.toThrow();

      // This should fail validation - wrong type
      await expect(executeTool('create_file', {
        path: 123, // wrong type
        content: 'test content'
      })).rejects.toThrow();

      // This should pass validation
      const mockWrite = vi.spyOn(vscode.workspace.fs, 'writeFile');
      await executeTool('create_file', {
        path: 'test.txt',
        content: 'test content'
      });
      expect(mockWrite).toHaveBeenCalled();
    });
  });

  describe('update_file tool', () => {
    it('should validate path and content parameters', async () => {
      // This should fail validation
      await expect(executeTool('update_file', {
        // Missing required property 'content'
        path: 'test.txt'
      })).rejects.toThrow();

      // This should pass validation
      const mockWrite = vi.spyOn(vscode.workspace.fs, 'writeFile');
      await executeTool('update_file', {
        path: 'test.txt',
        content: 'updated content'
      });
      expect(mockWrite).toHaveBeenCalled();
    });
  });

  describe('delete_file tool', () => {
    it('should validate path parameter', async () => {
      // This should fail validation
      await expect(executeTool('delete_file', {
        // Missing required property 'path'
      })).rejects.toThrow();

      // This should pass validation
      const mockDelete = vi.spyOn(vscode.workspace.fs, 'delete');
      await executeTool('delete_file', {
        path: 'test.txt'
      });
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe('read_file tool', () => {
    it('should validate path parameter', async () => {
      // This should fail validation
      await expect(executeTool('read_file', {
        // Missing required property 'path'
      })).rejects.toThrow();

      // This should pass validation
      await executeTool('read_file', {
        path: 'test.txt'
      });
      
      // We're testing validation, not detailed implementation
      // So we don't need specific assertions about how it's implemented
    });
  });

  describe('search_files tool', () => {
    it('should validate query parameter', async () => {
      // This should fail validation
      await expect(executeTool('search_files', {
        // Missing required property 'query'
      })).rejects.toThrow();

      // Skip implementation test - we just care about validation
      // Mocking the complete implementation is complex and not necessary for this test
    });
  });

  describe('list_files tool', () => {
    it('should accept optional maxResults parameter', async () => {
      // Skip implementation test - we just care about validation
      // Since list_files has no required parameters, we can simply check that
      // the maxResults parameter is optional and correctly typed
      const params = listFilesSchema.safeParse({});
      expect(params.success).toBe(true);
      
      const paramsWithMaxResults = listFilesSchema.safeParse({ maxResults: 50 });
      expect(paramsWithMaxResults.success).toBe(true);
      
      const invalidParams = listFilesSchema.safeParse({ maxResults: "not a number" });
      expect(invalidParams.success).toBe(false);
    });
  });
});