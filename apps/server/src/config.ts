import { DEFAULT_PAUSE_GRACE_MS, DEFAULT_RETENTION_MS } from './rooms.js';
import { TAUNT_SENDER_COOLDOWN_MS } from '@tretta/protocol/shared';

export interface ServerConfig {
  readonly port: number;
  readonly webOrigin: string;
  readonly seed: number | null;
  readonly testHooks: boolean;
  readonly pauseGraceMs: number;
  readonly retentionMs: number;
  readonly tauntCooldownMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const testHooks = env.TRE_TTA_TEST_HOOKS === '1';
  const usePlatformPort = env.TRE_TTA_PORT === undefined || env.TRE_TTA_PORT === '';
  const configuredPort = usePlatformPort ? env.PORT : env.TRE_TTA_PORT;
  return {
    port: parsePort(configuredPort, usePlatformPort ? 'PORT' : 'TRE_TTA_PORT'),
    webOrigin: env.TRE_TTA_WEB_ORIGIN ?? 'http://localhost:3000',
    seed: parseSeed(env.TRE_TTA_SEED),
    testHooks,
    // Prazos encurtados só existem com ganchos de teste ligados; nunca em execução normal.
    pauseGraceMs: testHooks ? parseDurationMs(env.TRE_TTA_GRACE_MS, 'TRE_TTA_GRACE_MS', DEFAULT_PAUSE_GRACE_MS) : DEFAULT_PAUSE_GRACE_MS,
    retentionMs: testHooks ? parseDurationMs(env.TRE_TTA_RETENTION_MS, 'TRE_TTA_RETENTION_MS', DEFAULT_RETENTION_MS) : DEFAULT_RETENTION_MS,
    tauntCooldownMs: testHooks
      ? parseDurationMs(env.TRE_TTA_TAUNT_COOLDOWN_MS, 'TRE_TTA_TAUNT_COOLDOWN_MS', TAUNT_SENDER_COOLDOWN_MS)
      : TAUNT_SENDER_COOLDOWN_MS,
  };
}

function parsePort(value: string | undefined, name: 'PORT' | 'TRE_TTA_PORT'): number {
  if (value === undefined || value === '') return 3100;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`${name} inválido: ${value}. Use um inteiro de 0 a 65535.`);
  }
  return port;
}

function parseSeed(value: string | undefined): number | null {
  if (value === undefined || value === '') return null;
  const seed = Number(value);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error(`TRE_TTA_SEED inválido: ${value}. Use um inteiro de 0 a 4294967295.`);
  }
  return seed;
}

function parseDurationMs(value: string | undefined, name: string, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 24 * 60 * 60_000) {
    throw new Error(`${name} inválido: ${value}. Use um inteiro de 1 a 86400000 (ms).`);
  }
  return parsed;
}
