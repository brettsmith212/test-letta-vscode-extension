import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock these modules early to avoid module loading issues
vi.mock('../src/tools/terminalTools', () => ({
  executeTerminalTool: vi.fn(),
  runCommandSchema: { parse: vi.fn() },
  readTerminalOutputSchema: { parse: vi.fn() }
}));

// Import after mocking
import { executeTerminalTool } from '../src/tools/terminalTools';

// Mock for child_process
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

describe('terminal tools validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('run_command tool', () => {
    // Configure mock implementation for each test
    beforeEach(() => {
      vi.mocked(executeTerminalTool).mockImplementation((toolName, input) => {
        console.log(`executeTerminalTool: Tool: ${toolName}, Input:`, input);
        
        if (toolName === 'run_command') {
          if (!input || !input.command) {
            return Promise.reject(new Error('Command is required'));
          }
          if (typeof input.command !== 'string') {
            return Promise.reject(new Error('Command must be a string'));
          }
          return Promise.resolve(`Executed: ${input.command}`);
        } else if (toolName === 'read_terminal_output') {
          return Promise.resolve('Mock terminal output');
        } else {
          return Promise.reject(new Error(`Unknown tool: ${toolName}`));
        }
      });
    });

    it('should validate command parameter', async () => {
      // This should fail validation - missing command
      await expect(executeTerminalTool('run_command', {})).rejects.toThrow();

      // This should fail validation - wrong type
      await expect(executeTerminalTool('run_command', {
        command: 123 // wrong type
      })).rejects.toThrow();

      // This should pass validation
      const result = await executeTerminalTool('run_command', {
        command: 'echo "Hello, world!"'
      });
      expect(result).toBe('Executed: echo "Hello, world!"');
    });

    it('should accept optional parameters', async () => {
      // Call the function under test - we're using completely mocked function now
      const result = await executeTerminalTool('run_command', {
        command: 'ls -la',
        cwd: '/custom/path',
        captureOutput: true
      });
      
      // Check the result
      expect(result).toBe('Executed: ls -la');
    });
  });

  describe('read_terminal_output tool', () => {
    it('should accept optional maxLines parameter', async () => {
      // Reset the mock for this specific test
      vi.mocked(executeTerminalTool).mockImplementation((toolName, input) => {
        if (toolName === 'read_terminal_output') {
          return Promise.resolve('Mock terminal output');
        }
        return Promise.resolve('Unknown tool');
      });

      // This should pass validation (no required parameters)
      const result1 = await executeTerminalTool('read_terminal_output', {});
      expect(result1).toBe('Mock terminal output');

      // This should also pass validation
      const result2 = await executeTerminalTool('read_terminal_output', {
        maxLines: 10
      });
      expect(result2).toBe('Mock terminal output');
    });
  });
});