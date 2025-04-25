import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const MCP_PORT = 7428; // MCP server port that Docker container expects
const MCP_CONFIG_FILENAME = 'mcp_config.json';
const LETTA_CONFIG_DIR = '.letta';

/**
 * Ensures the Letta config directory exists
 */
function ensureLettaConfigDir(): string {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, LETTA_CONFIG_DIR);
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  return configDir;
}

/**
 * Creates or updates the MCP configuration file
 * This tells Letta where to find our tool server
 */
export function writeMcpConfig(port: number = MCP_PORT): void {
  try {
    const configDir = ensureLettaConfigDir();
    const configPath = path.join(configDir, MCP_CONFIG_FILENAME);
    
    // Since Docker is run with --add-host=host.docker.internal:host-gateway, use it directly
    // This is what the container expects since it's configured that way in start_docker.sh
    const hostIp = 'host.docker.internal';
    console.log(`Using host.docker.internal as configured in Docker run command`);  
    
    const config = {
      endpoint: `http://${hostIp}:${port}/mcp`
    };
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`MCP config written to ${configPath} with endpoint: ${config.endpoint}`);
  } catch (error) {
    console.error('Failed to write MCP config:', error);
  }
}

/**
 * Reads the current MCP configuration if it exists
 */
export function readMcpConfig(): { endpoint: string } | null {
  try {
    const configDir = path.join(os.homedir(), LETTA_CONFIG_DIR);
    const configPath = path.join(configDir, MCP_CONFIG_FILENAME);
    
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configContent);
    }
    
    return null;
  } catch (error) {
    console.error('Failed to read MCP config:', error);
    return null;
  }
}