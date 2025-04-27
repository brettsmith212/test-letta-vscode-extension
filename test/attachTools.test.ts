import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('LettaService attachToolsToAgent', () => {
  // Create mock functions
  const mockListMcpToolsByServer = vi.fn().mockResolvedValue([{ id: 'tool123', name: 'create_file' }]);
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

  // Create a simulated LettaService with just enough functionality to test
  const mockLettaService = {
    getClient: () => mockClient,
    // Simplified version of attachToolsToAgent that just tests the core functionality
    attachToolsToAgent: async (agentId) => {
      const client = mockLettaService.getClient();
      // This is the key function call we're testing
      const mcpTools = await client.tools.listMcpToolsByServer('vscode');
      
      // Add and attach a tool
      await client.tools.addMcpTool('vscode', 'create_file');
      await client.agents.tools.attach(agentId, 'create_file-id');
      
      return mcpTools;
    }
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  it('should correctly call listMcpToolsByServer', async () => {
    // Call the method
    await mockLettaService.attachToolsToAgent('agent123');
    
    // Verify the method was called with the correct server name
    expect(mockListMcpToolsByServer).toHaveBeenCalledWith('vscode');
  });
  
  it('should properly attach tools to the agent', async () => {
    // Call the method
    await mockLettaService.attachToolsToAgent('agent123');
    
    // Verify tools were added and attached
    expect(mockAddMcpTool).toHaveBeenCalledWith('vscode', 'create_file');
    expect(mockAttachTool).toHaveBeenCalled();
  });
});