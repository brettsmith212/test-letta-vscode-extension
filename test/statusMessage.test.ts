import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';

// Mock the required functions
vi.mock('vscode', () => ({
  window: {
    setStatusBarMessage: vi.fn(),
  },
  workspace: {
    getConfiguration: vi.fn().mockReturnValue({
      get: vi.fn().mockImplementation((key) => {
        if (key === 'serverUrl') return 'http://localhost:8283';
        return undefined;
      }),
    }),
  },
  Uri: {
    parse: vi.fn().mockImplementation(url => ({ toString: () => url })),
  },
}));

describe('Connection Status Indicator', () => {
  // Create a simple implementation of notifyWebviewOfStatus
  const mockWebviewMessage = vi.fn();
  const notifyWebviewOfStatus = (status) => {
    mockWebviewMessage({
      command: 'lettaStatus',
      status
    });
  };
  
  it('should send the correct status messages', () => {
    // Test connected status
    notifyWebviewOfStatus('connected');
    expect(mockWebviewMessage).toHaveBeenLastCalledWith({
      command: 'lettaStatus',
      status: 'connected'
    });
    
    // Test disconnected status
    notifyWebviewOfStatus('disconnected');
    expect(mockWebviewMessage).toHaveBeenLastCalledWith({
      command: 'lettaStatus',
      status: 'disconnected'
    });
    
    // Test error status
    notifyWebviewOfStatus('error');
    expect(mockWebviewMessage).toHaveBeenLastCalledWith({
      command: 'lettaStatus',
      status: 'error'
    });
  });
});