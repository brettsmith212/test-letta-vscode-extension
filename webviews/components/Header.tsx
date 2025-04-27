import React from 'react';
import { Button } from '../components/ui/button';
import { Pencil } from 'lucide-react';
import ConnectionStatus from './ConnectionStatus';

interface HeaderProps {
    onNewThread: () => void;
    connectionStatus: 'connected' | 'disconnected' | 'error' | 'unknown';
}

const Header: React.FC<HeaderProps> = ({ onNewThread, connectionStatus }) => (
    <div className="flex justify-between items-center p-2 border-b border-[var(--vscode-panel-border)]">
        <ConnectionStatus status={connectionStatus} />
        <Button 
            onClick={onNewThread} 
            variant="ghost" 
            size="icon"
            className="text-[var(--vscode-symbolIcon-functionForeground)] hover:text-[var(--vscode-symbolIcon-functionForeground)]/80 hover:bg-[var(--vscode-button-hoverBackground)]"
        >
            <Pencil className="h-4 w-4" />
        </Button>
    </div>
);

export default Header;