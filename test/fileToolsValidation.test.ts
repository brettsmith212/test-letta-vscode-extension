import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeTool, createFileSchema, updateFileSchema, deleteFileSchema, readFileSchema, searchFilesSchema, listFilesSchema } from '../src/tools/fileTools';
import * as vscode from 'vscode';

// We're not mocking vscode here as it's already mocked in setup.ts
// Just use the vscode object that's already mocked

// Mock fs/promises for native filesystem operations
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

      // Mock window.showWarningMessage to return 'Yes' for the confirmation
      vi.spyOn(vscode.window, 'showWarningMessage').mockResolvedValueOnce('Yes');
      
      // Mock the VS Code fs.stat to return a non-existing file type
      vi.spyOn(vscode.workspace.fs, 'stat').mockRejectedValueOnce(new Error('File not found'));
      
      // Mock the fs.writeFile function
      const mockWrite = vi.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValueOnce(undefined);
      
      // This should pass validation and call writeFile
      await executeTool('create_file', {
        path: 'test.txt',
        content: 'test content'
      });
      
      // Verify writeFile was called
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

      // Mock the file existence check
      const mockStat = vi.spyOn(vscode.workspace.fs, 'stat');
      mockStat.mockResolvedValueOnce({ type: 1 }); // File exists
      
      // Mock confirmation
      const mockWarning = vi.spyOn(vscode.window, 'showWarningMessage');
      mockWarning.mockResolvedValueOnce('Yes');

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

      // Mock confirmation
      const mockWarning = vi.spyOn(vscode.window, 'showWarningMessage');
      mockWarning.mockResolvedValueOnce('Yes');

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