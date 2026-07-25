import { useCallback, useEffect, useRef, useState } from 'react';
import { createReconnectingWebSocket, resolveWsUrl } from '@/api/ws';

export type SignalPayload = Record<string, unknown> & { type: string };

type Options = {
  enabled?: boolean;
  onSignal: (payload: SignalPayload) => void;
};

export function useSignalWebSocket({ enabled = true, onSignal }: Options) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<ReturnType<typeof createReconnectingWebSocket> | null>(null);
  const onSignalRef = useRef(onSignal);

  useEffect(() => {
    onSignalRef.current = onSignal;
  }, [onSignal]);

  useEffect(() => {
    if (!enabled) return;
    const socket = createReconnectingWebSocket({
      url: () => resolveWsUrl('signal'),
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onMessage: (data) => onSignalRef.current(data as SignalPayload),
    });
    wsRef.current = socket;

    const ping = setInterval(() => {
      socket.send({ type: 'presence.ping' });
    }, 30000);

    return () => {
      clearInterval(ping);
      wsRef.current = null;
      socket.close();
      setConnected(false);
    };
  }, [enabled]);

  const sendSignal = useCallback((payload: SignalPayload) => {
    return wsRef.current?.send(payload) ?? false;
  }, []);

  const joinRoom = useCallback(
    (roomId: number) => sendSignal({ type: 'room.join', room_id: roomId }),
    [sendSignal],
  );

  const leaveRoom = useCallback(
    (roomId: number) => sendSignal({ type: 'room.leave', room_id: roomId }),
    [sendSignal],
  );

  return { connected, sendSignal, joinRoom, leaveRoom };
}
