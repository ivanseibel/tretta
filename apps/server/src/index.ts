import { createSeededRandom, type RandomSource } from '@tretta/rules';
import { loadConfig } from './config.js';
import { createTrettaServer } from './server.js';

const config = loadConfig();
const server = createTrettaServer({
  webOrigin: config.webOrigin,
  testHooks: config.testHooks,
  pauseGraceMs: config.pauseGraceMs,
  retentionMs: config.retentionMs,
  tauntCooldownMs: config.tauntCooldownMs,
  ...(config.seed === null
    ? {}
    : {
        randomFactory: (): RandomSource => createSeededRandom(config.seed as number),
        // Semente própria para a apresentação: mesma partida reproduzível sem
        // acoplar a escolha de variação ao resultado das regras.
        effectRandomFactory: (): RandomSource => createSeededRandom((config.seed as number) ^ 0x5eed),
      }),
});

const port = await server.listen(config.port);
console.log(`Tretta server listening on http://localhost:${port} (web origin: ${config.webOrigin})`);

let shuttingDown = false;
const shutdown = (): void => {
  if (shuttingDown) return;
  shuttingDown = true;
  void server.close().then(() => {
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
