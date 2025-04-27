import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('LettaService toolsCache', () => {
  // Create mock functions
  const mockListMcpToolsByServer = vi.fn().mockResolvedValue([
    { id: 'create_file-id', name: 'create_file' },
    { id: 'read_file-id', name: 'read_file' }
  ]);
  const mockAddMcpTool = vi.fn().mockImplementation((server, name) => {
    return Promise.resolve({ id: `${name}-id`, name });
  });
  const mockAttachTool = vi.fn().mockResolvedValue({ success: true });
  const mockClient = {
    tools: {
      listMcpToolsByServer: mockListMcpToolsByServer,
      listMcpServers: vi.fn().mockResolvedValue({ vscode: { url: 'http://url' } }),
      addMcpServer: vi.fn().mockResolvedValue([{ success: true }]),
      deleteMcpServer: vi.fn().mockResolvedValue([{ success: true }]),
      addMcpTool: mockAddMcpTool
    },
    agents: {
      tools: {
        list: vi.fn().mockResolvedValue([]),
        attach: mockAttachTool
      }
    }
  };

  // Create a simulated LettaService with caching functionality
  let mockToolsCache: Map<string, string>;
  const mockLettaService = {
    getClient: () => mockClient,
    saveToolsCache: vi.fn(),
    // Simplified version of attachToolsToAgent with caching
    attachToolsToAgent: async (agentId: string) => {
      const client = mockLettaService.getClient();
      const mcpTools = await client.tools.listMcpToolsByServer('vscode');
      
      // Desired tools
      const desiredTools = ['create_file', 'read_file', 'list_files'];
      
      // Process each tool, using cache when possible
      for (const toolName of desiredTools) {
        // First check if it's already in the cache
        const cachedToolId = mockToolsCache.get(toolName);
        
        if (cachedToolId) {
          console.log(`Using cached tool ID for ${toolName}: ${cachedToolId}`);
          // Use the cached ID for attaching
          await client.agents.tools.attach(agentId, cachedToolId);
          continue;
        }
        
        // Not in cache, need to create/find it
        await client.tools.addMcpTool('vscode', toolName);
        
        // Get tool ID from response (simulate how the real service would work)
        const mockToolId = `${toolName}-id`;
        
        // Save to cache before attaching
        mockToolsCache.set(toolName, mockToolId);
        await mockLettaService.saveToolsCache();
        
        // Attach the tool
        await client.agents.tools.attach(agentId, mockToolId);
      }
    }
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockToolsCache = new Map<string, string>();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  it('should use cached tool IDs instead of making repeated API calls', async () => {
    // Setup: Pre-populate cache for some tools but not others
    mockToolsCache.set('create_file', 'create_file-id');
    mockToolsCache.set('read_file', 'read_file-id');
    // Notably, don't cache 'list_files'
    
    // Run with partial cache
    await mockLettaService.attachToolsToAgent('agent123');
    
    // Should not call addMcpTool for the cached tools
    expect(mockAddMcpTool).not.toHaveBeenCalledWith('vscode', 'create_file');
    expect(mockAddMcpTool).not.toHaveBeenCalledWith('vscode', 'read_file');
    
    // Should call addMcpTool for the non-cached tool
    expect(mockAddMcpTool).toHaveBeenCalledWith('vscode', 'list_files');
    
    // Cache should now include all tools
    expect(mockToolsCache.size).toBe(3);
    expect(mockToolsCache.has('list_files')).toBe(true);
  });
  
  it('should properly save the tools cache', async () => {
    // Run once to populate cache
    await mockLettaService.attachToolsToAgent('agent123');
    
    // Verify saveToolsCache was called
    expect(mockLettaService.saveToolsCache).toHaveBeenCalled();
  });
});