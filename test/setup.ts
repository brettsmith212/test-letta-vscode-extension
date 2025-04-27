// This minimal setup allows tests to run
// Reset all mocks before each test
import { vi, beforeEach } from 'vitest';

// Mock the path module for tests
vi.mock('path', async () => {
  const actualPath = await vi.importActual('path');
  return {
    ...actualPath,
    isAbsolute: (path: string | null | undefined) => {
      if (path === undefined || path === null || path === '') {
        return false;
      }
      return typeof path === 'string' && path.startsWith('/');
    }
  };
});

// Mock vscode to handle missing terminal methods
vi.mock('vscode', () => {
  const mockUris = [{ fsPath: '/test/workspace/test.txt' }];
  
  return {
    workspace: {
      workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
      fs: {
        writeFile: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockResolvedValue(new Uint8Array()),
        delete: vi.fn().mockResolvedValue(undefined),
        stat: vi.fn().mockResolvedValue({ type: 1 }) // FileType.File
      },
      getConfiguration: vi.fn().mockImplementation(() => ({
        get: vi.fn().mockReturnValue({})
      })),
      findFiles: vi.fn().mockImplementation(() => Promise.resolve(mockUris))
    },
    window: {
      showWarningMessage: vi.fn().mockResolvedValue('Yes'),
      showInformationMessage: vi.fn(),
      createTerminal: vi.fn().mockReturnValue({
        show: vi.fn(),
        sendText: vi.fn(),
        exitStatus: undefined
      })
    },
    Uri: { file: (path: string) => ({ fsPath: path }) }
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});