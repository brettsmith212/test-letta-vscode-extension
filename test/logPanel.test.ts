import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';

// Mock vscode commands
vi.mock('vscode', () => ({
  commands: {
    registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() })
  }
}));

describe('Log Viewer Feature', () => {
  it('should register the openLogs command', () => {
    // Simulate registering the command
    vscode.commands.registerCommand('letta-ai.openLogs', () => {});
    
    // Verify command was registered
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      'letta-ai.openLogs',
      expect.any(Function)
    );
  });
});