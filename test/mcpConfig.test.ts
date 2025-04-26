import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { writeMcpConfig, McpConfig } from '../src/mcp/config';

// Mock the file system calls
vi.mock('fs');
vi.mock('os');
vi.mock('path');

describe('MCP Configuration', () => {
  const mockHomedir = '/mock/home/dir';
  const mockConfigDir = '/mock/home/dir/.letta';
  const mockConfigPath = '/mock/home/dir/.letta/mcp_config.json';
  let writeFileSyncSpy: any;
  
  beforeEach(() => {
    // Reset all mocks
    vi.resetAllMocks();
    
    // Setup the mocks
    vi.mocked(os.homedir).mockReturnValue(mockHomedir);
    vi.mocked(path.join)
      .mockImplementation((...segments: string[]) => {
        if (segments[0] === mockHomedir && segments[1] === '.letta') {
          return mockConfigDir;
        }
        if (segments[0] === mockConfigDir && segments[1] === 'mcp_config.json') {
          return mockConfigPath;
        }
        return segments.join('/');
      });
    
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined as any);
    writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync');
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('creates the MCP config with the new mcpServers format', () => {
    const testPort = 7428;
    
    writeMcpConfig(testPort);
    
    // Ensure directory was created if it didn't exist
    expect(fs.existsSync).toHaveBeenCalledWith(mockConfigDir);
    expect(fs.mkdirSync).toHaveBeenCalledWith(mockConfigDir, { recursive: true });
    
    // Verify the config file was written with the expected content
    expect(writeFileSyncSpy).toHaveBeenCalledTimes(1);
    expect(writeFileSyncSpy).toHaveBeenCalledWith(
      mockConfigPath,
      expect.any(String)
    );
    
    // Parse the JSON that was written
    const writtenConfig = JSON.parse(
      writeFileSyncSpy.mock.calls[0][1] as string
    ) as McpConfig;
    
    // Verify the structure matches the new format
    expect(writtenConfig).toHaveProperty('mcpServers');
    expect(writtenConfig.mcpServers).toHaveProperty('vscode');
    expect(writtenConfig.mcpServers.vscode).toHaveProperty('url');
    
    // Verify the URL is correctly formed
    expect(writtenConfig.mcpServers.vscode.url).toBe(`http://host.docker.internal:${testPort}/mcp`);
  });
  
  it('uses the default port when none is provided', () => {
    writeMcpConfig();
    
    const writtenConfig = JSON.parse(
      writeFileSyncSpy.mock.calls[0][1] as string
    ) as McpConfig;
    
    // Default port should be used (7428)
    expect(writtenConfig.mcpServers.vscode.url).toBe('http://host.docker.internal:7428/mcp');
  });
});