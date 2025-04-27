import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';
import * as net from 'net';

// Mock the VS Code module
vi.mock('vscode', () => ({
  window: {
    showErrorMessage: vi.fn().mockResolvedValue(null),
    showInformationMessage: vi.fn().mockResolvedValue(null),
  },
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn(),
      update: vi.fn(),
    }),
  },
  commands: {
    executeCommand: vi.fn(),
  },
  ConfigurationTarget: {
    Global: 1
  }
}));

// We'll skip the mocking for now and focus on functional testing
describe('MCP Server Port Handling', () => {
  it('should update settings when a new port is selected', async () => {
    // Mock the VS Code configuration
    const mockGet = vi.fn().mockReturnValue(7428);
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: mockGet,
      update: mockUpdate,
    } as any);
    
    // Import the settings module after mocking
    const { updateMcpPortSetting } = await import('../src/mcp/settings');
    
    // Call the function
    await updateMcpPortSetting(7430);
    
    // Verify the settings were updated
    expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('lettaChat');
    expect(mockUpdate).toHaveBeenCalledWith('mcpPort', 7430, expect.anything());
  });
});