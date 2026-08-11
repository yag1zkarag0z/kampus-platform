import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Duplex } from "node:stream";

import next from "next";
import { Client, Pool } from "pg";
import {
  WebSocket,
  WebSocketServer,
  type RawData,
} from "ws";

import {
  parseRealtimeBrokerEvent,
  parseRealtimeClientMessage,
  REALTIME_PATH,
  REALTIME_POSTGRES_CHANNEL,
  REALTIME_PROTOCOL_VERSION,
  type RealtimeBrokerEvent,
  type RealtimeServerEvent,
} from "../src/realtime/protocol";
import {
  errorLogFields,
  logEvent,
} from "../src/server/observability/logger";

const SESSION_COOKIE_NAME = "kampus_session";
const HEARTBEAT_INTERVAL_MS = 30_000;
const LISTENER_RECONNECT_MS = 1_000;
const MAX_CONNECTIONS_PER_USER = 5;
const MAX_SUBSCRIPTIONS_PER_SOCKET = 10;
const TYPING_EVENT_MIN_INTERVAL_MS = 350;

type ControlledShutdown = {
  path: string;
  token: string;
  exitProcess?: boolean;
};

type CampusServerOptions = {
  dev: boolean;
  hostname: string;
  port: number;
  origin: string;
  databaseUrl: string;
  controlledShutdown?: ControlledShutdown;
};

type SocketState = {
  userId: string;
  isAlive: boolean;
  subscriptions: Map<string, string>;
  activeTyping: Set<string>;
  lastTypingEventAt: number;
};

function parseCookies(header: string | undefined) {
  const cookies = new Map<string, string>();

  for (const part of header?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    const rawValue = part.slice(separator + 1).trim();

    try {
      cookies.set(name, decodeURIComponent(rawValue));
    } catch {
      cookies.set(name, rawValue);
    }
  }

  return cookies;
}

function rejectUpgrade(socket: Duplex, status: number, message: string) {
  if (socket.destroyed) return;
  const body = `${message}\n`;
  socket.write(
    `HTTP/1.1 ${status} ${message}\r\n` +
      "Connection: close\r\n" +
      "Content-Type: text/plain; charset=utf-8\r\n" +
      `Content-Length: ${Buffer.byteLength(body)}\r\n` +
      "\r\n" +
      body,
  );
  socket.destroy();
}

function sendEvent(socket: WebSocket, event: RealtimeServerEvent) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(event));
  }
}

function eventForClient(event: RealtimeBrokerEvent): RealtimeServerEvent {
  if (event.type === "typing") {
    return {
      type: "typing",
      conversationId: event.conversationId,
      userId: event.userId,
      isTyping: event.isTyping,
    };
  }

  return {
    type: "conversation.invalidate",
    conversationId: event.conversationId,
    reason: event.reason,
  };
}

function realtimePathname(request: IncomingMessage, origin: string) {
  try {
    return new URL(request.url ?? "/", origin).pathname;
  } catch {
    return "";
  }
}

