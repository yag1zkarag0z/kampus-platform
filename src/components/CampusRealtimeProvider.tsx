"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useCampusAccount } from "@/components/CampusAccountProvider";
import {
  parseRealtimeServerEvent,
  REALTIME_PATH,
  type RealtimeClientMessage,
  type RealtimeServerEvent,
} from "@/realtime/protocol";

export type CampusRealtimeStatus =
  | "inactive"
  | "connecting"
  | "connected"
  | "disconnected";

type RealtimeListener = (event: RealtimeServerEvent) => void;

type CampusRealtimeContextValue = {
  status: CampusRealtimeStatus;
  subscribe: (listener: RealtimeListener) => () => void;
  subscribeToConversation: (
    conversationId: string,
    listener: RealtimeListener,
  ) => () => void;
  sendTyping: (conversationId: string, isTyping: boolean) => boolean;
};

const CampusRealtimeContext = createContext<
  CampusRealtimeContextValue | undefined
>(undefined);

const READY_TIMEOUT_MS = 8_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

export function getRealtimeReconnectDelayMs(attempt: number) {
  const base = Math.min(
    MAX_RECONNECT_DELAY_MS,
    1_000 * 2 ** Math.max(0, attempt),
  );
  return base + Math.floor(Math.random() * Math.min(1_000, base * 0.25));
}

function realtimeUrl() {
  const url = new URL(REALTIME_PATH, window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export function CampusRealtimeProvider({ children }: { children: ReactNode }) {
  const { sessionMode } = useCampusAccount();
  const [status, setStatus] = useState<CampusRealtimeStatus>("inactive");
  const socketRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef(new Set<RealtimeListener>());
  const conversationListenersRef = useRef(
    new Map<string, Set<RealtimeListener>>(),
  );

  const send = useCallback((message: RealtimeClientMessage) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  }, []);

  const subscribe = useCallback((listener: RealtimeListener) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  const subscribeToConversation = useCallback(
    (conversationId: string, listener: RealtimeListener) => {
      const current =
        conversationListenersRef.current.get(conversationId) ??
        new Set<RealtimeListener>();
      const isFirstListener = current.size === 0;
      current.add(listener);
      conversationListenersRef.current.set(conversationId, current);
      if (isFirstListener) {
        send({ type: "conversation.subscribe", conversationId });
      }

      return () => {
        const listeners = conversationListenersRef.current.get(conversationId);
        listeners?.delete(listener);
        if (listeners?.size === 0) {
          conversationListenersRef.current.delete(conversationId);
          send({ type: "conversation.unsubscribe", conversationId });
        }
      };
    },
    [send],
  );

  const sendTyping = useCallback(
    (conversationId: string, isTyping: boolean) =>
      send({ type: "typing", conversationId, isTyping }),
    [send],
  );

  useEffect(() => {
    if (sessionMode !== "member") {
      socketRef.current?.close(1000, "Session inactive");
      socketRef.current = null;
      queueMicrotask(() => setStatus("inactive"));
      return;
    }

    let disposed = false;
    let reconnectAttempt = 0;
    let reconnectTimer: number | null = null;
    let readyTimer: number | null = null;

    const clearReadyTimer = () => {
      if (readyTimer !== null) window.clearTimeout(readyTimer);
      readyTimer = null;
    };

    const dispatch = (event: RealtimeServerEvent) => {
      for (const listener of listenersRef.current) listener(event);
      if ("conversationId" in event) {
        for (
          const listener of
            conversationListenersRef.current.get(event.conversationId) ?? []
        ) {
          listener(event);
        }
      }
    };

    const scheduleReconnect = () => {
      if (disposed || reconnectTimer !== null || !navigator.onLine) return;
      const delay = getRealtimeReconnectDelayMs(reconnectAttempt);
      reconnectAttempt += 1;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    const connect = () => {
      if (
        disposed ||
        !navigator.onLine ||
        socketRef.current?.readyState === WebSocket.CONNECTING ||
        socketRef.current?.readyState === WebSocket.OPEN
      ) {
        return;
      }

      setStatus("connecting");
      const socket = new WebSocket(realtimeUrl());
      socketRef.current = socket;
      readyTimer = window.setTimeout(() => {
        if (socketRef.current === socket) socket.close(4000, "Ready timeout");
      }, READY_TIMEOUT_MS);

      socket.addEventListener("message", (message) => {
        if (typeof message.data !== "string") return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(message.data) as unknown;
        } catch {
          return;
        }
        const event = parseRealtimeServerEvent(parsed);
        if (!event) return;

        if (event.type === "ready") {
          clearReadyTimer();
          reconnectAttempt = 0;
          setStatus("connected");
          for (const conversationId of conversationListenersRef.current.keys()) {
            send({ type: "conversation.subscribe", conversationId });
          }
        }
        dispatch(event);
      });

      socket.addEventListener("close", () => {
        clearReadyTimer();
        if (socketRef.current === socket) socketRef.current = null;
        if (!disposed) {
          setStatus("disconnected");
          scheduleReconnect();
        }
      });

      socket.addEventListener("error", () => {
        socket.close();
      });
    };

    const handleOnline = () => {
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
      connect();
    };
    const handleOffline = () => {
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
      socketRef.current?.close(4001, "Offline");
      setStatus("disconnected");
    };

    connect();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      disposed = true;
      clearReadyTimer();
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      const socket = socketRef.current;
      socketRef.current = null;
      socket?.close(1000, "Provider disposed");
    };
  }, [send, sessionMode]);

  const value = useMemo<CampusRealtimeContextValue>(
    () => ({
      status,
      subscribe,
      subscribeToConversation,
      sendTyping,
    }),
    [sendTyping, status, subscribe, subscribeToConversation],
  );

  return (
    <CampusRealtimeContext.Provider value={value}>
      {children}
    </CampusRealtimeContext.Provider>
  );
}

export function useCampusRealtime() {
  const context = useContext(CampusRealtimeContext);
  if (!context) {
    throw new Error(
      "useCampusRealtime must be used within CampusRealtimeProvider.",
    );
  }
  return context;
}
