import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import * as path from 'path';
import { executeTool } from '../src/tools/fileTools';

// Mock vscode workspace and window
vi.mock('vscode', () => {
  return {
    workspace: {
      workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
      fs: {
        writeFile: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockResolvedValue(new Uint8Array([116, 101, 115, 116])), // 'test' in bytes
        delete: vi.fn().mockResolvedValue(undefined),
        stat: vi.fn().mockResolvedValue({ type: 1 }) // FileType.File
      },
      getConfiguration: vi.fn().mockImplementation(() => ({
        get: vi.fn().mockReturnValue({})
      })),
      findFiles: vi.fn().mockImplementation(() => Promise.resolve([{ fsPath: '/test/workspace/test.txt' }]))
    },
    window: {
      showWarningMessage: vi.fn().mockResolvedValue('Yes')
    },
    Uri: { file: (p: string) => ({ fsPath: p }) }
  };
});

// Mock fs/promises
vi.mock('fs/promises', async () => {
  return {
    access: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('file content'),
    readdir: vi.fn().mockResolvedValue([]),
    constants: { R_OK: 4 },
    stat: vi.fn().mockResolvedValue({ isFile: () => true })
  };
});

describe('File operation confirmations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('delete_file confirmation', () => {
    it('should show confirmation dialog before deleting a file', async () => {
      // Setup mocks
      const showWarningMock = vi.spyOn(vscode.window, 'showWarningMessage');
      const deleteFileMock = vi.spyOn(vscode.workspace.fs, 'delete');
      
      // User confirms deletion
      showWarningMock.mockResolvedValueOnce('Yes');
      
      // Execute delete_file tool
      await executeTool('delete_file', { path: 'test.txt' });
      
      // Verify confirmation was shown
      expect(showWarningMock).toHaveBeenCalled();
      expect(showWarningMock.mock.calls[0][0]).toContain('test.txt');
      
      // Verify file was deleted after confirmation
      expect(deleteFileMock).toHaveBeenCalled();
    });

    it('should cancel deletion when user declines', async () => {
      // Setup mocks
      const showWarningMock = vi.spyOn(vscode.window, 'showWarningMessage');
      const deleteFileMock = vi.spyOn(vscode.workspace.fs, 'delete');
      
      // User cancels deletion
      showWarningMock.mockResolvedValueOnce('Cancel');
      
      // Execute delete_file tool
      const result = await executeTool('delete_file', { path: 'test.txt' });
      
      // Verify confirmation was shown
      expect(showWarningMock).toHaveBeenCalled();
      
      // Verify file was NOT deleted
      expect(deleteFileMock).not.toHaveBeenCalled();
      
      // Verify cancelation message
      expect(result).toContain('cancelled');
    });
  });

  describe('create_file overwrite confirmation', () => {
    it('should show confirmation dialog when file exists', async () => {
      // Setup mocks
      const showWarningMock = vi.spyOn(vscode.window, 'showWarningMessage');
      const writeFileMock = vi.spyOn(vscode.workspace.fs, 'writeFile');
      
      // Mock file exists check
      const statMock = vi.spyOn(vscode.workspace.fs, 'stat');
      statMock.mockResolvedValueOnce({ type: 1 }); // FileType.File
      
      // User confirms overwrite
      showWarningMock.mockResolvedValueOnce('Yes');
      
      // Execute create_file tool
      await executeTool('create_file', { 
        path: 'existing.txt', 
        content: 'new content' 
      });
      
      // Verify confirmation was shown
      expect(showWarningMock).toHaveBeenCalled();
      expect(showWarningMock.mock.calls[0][0]).toContain('existing.txt');
      
      // Verify file was overwritten after confirmation
      expect(writeFileMock).toHaveBeenCalled();
    });

    it('should cancel overwrite when user declines', async () => {
      // Setup mocks
      const showWarningMock = vi.spyOn(vscode.window, 'showWarningMessage');
      const writeFileMock = vi.spyOn(vscode.workspace.fs, 'writeFile');
      
      // Mock file exists check
      const statMock = vi.spyOn(vscode.workspace.fs, 'stat');
      statMock.mockResolvedValueOnce({ type: 1 }); // FileType.File
      
      // User cancels overwrite
      showWarningMock.mockResolvedValueOnce('Cancel');
      
      // Execute create_file tool
      const result = await executeTool('create_file', { 
        path: 'existing.txt', 
        content: 'new content' 
      });
      
      // Verify confirmation was shown
      expect(showWarningMock).toHaveBeenCalled();
      
      // Verify file was NOT overwritten
      expect(writeFileMock).not.toHaveBeenCalled();
      
      // Verify cancelation message
      expect(result).toContain('cancelled');
    });
  });
});