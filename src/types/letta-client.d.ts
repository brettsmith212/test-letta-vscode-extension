declare module '@letta-ai/letta-client' {
  export interface ClientOptions {
    baseUrl: string;
  }

  export interface CreateBlock {
    type: string;
    content: string;
    metadata?: {
      name?: string;
      description?: string;
      type?: string;
      [key: string]: any;
    };
  }

  export interface Block {
    id?: string;
    type: string;
    content: string;
    metadata?: Record<string, any>;
    createdAt?: string;
    updatedAt?: string;
  }

  export class BlocksAPI {
    create(options: CreateBlock): Promise<Block>;
    get(id: string): Promise<Block>;
    delete(id: string): Promise<void>;
    update(id: string, options: Partial<CreateBlock>): Promise<Block>;
    list(): Promise<Block[]>;
  }

  export class LettaClient {
    constructor(options: ClientOptions);
    blocks: BlocksAPI;
  }
}