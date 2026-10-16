import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { connect, createRoom, latestState, record, request } from './helpers.js';

const distEntry = fileURLToPath(new URL('../dist/index.js', import.meta.url));

describe.skipIf(!existsSync(distEntry))('processo real', () => {
  it('inicia com node dist/index.js, importa o motor e aceita uma sala', async () => {
    const { child, port } = await startCompiledServer({ TRE_TTA_PORT: '0', TRE_TTA_TEST_HOOKS: '1' });
    try {
      const socket = await connect(`http://127.0.0.1:${port}`);
      const recorder = record(socket);
      const created = await createRoom(socket, 'Processo');
      expect(created.ok).toBe(true);
      if (!created.ok) throw new Error('criação falhou');
      expect(latestState(recorder).room.participants).toHaveLength(1);
      socket.disconnect();
    } finally {
      child.kill('SIGTERM');
      await once(child, 'exit');
    }
  }, 30_000);

  it('em produção recusa hooks de teste no processo compilado', async () => {
    const { child, port } = await startCompiledServer({
      NODE_ENV: 'production', TRE_TTA_PORT: '0', TRE_TTA_TEST_HOOKS: '0', TRE_TTA_SEED: '',
    });
    let socket: Awaited<ReturnType<typeof connect>> | undefined;
    try {
      socket = await connect(`http://127.0.0.1:${port}`);
      const created = await createRoom(socket, 'Produção local');
      if (!created.ok) throw new Error('criação da sala falhou');
      const deck = await request<{ ok: boolean; error?: { code: string } }>(socket, 'test:setNextDeck', {
        intentId: 'production-hook-deck', roomCode: created.roomCode, deck: [],
      });
      const effect = await request<{ ok: boolean; error?: { code: string } }>(socket, 'test:setEffectVariant', {
        intentId: 'production-hook-effect', roomCode: created.roomCode, variant: null,
      });
      expect(deck).toMatchObject({ ok: false, error: { code: 'TEST_HOOKS_DISABLED' } });
      expect(effect).toMatchObject({ ok: false, error: { code: 'TEST_HOOKS_DISABLED' } });
    } finally {
      socket?.disconnect();
      child.kill('SIGTERM');
      await once(child, 'exit');
    }
  }, 30_000);
});

describe.skipIf(existsSync(distEntry))('processo real (aguardando build)', () => {
  it.skip('execute pnpm build antes da suíte para cobrir o processo compilado', () => {});
});

async function startCompiledServer(environment: NodeJS.ProcessEnv): Promise<{ child: ReturnType<typeof spawn>; port: number }> {
  const child = spawn(process.execPath, [distEntry], {
    env: { ...process.env, ...environment },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const port = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('servidor compilado não anunciou a porta em 10s')), 10_000);
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      const match = /listening on http:\/\/localhost:(\d+)/.exec(output);
      if (match?.[1] !== undefined) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`servidor compilado encerrou com código ${String(code)}: ${output}`));
    });
  });
  return { child, port };
}
