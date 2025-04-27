import * as vscode from 'vscode';
import * as path from 'path';

export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  // Get the local paths to the script and CSS files
  // Use the correct path relative to the extension
  const scriptPath = vscode.Uri.file(
    path.join(extensionUri.fsPath, 'media', 'build', 'assets', 'index.js')
  );
  const stylePath = vscode.Uri.file(
    path.join(extensionUri.fsPath, 'media', 'build', 'assets', 'index.css')
  );
  
  // Convert to webview URIs
  const scriptUri = webview.asWebviewUri(scriptPath);
  const styleUri = webview.asWebviewUri(stylePath);

  return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="
          default-src 'none'; 
          style-src ${webview.cspSource} 'unsafe-inline'; 
          script-src ${webview.cspSource}; 
          img-src ${webview.cspSource} https:; 
          font-src ${webview.cspSource};
          connect-src https: wss:;
        ">
        <title>Letta Chat</title>
        <link rel="stylesheet" type="text/css" href="${styleUri}">
    </head>
    <body>
        <div id="root"></div>
        <div id="letta-status" style="display: none;"></div>
        <script src="${scriptUri}"></script>
    </body>
    </html>`;
}