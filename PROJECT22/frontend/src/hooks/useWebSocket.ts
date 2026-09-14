import { useState, useEffect, useCallback, useRef } from 'react';
import { ExtremeAlert } from '../utils/types';

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

interface UseWebSocketOptions {
  url?: string;
  client_id?: string;
  autoConnect?: boolean;
  alert_types?: string[];
  severities?: string[];
  onAlert?: (alert: ExtremeAlert) => void;
  onMetrics?: (metrics: any) => void;
  onWeights?: (weights: any) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = `ws://localhost:8000/ws`,
    client_id,
    autoConnect = true,
    alert_types,
    severities,
    onAlert,
    onMetrics,
    onWeights,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [alerts, setAlerts] = useState<ExtremeAlert[]>([]);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const clientIdRef = useRef(client_id || `client_${Math.random().toString(36).substr(2, 9)}`);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${url}/${clientIdRef.current}`);

    ws.onopen = () => {
      setIsConnected(true);
      if (alert_types || severities) {
        ws.send(JSON.stringify({
          action: 'subscribe',
          alert_types: alert_types || [],
          severities: severities || [],
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        setLastMessage(message);
        switch (message.type) {
          case 'alert':
            setAlerts(prev => [message.data as ExtremeAlert, ...prev].slice(0, 50));
            onAlert?.(message.data);
            break;
          case 'metrics_update':
            onMetrics?.(message.data);
            break;
          case 'weight_update':
            onWeights?.(message.data);
            break;
          case 'pong':
          case 'subscription_confirmed':
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      reconnectTimeoutRef.current = window.setTimeout(() => { connect(); }, 5000);
    };

    ws.onerror = () => {};
    wsRef.current = ws;
  }, [url, alert_types, severities, onAlert, onMetrics, onWeights]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const subscribe = useCallback((types: string[], sevs: string[]) => {
    sendMessage({ action: 'subscribe', alert_types: types, severities: sevs });
  }, [sendMessage]);

  const ping = useCallback(() => { sendMessage({ action: 'ping' }); }, [sendMessage]);

  useEffect(() => {
    if (autoConnect) connect();
    return () => disconnect();
  }, [autoConnect, connect, disconnect]);

  return { isConnected, lastMessage, alerts, connect, disconnect, sendMessage, subscribe, ping };
}

export default useWebSocket;