function attachRealtimeServer(
  serverPool: Pool,
  origin: string,
) {
  const sockets = new Map<WebSocket, SocketState>();
  const socketsByUser = new Map<string, Set<WebSocket>>();
  const websocketServer = new WebSocketServer({
    noServer: true,
    clientTracking: false,
    maxPayload: 1_024,
    perMessageDeflate: false,
  });
  let listenerClient: Client | null = null;
  let listenerReconnectTimer: NodeJS.Timeout | null = null;
  let isClosing = false;

  const publishBrokerEvent = async (event: RealtimeBrokerEvent) => {
    await serverPool.query("select pg_notify($1, $2)", [
      REALTIME_POSTGRES_CHANNEL,
      JSON.stringify(event),
    ]);
  };

  const broadcastBrokerEvent = (event: RealtimeBrokerEvent) => {
    const clientEvent = eventForClient(event);

    for (const userId of event.userIds) {
      for (const socket of socketsByUser.get(userId) ?? []) {
        const state = sockets.get(socket);
        if (!state) continue;

        sendEvent(socket, clientEvent);
      }
    }
  };

  const scheduleListenerReconnect = () => {
    if (isClosing || listenerReconnectTimer) return;
    listenerReconnectTimer = setTimeout(() => {
      listenerReconnectTimer = null;
      void connectListener();
    }, LISTENER_RECONNECT_MS);
  };

  const connectListener = async () => {
    if (isClosing || listenerClient) return;
    const candidate = new Client({
      connectionString: serverPool.options.connectionString,
      application_name: "kampus-realtime-listener",
    });
    let disconnected = false;
    const handleDisconnect = (error?: Error) => {
      if (disconnected) return;
      disconnected = true;
      if (listenerClient === candidate) listenerClient = null;
      if (error) {
        logEvent("error", "realtime.listener_disconnected", {
          ...errorLogFields(error),
        });
      }
      scheduleListenerReconnect();
    };

    candidate.once("error", handleDisconnect);
    candidate.once("end", () => handleDisconnect());
    candidate.on("notification", (notification) => {
      if (
        notification.channel !== REALTIME_POSTGRES_CHANNEL ||
        !notification.payload
      ) {
        return;
      }

      try {
        const event = parseRealtimeBrokerEvent(
          JSON.parse(notification.payload) as unknown,
        );
        if (event) {
          broadcastBrokerEvent(event);
        } else {
          logEvent("warn", "realtime.invalid_broker_event");
        }
      } catch {
        logEvent("warn", "realtime.invalid_broker_event");
      }
    });

    try {
      await candidate.connect();
      await candidate.query(`listen ${REALTIME_POSTGRES_CHANNEL}`);
      if (isClosing) {
        await candidate.end();
        return;
      }
      listenerClient = candidate;
      logEvent("info", "realtime.listener_connected");
    } catch (error) {
      handleDisconnect(error instanceof Error ? error : new Error(String(error)));
      await candidate.end().catch(() => undefined);
    }
  };

  const authenticate = async (request: IncomingMessage) => {
    const cookieValue = parseCookies(request.headers.cookie).get(
      SESSION_COOKIE_NAME,
    );
    if (!cookieValue?.startsWith("m1.")) return null;
    const rawToken = cookieValue.slice(3);
    if (!rawToken) return null;
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const result = await serverPool.query<{ user_id: string }>(
      `select sessions.user_id
       from sessions
       inner join users on users.id = sessions.user_id
       where sessions.token_hash = $1
         and sessions.revoked_at is null
         and sessions.expires_at > now()
         and users.status = 'active'
         and users.deleted_at is null
         and users.role = sessions.issued_role
       limit 1`,
      [tokenHash],
    );

    return result.rows[0]?.user_id ?? null;
  };

  const resolveTypingPeer = async (
    userId: string,
    conversationId: string,
  ) => {
    const result = await serverPool.query<{ other_user_id: string }>(
      `select case
         when direct_conversations.participant_low_id = $1
           then direct_conversations.participant_high_id
         else direct_conversations.participant_low_id
       end as other_user_id
       from direct_conversations
       inner join users as peer on peer.id = case
         when direct_conversations.participant_low_id = $1
           then direct_conversations.participant_high_id
         else direct_conversations.participant_low_id
       end
       where direct_conversations.id = $2
         and $1 in (
           direct_conversations.participant_low_id,
           direct_conversations.participant_high_id
         )
         and direct_conversations.request_status = 'accepted'
         and peer.status = 'active'
         and peer.deleted_at is null
         and not exists (
           select 1
           from blocks
           where (
             blocks.blocker_id = $1
             and blocks.blocked_id = peer.id
           ) or (
             blocks.blocker_id = peer.id
             and blocks.blocked_id = $1
           )
         )
       limit 1`,
      [userId, conversationId],
    );

    return result.rows[0]?.other_user_id ?? null;
  };

  const publishTyping = async (
    state: SocketState,
    conversationId: string,
    isTyping: boolean,
  ) => {
    const otherUserId = state.subscriptions.get(conversationId);
    if (!otherUserId) return;

    if (isTyping) state.activeTyping.add(conversationId);
    else state.activeTyping.delete(conversationId);

    try {
      await publishBrokerEvent({
        version: REALTIME_PROTOCOL_VERSION,
        type: "typing",
        conversationId,
        userId: state.userId,
        isTyping,
        userIds: [otherUserId],
      });
    } catch (error) {
      logEvent("error", "realtime.typing_publish_failed", {
        ...errorLogFields(error),
      });
    }
  };

  const stopSocketTyping = (state: SocketState) => {
    for (const conversationId of state.activeTyping) {
      void publishTyping(state, conversationId, false);
    }
  };

  websocketServer.on(
    "connection",
    (socket: WebSocket, _request: IncomingMessage, userId: string) => {
    const state: SocketState = {
      userId,
      isAlive: true,
      subscriptions: new Map(),
      activeTyping: new Set(),
      lastTypingEventAt: 0,
    };
    sockets.set(socket, state);
    const userSockets = socketsByUser.get(userId) ?? new Set<WebSocket>();
    userSockets.add(socket);
    socketsByUser.set(userId, userSockets);

    socket.on("pong", () => {
      state.isAlive = true;
    });

    socket.on("message", (raw: RawData, isBinary: boolean) => {
      if (isBinary) {
        socket.close(1003, "Text messages only");
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString("utf8")) as unknown;
      } catch {
        socket.close(1007, "Invalid payload");
        return;
      }
      const message = parseRealtimeClientMessage(parsed);
      if (!message) {
        socket.close(1008, "Invalid event");
        return;
      }

      if (message.type === "conversation.subscribe") {
        if (
          !state.subscriptions.has(message.conversationId) &&
          state.subscriptions.size >= MAX_SUBSCRIPTIONS_PER_SOCKET
        ) {
          return;
        }
        void resolveTypingPeer(userId, message.conversationId)
          .then((otherUserId) => {
            if (otherUserId && socket.readyState === WebSocket.OPEN) {
              state.subscriptions.set(message.conversationId, otherUserId);
            }
          })
          .catch((error: unknown) => {
            logEvent("error", "realtime.subscription_failed", {
              ...errorLogFields(error),
            });
          });
        return;
      }

      if (message.type === "conversation.unsubscribe") {
        if (state.activeTyping.has(message.conversationId)) {
          void publishTyping(state, message.conversationId, false);
        }
        state.subscriptions.delete(message.conversationId);
        return;
      }

      const now = Date.now();
      if (
        message.isTyping &&
        now - state.lastTypingEventAt < TYPING_EVENT_MIN_INTERVAL_MS
      ) {
        return;
      }
      if (message.isTyping) state.lastTypingEventAt = now;

      const publish = async () => {
        if (!state.subscriptions.has(message.conversationId)) {
          const otherUserId = await resolveTypingPeer(
            userId,
            message.conversationId,
          );
          if (!otherUserId || socket.readyState !== WebSocket.OPEN) return;
          state.subscriptions.set(message.conversationId, otherUserId);
        }
        await publishTyping(state, message.conversationId, message.isTyping);
      };
      void publish().catch((error: unknown) => {
        logEvent("error", "realtime.typing_validation_failed", {
          ...errorLogFields(error),
        });
      });
    });

    socket.once("close", () => {
      stopSocketTyping(state);
      sockets.delete(socket);
      const remaining = socketsByUser.get(userId);
      remaining?.delete(socket);
      if (remaining?.size === 0) socketsByUser.delete(userId);
    });

    socket.once("error", (error: Error) => {
      logEvent("warn", "realtime.socket_error", {
        ...errorLogFields(error),
      });
    });

    sendEvent(socket, {
      type: "ready",
      version: REALTIME_PROTOCOL_VERSION,
    });
    },
  );

  const heartbeatTimer = setInterval(() => {
    for (const [socket, state] of sockets) {
      if (!state.isAlive) {
        socket.terminate();
        continue;
      }
      state.isAlive = false;
      socket.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref();

  void connectListener();

  return {
    handles(request: IncomingMessage) {
      return realtimePathname(request, origin) === REALTIME_PATH;
    },
    handleUpgrade(
      request: IncomingMessage,
      socket: Duplex,
      head: Buffer,
    ) {
      socket.on("error", () => undefined);
      if (request.headers.origin !== origin) {
        rejectUpgrade(socket, 403, "Forbidden");
        return;
      }

      void authenticate(request)
        .then((userId) => {
          if (!userId) {
            rejectUpgrade(socket, 401, "Unauthorized");
            return;
          }
          if (
            (socketsByUser.get(userId)?.size ?? 0) >= MAX_CONNECTIONS_PER_USER
          ) {
            rejectUpgrade(socket, 429, "Too Many Requests");
            return;
          }

          websocketServer.handleUpgrade(request, socket, head, (websocket) => {
            websocketServer.emit("connection", websocket, request, userId);
          });
        })
        .catch((error: unknown) => {
          logEvent("error", "realtime.authentication_failed", {
            ...errorLogFields(error),
          });
          rejectUpgrade(socket, 503, "Service Unavailable");
        });
    },
    async close() {
      isClosing = true;
      clearInterval(heartbeatTimer);
      if (listenerReconnectTimer) clearTimeout(listenerReconnectTimer);
      for (const socket of sockets.keys()) socket.close(1001, "Server shutdown");
      websocketServer.close();
      if (listenerClient) {
        const currentListener = listenerClient;
        listenerClient = null;
        await currentListener.end().catch(() => undefined);
      }
      await serverPool.end();
    },
  };
}

export async function startCampusServer(options: CampusServerOptions) {
  const app = next({
    dev: options.dev,
    dir: process.cwd(),
    hostname: options.hostname,
    port: options.port,
  });
  await app.prepare();
  const handleRequest = app.getRequestHandler();
  const handleNextUpgrade = app.getUpgradeHandler();
  const realtimePool = new Pool({
    connectionString: options.databaseUrl,
    max: 3,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    allowExitOnIdle: true,
    application_name: "kampus-realtime",
  });
  realtimePool.on("error", (error) => {
    logEvent("error", "realtime.database_pool_error", {
      ...errorLogFields(error),
    });
  });
  const realtime = attachRealtimeServer(realtimePool, options.origin);
  let isClosing = false;

  const server = createServer(
    (request: IncomingMessage, response: ServerResponse) => {
      const controlled = options.controlledShutdown;
      if (
        controlled &&
        request.method === "POST" &&
        request.url === controlled.path &&
        request.headers["x-e2e-shutdown-token"] === controlled.token
      ) {
        response.writeHead(204);
        response.end(() => {
          setImmediate(() => {
            void close().then(() => {
              if (controlled.exitProcess) process.exit(0);
            });
          });
        });
        return;
      }

      void handleRequest(request, response);
    },
  );

  server.on("upgrade", (request, socket, head) => {
    if (realtime.handles(request)) {
      realtime.handleUpgrade(request, socket, head);
      return;
    }
    void handleNextUpgrade(request, socket, head);
  });

  async function close() {
    if (isClosing) return;
    isClosing = true;
    await realtime.close();
    const serverClosed = new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeIdleConnections();
      server.closeAllConnections();
    });
    await Promise.allSettled([app.close(), serverClosed]);
  }

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.hostname, () => {
      server.off("error", reject);
      resolve();
    });
  });

  return { close };
}
