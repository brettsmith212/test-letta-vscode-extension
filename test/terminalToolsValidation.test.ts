import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeTerminalTool, runCommandSchema, readTerminalOutputSchema } from '../src/tools/terminalTools';
import * as vscode from 'vscode';
import * as child_process from 'child_process';

// Mock vscode
vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }]
  },
  window: {
    createTerminal: vi.fn().mockReturnValue({
      show: vi.fn(),
      sendText: vi.fn(),
      exitStatus: undefined
    })
  }
}));

// Mock child_process
vi.mock('child_process', () => {
  return {
    exec: vi.fn().mockImplementation((cmd, options, callback) => {
      // Immediately call the callback with success
      if (callback) callback(null, 'command output', '');
      // Return an empty object to simulate the child process
      return {};
    })
  };
});

describe('terminal tools validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  describe('run_command tool', () => {
    it('should validate command parameter', async () => {
      // This should fail validation - missing command
      await expect(executeTerminalTool('run_command', {
        // Missing required property 'command'
      })).rejects.toThrow();

      // This should fail validation - wrong type
      await expect(executeTerminalTool('run_command', {
        command: 123 // wrong type
      })).rejects.toThrow();

      // This should pass validation
      await executeTerminalTool('run_command', {
        command: 'echo "Hello, world!"'
      });
      expect(vscode.window.createTerminal).toHaveBeenCalled();
    });

    it('should accept optional parameters', async () => {
      // Mock the child_process.exec implementation directly for this test
      vi.spyOn(child_process, 'exec').mockImplementation((cmd, options, callback) => {
        callback(null, 'mocked output', '');
        return {} as any;
      });
      
      // Call the function under test
      const result = await executeTerminalTool('run_command', {
        command: 'ls -la',
        cwd: '/custom/path',
        captureOutput: true
      });
      
      // Verify the mocks were called correctly
      expect(child_process.exec).toHaveBeenCalledWith(
        'ls -la',
        { cwd: '/custom/path' },
        expect.any(Function)
      );
    }, 2000);
  });

  describe('read_terminal_output tool', () => {
    it('should accept optional maxLines parameter', async () => {
      // This should pass validation (no required parameters)
      await executeTerminalTool('read_terminal_output', {});

      // This should also pass validation
      await executeTerminalTool('read_terminal_output', {
        maxLines: 10
      });
    });
  });
});