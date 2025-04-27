import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

/**
 * A panel that shows extension logs in a readonly editor
 */
export class LogPanel {
    private static readonly viewType = 'lettaLogs';
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private _logContent: string = '';
    private _outputChannel: vscode.OutputChannel;
    private _logWatcher: fs.FSWatcher | null = null;
    private static _instance: LogPanel | undefined;

    /**
     * Get the singleton instance of LogPanel
     */
    public static getInstance(extensionContext: vscode.ExtensionContext): LogPanel {
        if (!LogPanel._instance) {
            LogPanel._instance = new LogPanel(extensionContext);
        }
        return LogPanel._instance;
    }

    private constructor(private readonly _context: vscode.ExtensionContext) {
        // Create an output channel for logging
        this._outputChannel = vscode.window.createOutputChannel('Letta AI');
        
        // Create a webview panel for displaying logs
        this._panel = vscode.window.createWebviewPanel(
            LogPanel.viewType,
            'Letta AI Logs',
            vscode.ViewColumn.Two,
            {
                enableScripts: false,
                retainContextWhenHidden: true,
                enableFindWidget: true
            }
        );

        // Initialize the panel with logs
        this.updatePanel();
        
        // Register for memory logging
        this.captureConsoleOutput();

        // Update the webview when the panel is revealed
        this._panel.onDidChangeViewState(
            (e) => {
                if (this._panel.visible) {
                    this.updatePanel();
                }
            },
            null,
            this._disposables
        );

        // Clean up resources when the panel is closed
        this._panel.onDidDispose(
            () => {
                LogPanel._instance = undefined;
                this.dispose();
            },
            null,
            this._disposables
        );
    }

    /**
     * Capture console output and add it to our logs
     */
    private captureConsoleOutput(): void {
        // We can't directly intercept console.log, so we'll redirect to the output channel
        // and then display its contents
        
        // Create a timer to periodically update the panel with the latest logs
        const updateTimer = setInterval(() => {
            if (this._panel.visible) {
                this.updatePanel();
            }
        }, 1000); // Update every second
        
        this._disposables.push(new vscode.Disposable(() => clearInterval(updateTimer)));
    }

    /**
     * Update the panel with the latest logs from the output channel
     */
    private updatePanel(): void {
        // Format the logs with syntax highlighting
        const currentLogs = this.collectLogs();
        this._logContent = currentLogs;

        // Update the webview content
        this._panel.webview.html = this.getWebviewContent(this._logContent);
    }

    /**
     * Collect logs from various sources (console, temp files, etc.)
     */
    private collectLogs(): string {
        const logs: string[] = [];
        
        // Add timestamp
        logs.push(`Last updated: ${new Date().toLocaleString()}\n`);
        
        // Get logs from the extension host
        try {
            // Try to read VS Code logs
            const logPath = this.findVSCodeLogPath();
            if (logPath) {
                logs.push('--- VS Code Extension Host Logs ---\n');
                const vscodeLogs = this.readLogFile(logPath);
                logs.push(vscodeLogs);
            }
        } catch (error) {
            logs.push(`Error reading VS Code logs: ${error}\n`);
        }
        
        return logs.join('\n');
    }

    /**
     * Find the VS Code log path based on the OS
     */
    private findVSCodeLogPath(): string | null {
        try {
            const homedir = os.homedir();
            let logPath = '';
            
            // Path differs by OS
            if (process.platform === 'darwin') {
                // macOS
                logPath = path.join(homedir, 'Library', 'Application Support', 'Code', 'logs', 'extension-host.log');
            } else if (process.platform === 'win32') {
                // Windows
                logPath = path.join(homedir, 'AppData', 'Roaming', 'Code', 'logs', 'extension-host.log');
            } else {
                // Linux and others
                logPath = path.join(homedir, '.config', 'Code', 'logs', 'extension-host.log');
            }
            
            // Check if file exists
            if (fs.existsSync(logPath)) {
                return logPath;
            }
            
            // Try insiders version if regular doesn't exist
            if (process.platform === 'darwin') {
                logPath = path.join(homedir, 'Library', 'Application Support', 'Code - Insiders', 'logs', 'extension-host.log');
            } else if (process.platform === 'win32') {
                logPath = path.join(homedir, 'AppData', 'Roaming', 'Code - Insiders', 'logs', 'extension-host.log');
            } else {
                logPath = path.join(homedir, '.config', 'Code - Insiders', 'logs', 'extension-host.log');
            }
            
            if (fs.existsSync(logPath)) {
                return logPath;
            }
            
            return null;
        } catch (error) {
            console.error('Error finding VS Code log path:', error);
            return null;
        }
    }

    /**
     * Read a log file and return its contents
     */
    private readLogFile(filePath: string): string {
        try {
            // Read the last 1000 lines to avoid overwhelming the editor
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const lines = fileContent.split('\n');
            const lastLines = lines.slice(Math.max(lines.length - 1000, 0));
            
            // Filter to only include lines related to our extension
            const filteredLines = lastLines.filter(line => 
                line.includes('Letta') || 
                line.includes('letta-ai') ||
                line.includes('MCP') ||
                line.includes('Error')
            );
            
            return filteredLines.join('\n');
        } catch (error) {
            return `Error reading log file: ${error}`;
        }
    }

    /**
     * Generate the webview HTML content
     */
    private getWebviewContent(logContent: string): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Letta AI Logs</title>
            <style>
                body {
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    font-family: var(--vscode-editor-font-family);
                    font-size: var(--vscode-editor-font-size);
                    padding: 10px;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                .timestamp {
                    color: var(--vscode-editorInfo-foreground);
                    font-weight: bold;
                }
                .error {
                    color: var(--vscode-errorForeground);
                    font-weight: bold;
                }
                .warning {
                    color: var(--vscode-editorWarning-foreground);
                }
                .info {
                    color: var(--vscode-editorInfo-foreground);
                }
                .letta {
                    color: var(--vscode-textLink-foreground);
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <pre>${this.syntaxHighlight(logContent)}</pre>
        </body>
        </html>`;
    }

    /**
     * Apply syntax highlighting to the log content
     */
    private syntaxHighlight(text: string): string {
        // Escape HTML
        let escaped = text.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Colorize based on content
        escaped = escaped.replace(/\[(DEBUG|INFO|WARN|ERROR)\]/g, (match) => {
            if (match.includes('ERROR')) {
                return `<span class="error">${match}</span>`;
            } else if (match.includes('WARN')) {
                return `<span class="warning">${match}</span>`;
            } else if (match.includes('INFO')) {
                return `<span class="info">${match}</span>`;
            }
            return match;
        });

        // Highlight timestamps
        escaped = escaped.replace(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/g, 
            '<span class="timestamp">$1</span>');
        
        // Highlight Letta references
        escaped = escaped.replace(/(Letta|letta-ai)/g, 
            '<span class="letta">$1</span>');

        // Highlight errors
        escaped = escaped.replace(/(Error|ERROR|Exception|EXCEPTION|failed|Failed|FAILED)/g, 
            '<span class="error">$1</span>');

        return escaped;
    }

    /**
     * Reveal the log panel
     */
    public reveal(): void {
        this._panel.reveal();
        this.updatePanel(); // Update content when revealed
    }

    /**
     * Clean up resources
     */
    public dispose(): void {
        if (this._logWatcher) {
            this._logWatcher.close();
            this._logWatcher = null;
        }
        
        this._panel.dispose();
        
        // Dispose of all disposables
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}