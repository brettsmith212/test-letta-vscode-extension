import React from 'react';

interface ConnectionStatusProps {
    status: 'connected' | 'disconnected' | 'error' | 'unknown';
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ status }) => {
    // Map status to colors and tooltips
    const statusConfig = {
        connected: {
            color: '#4CAF50', // Green
            tooltip: 'Connected to Letta server'
        },
        disconnected: {
            color: '#FF9800', // Orange
            tooltip: 'Disconnected from Letta server'
        },
        error: {
            color: '#F44336', // Red
            tooltip: 'Error connecting to Letta server'
        },
        unknown: {
            color: '#9E9E9E', // Gray
            tooltip: 'Connection status unknown'
        }
    };

    const config = statusConfig[status];

    return (
        <div 
            className="flex items-center space-x-1 px-2" 
            title={config.tooltip}
        >
            <div 
                className="w-2 h-2 rounded-full transition-colors duration-300"
                style={{ backgroundColor: config.color }}
            />
            <span className="text-xs text-muted-foreground">
                {status === 'connected' ? 'Connected' : status === 'disconnected' ? 'Disconnected' : status === 'error' ? 'Error' : 'Unknown'}
            </span>
        </div>
    );
};

export default ConnectionStatus;