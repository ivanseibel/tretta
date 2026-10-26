import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@tretta/protocol';
import type { RandomSource } from '@tretta/rules';
import { registerRoomHandlers } from './handlers.js';
import type { RoomClock } from './clock.js';
import { RoomStore, type RoomTransport } from './rooms.js';

export interface TrettaServerOptions {
  readonly webOrigin?: string;
  readonly randomFactory?: () => RandomSource;
  /** RNG cosmético dos efeitos automáticos; padrão Math.random, fora do de regras. */
  readonly effectRandomFactory?: () => RandomSource;
  readonly testHooks?: boolean;
  /** Relógio e agendamento da camada de sala/serviço; padrão usa Date.now/setTimeout. */
  readonly clock?: RoomClock;
  /** Configuráveis para testes com relógio controlado; padrões 90s e 15min. */
  readonly pauseGraceMs?: number;
  readonly retentionMs?: number;
  readonly botDelayMs?: number;
  /** Intervalo do emissor de reação; padrão 5s, encurtado só em testes. */
  readonly reactionCooldownMs?: number;
}

export interface TrettaServer {
  readonly httpServer: ReturnType<typeof createHttpServer>;
  readonly io: Server<ClientToServerEvents, ServerToClientEvents>;
  readonly rooms: RoomStore;
  listen(port?: number): Promise<number>;
  close(): Promise<void>;
  port(): number | null;
}

export function createTrettaServer(options: TrettaServerOptions = {}): TrettaServer {
  const webOrigin = options.webOrigin ?? 'http://localhost:3000';
  const httpServer = createHttpServer(requestHandler);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: [webOrigin] },
  });

  const transport: RoomTransport = {
    toSocket: (socketId, message) => {
      io.to(socketId).emit('server:state', message);
    },
    toRoom: (roomCode, message) => {
      io.to(roomCode).emit('server:events', message);
    },
    toRoomChat: (roomCode, message) => {
      io.to(roomCode).emit('server:chat', message);
    },
    toRoomReaction: (roomCode, message) => {
      io.to(roomCode).emit('server:reaction', message);
    },
    attach: (socketId, roomCode) => {
      const socket = io.sockets.sockets.get(socketId);
      if (socket !== undefined) void socket.join(roomCode);
    },
    detach: (socketId, roomCode) => {
      const socket = io.sockets.sockets.get(socketId);
      if (socket !== undefined) socket.leave(roomCode);
    },
    removed: (socketId, message) => {
      const socket = io.sockets.sockets.get(socketId);
      if (socket === undefined) return;
      socket.leave(message.roomCode);
      socket.emit('server:removed', message);
    },
  };
  const rooms = new RoomStore(transport, options.randomFactory ?? ((): RandomSource => Math.random), {
    ...(options.clock === undefined ? {} : { clock: options.clock }),
    ...(options.pauseGraceMs === undefined ? {} : { pauseGraceMs: options.pauseGraceMs }),
    ...(options.retentionMs === undefined ? {} : { retentionMs: options.retentionMs }),
    ...(options.botDelayMs === undefined ? {} : { botDelayMs: options.botDelayMs }),
    ...(options.reactionCooldownMs === undefined ? {} : { reactionCooldownMs: options.reactionCooldownMs }),
    ...(options.effectRandomFactory === undefined ? {} : { effectRandomFactory: options.effectRandomFactory }),
  });
  registerRoomHandlers(io, rooms, { testHooks: options.testHooks ?? false });

  return {
    httpServer,
    io,
    rooms,
    listen: (port = 3100) =>
      new Promise<number>((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(port, () => {
          const address = httpServer.address();
          if (address === null || typeof address === 'string') {
            reject(new Error('Endereço do servidor indisponível.'));
            return;
          }
          resolve(address.port);
        });
      }),
    close: () =>
      new Promise<void>((resolve) => {
        rooms.shutdown();
        io.close(() => {
          resolve();
        });
      }),
    port: () => {
      const address = httpServer.address();
      return address !== null && typeof address !== 'string' ? address.port : null;
    },
  };
}

function requestHandler(request: IncomingMessage, response: ServerResponse): void {
  if (request.url === '/healthz') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{"ok":true}');
    return;
  }
  response.writeHead(404, { 'content-type': 'application/json' });
  response.end('{"error":"not-found"}');
}
