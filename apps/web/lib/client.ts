import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@tretta/protocol';
import type { Avatar } from '@tretta/protocol/shared';

export const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3100';

export type RoomSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createSocket(): RoomSocket {
  return io(SERVER_URL, { transports: ['websocket'] });
}

export function newIntentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `intent_${crypto.randomUUID()}`;
  }
  return `intent_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export interface StoredIdentity {
  playerId: string;
  credential: string;
  nickname: string;
  avatar: Avatar;
}

function storageKey(roomCode: string): string {
  return `tretta.identity.${roomCode}`;
}

export function loadIdentity(roomCode: string): StoredIdentity | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(storageKey(roomCode));
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredIdentity>;
    if (
      typeof parsed.playerId === 'string' &&
      typeof parsed.credential === 'string' &&
      typeof parsed.nickname === 'string' &&
      typeof parsed.avatar === 'string'
    ) {
      return {
        playerId: parsed.playerId,
        credential: parsed.credential,
        nickname: parsed.nickname,
        avatar: parsed.avatar as Avatar,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function saveIdentity(roomCode: string, identity: StoredIdentity): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(roomCode), JSON.stringify(identity));
}

export function clearIdentity(roomCode: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey(roomCode));
}
