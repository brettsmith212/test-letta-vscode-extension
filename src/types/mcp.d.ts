declare module '@modelcontextprotocol/sdk/esm/server/mcp' {
  export class McpServer {
    constructor(options: { sendEvent: (event: any) => void });
    receiveEvent(data: any): void;
    registerTool(options: {
      name: string;
      description: string;
      parameters: any;
      handler: (params: any) => Promise<any>;
    }): void;
  }
}