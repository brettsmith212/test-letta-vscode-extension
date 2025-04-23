declare module 'dockerode' {
  export interface ContainerInfo {
    Id: string;
    Names: string[];
    Image: string;
    ImageID: string;
    Command: string;
    Created: number;
    Ports: Port[];
    Labels: { [label: string]: string };
    State: string;
    Status: string;
    HostConfig: { NetworkMode: string };
    NetworkSettings: { Networks: { [networkType: string]: NetworkInfo } };
    Mounts: Mount[];
  }

  export interface Port {
    IP?: string;
    PrivatePort: number;
    PublicPort?: number;
    Type: string;
  }

  export interface NetworkInfo {
    IPAMConfig?: any;
    Links?: any;
    Aliases?: any;
    NetworkID: string;
    EndpointID: string;
    Gateway: string;
    IPAddress: string;
    IPPrefixLen: number;
    IPv6Gateway: string;
    GlobalIPv6Address: string;
    GlobalIPv6PrefixLen: number;
    MacAddress: string;
  }

  export interface Mount {
    Name?: string;
    Source: string;
    Destination: string;
    Driver?: string;
    Mode: string;
    RW: boolean;
    Propagation: string;
  }

  export interface Container {
    id: string;
    start(): Promise<any>;
  }

  export default class Docker {
    constructor(options?: any);
    ping(): Promise<any>;
    listContainers(options?: any): Promise<ContainerInfo[]>;
    pull(image: string, callback: (err: any, stream: any) => void): void;
    modem: { followProgress(stream: any, onFinished: (err: any) => void): void };
    createContainer(options: any): Promise<Container>;
  }
}