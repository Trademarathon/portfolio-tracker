// Hook to expose WebSocket connection status
import { usePortfolioData } from './usePortfolioData';
import { WebSocketConnectionInfo } from '@/lib/api/websocket-types';

export function useWebSocketStatus(): Map<string, WebSocketConnectionInfo> {
    const { wsConnectionStatus } = usePortfolioData();
    return wsConnectionStatus || new Map();
}
