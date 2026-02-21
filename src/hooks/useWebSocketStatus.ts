import { usePortfolio } from '@/contexts/PortfolioContext';
import { WebSocketConnectionInfo } from '@/lib/api/websocket-types';

export function useWebSocketStatus(): Map<string, WebSocketConnectionInfo> {
    const { wsConnectionStatus } = usePortfolio();
    return wsConnectionStatus || new Map();
}
