import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { test as base } from '@playwright/test';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const serverEntry = fileURLToPath(new URL('../../server/dist/index.js', import.meta.url));

/** Prazo de substituição encurtado para os testes de navegador (ganchos ligados). */
export const E2E_GRACE_MS = 3000;

class RestartableServer {
  private child: ChildProcess;
  port = 3100;

  private constructor(child: ChildProcess, port: number) {
    this.child = child;
    this.port = port;
  }

  static async start(): Promise<RestartableServer> {
    const child = spawn(process.execPath, [serverEntry], {
      cwd: repoRoot,
      env: {
        ...process.env,
        TRE_TTA_PORT: '3100',
        TRE_TTA_WEB_ORIGIN: 'http://localhost:3000',
        TRE_TTA_SEED: '7',
        TRE_TTA_TEST_HOOKS: '1',
        TRE_TTA_GRACE_MS: String(E2E_GRACE_MS),
        TRE_TTA_RETENTION_MS: '60000',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const port = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('servidor E2E não anunciou a porta em 15s')), 15_000);
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
        reject(new Error(`servidor E2E encerrou com código ${String(code)}: ${output}`));
      });
    });
    const server = new RestartableServer(child, port);
    await server.waitForHealth();
    return server;
  }

  private async waitForHealth(): Promise<void> {
    const deadline = Date.now() + 10_000;
    for (;;) {
      try {
        const response = await fetch(`http://127.0.0.1:${this.port}/healthz`);
        if (response.ok) return;
      } catch {
        // ainda subindo
      }
      if (Date.now() > deadline) throw new Error('servidor E2E sem /healthz a tempo');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async restart(): Promise<void> {
    await this.stop();
    const next = await RestartableServer.start();
    this.child = next.child;
    this.port = next.port;
  }

  async stop(): Promise<void> {
    if (this.child.exitCode !== null || this.child.signalCode !== null) return;
    this.child.kill('SIGTERM');
    await once(this.child, 'exit');
  }
}

export interface ServerFixture {
  restart(): Promise<void>;
}

export const test = base.extend<Record<never, never>, { serverProc: ServerFixture }>({
  serverProc: [
    async ({}, use) => {
      const server = await RestartableServer.start();
      try {
        await use({ restart: () => server.restart() });
      } finally {
        await server.stop();
      }
    },
    { scope: 'worker', auto: true },
  ],
});

export { expect } from '@playwright/test';
