import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Ack, JoinRoomAck } from '@tretta/protocol';
import { connect, createRoom, intent, joinOrFail, latestState, record, request } from './helpers.js';

const distEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));

async function startProcess(): Promise<{ child: ChildProcess; port: number }> {
  const child = spawn(process.execPath, [distEntry], {
    env: { ...process.env, TRE_TTA_PORT: '0', TRE_TTA_TEST_HOOKS: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const port = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('servidor não anunciou a porta em 10s')), 10_000);
    let output = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      const match = /listening on http:\/\/localhost:(\d+)/.exec(output);
      if (match?.[1] !== undefined) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`servidor encerrou com código ${String(code)}: ${output}`));
    });
  });
  return { child, port };
}

async function killProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await once(child, 'exit');
}

describe.skipIf(!existsSync(distEntry))('reinício do processo real', () => {
  it('sala e placar em memória deixam de existir; a credencial antiga é recusada', async () => {
    const first = await startProcess();
    let firstAlive = true;
    try {
      const url = `http://127.0.0.1:${first.port}`;
      const host = await connect(url);
      const hostRec = record(host);
      const created = await createRoom(host, 'Ana');
      expect(created.ok).toBe(true);
      if (!created.ok) throw new Error('criação falhou');
      const guest = await connect(url);
      const joined = await joinOrFail(guest, created.roomCode, 'Bia');
      expect(joined.ok).toBe(true);
      if (!joined.ok) throw new Error('entrada falhou');
      expect(latestState(hostRec).room.participants).toHaveLength(2);
      host.disconnect();
      guest.disconnect();

      await killProcess(first.child);
      firstAlive = false;

      const second = await startProcess();
      try {
        const urlAfter = `http://127.0.0.1:${second.port}`;
        const health = await fetch(`${urlAfter}/healthz`);
        expect(health.status).toBe(200);

        const rejoin = await connect(urlAfter);
        const stale = await request<Ack<JoinRoomAck>>(rejoin, 'client:joinRoom', {
          intentId: intent(),
          roomCode: created.roomCode,
          nickname: 'Bia',
          avatar: 'lobo',
          credential: joined.credential,
        });
        expect(stale.ok).toBe(false);
        if (stale.ok) throw new Error('esperava recusa');
        expect(stale.error.code).toBe('ROOM_NOT_FOUND');
        rejoin.disconnect();
      } finally {
        await killProcess(second.child);
      }
    } finally {
      if (firstAlive) await killProcess(first.child);
    }
  }, 30_000);
});
