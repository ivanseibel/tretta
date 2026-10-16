// Evidência independente do orquestrador. Executar da raiz após build.
// Executa o fonte atual do RoomProvider, transpilado sem alteração, com hooks e
// transporte controlados. Não monta DOM nem simula o agendamento de React.
// A paginação usa o RoomStore compilado real. Nenhum arquivo de produção é editado.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const root = new URL('../../../../../', import.meta.url);
const requireRoot = createRequire(new URL('package.json', root));
const ts = requireRoot('typescript');
const { RoomStore } = await import(new URL('apps/server/dist/rooms.js', root));
const { createSeededRandom } = await import(new URL('packages/rules/dist/index.js', root));
const source = readFileSync(new URL('apps/web/app/providers.tsx', root), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
function harness() {
  const cells = []; let cursor = 0; let nonce = 0;
  const pending = []; const handlers = new Map();
  const socket = {
    connected: true,
    on(event, callback) { handlers.set(event, callback); return this; },
    emit(event, payload, callback) { pending.push({ event, payload, callback }); },
    disconnect() {},
  };
  const react = {
    createContext: () => ({ Provider: {} }), useEffect() {},
    useCallback: callback => callback, useMemo: factory => factory(),
    useRef(initial) {
      const index = cursor++;
      if (!(index in cells)) cells[index] = { current: initial };
      return cells[index];
    },
    useState(initial) {
      const index = cursor++;
      if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial;
      return [cells[index], next => { cells[index] = typeof next === 'function' ? next(cells[index]) : next; }];
    },
  };
  const mocks = {
    react,
    'react/jsx-runtime': { jsx: (_type, props) => props.value },
    '@tretta/protocol/shared': { CHAT_HISTORY_PAGE_SIZE: 50 },
    '@/lib/client': { createSocket: () => socket, newIntentId: () => `validation_${++nonce}`, loadIdentity: () => null, saveIdentity() {}, clearIdentity() {} },
    '@/lib/chatMute': { loadMuted: () => [], saveMuted() {} },
  };
  const exports = {};
  new Function('require', 'exports', compiled)(name => {
    if (!(name in mocks)) throw new Error(`Import inesperado: ${name}`);
    return mocks[name];
  }, exports);
  const render = () => { cursor = 0; return exports.RoomProvider({ children: null }); };
  const respond = (event, response) => {
    const index = pending.findIndex(request => request.event === event);
    assert.notEqual(index, -1, `Requisição ausente: ${event}`);
    const [request] = pending.splice(index, 1);
    request.callback(response); return request.payload;
  };
  const enter = async code => {
    const result = render().createRoom('Pessoa', 'raposa');
    respond('client:createRoom', { ok: true, roomCode: code, playerId: `player_${code}`, credential: 'fixture_credential', version: 1 });
    assert.equal(await result, code);
  };
  const leave = async () => {
    const result = render().leaveRoom(); respond('client:leaveRoom', { ok: true, version: 2 });
    assert.equal(await result, true);
  };
  const broadcast = (code, message) => handlers.get('server:chat')({ roomCode: code, message });
  return { render, respond, enter, leave, broadcast, pending };
}
const msg = (seq, text) => ({ seq, text, author: { playerId: 'author_fixture', nickname: 'Autor', avatar: 'lobo' }, sentAt: 1000 });
function observation(value) { console.log(JSON.stringify(value)); }

// Controle: na mesma sala, acks e broadcast duplicado se mesclam normalmente.
{
  const h = harness(); await h.enter('AAAAAA');
  const history = h.render().loadChatHistory();
  h.respond('client:chatHistory', { ok: true, messages: [msg(1, 'primeira')], hasMore: false }); await history;
  const send = h.render().sendChat('segunda');
  h.respond('client:chatSend', { ok: true, message: msg(2, 'segunda') }); await send;
  h.broadcast('AAAAAA', msg(2, 'segunda'));
  assert.deepEqual(h.render().chatMessages.map(m => m.seq), [1, 2]);
  observation({ scenario: 'controle: acks na mesma sala e broadcast duplicado', messages: h.render().chatMessages.map(m => m.text), duplicates: 0 });
}

// 1. Resposta antiga de histórico na sala nova, mesmo com broadcasts antigos filtrados.
{
  const h = harness(); await h.enter('AAAAAA');
  const old = h.render().loadChatHistory();
  await h.leave(); await h.enter('BBBBBB');
  h.broadcast('AAAAAA', msg(3, 'broadcast antigo: deve ser ignorado'));
  assert.equal(h.render().chatMessages.length, 0);
  h.broadcast('BBBBBB', msg(2, 'mensagem da sala B'));
  h.respond('client:chatHistory', { ok: true, messages: [msg(1, 'histórico da sala A')], hasMore: true });
  await old;
  observation({ scenario: 'histórico atrasado após trocar de sala', activeRoom: 'B', messages: h.render().chatMessages.map(m => m.text), staleHasMoreApplied: h.render().chatHasMore });
  assert.equal(h.pending.length, 0);
}
// 2. Ack antigo de envio também é mesclado na sala nova.
{
  const h = harness(); await h.enter('AAAAAA');
  const old = h.render().sendChat('envio da sala A');
  await h.leave(); await h.enter('BBBBBB');
  h.broadcast('BBBBBB', msg(2, 'mensagem da sala B'));
  h.respond('client:chatSend', { ok: true, message: msg(1, 'envio da sala A') });
  await old;
  observation({ scenario: 'ack de envio atrasado após trocar de sala', activeRoom: 'B', messages: h.render().chatMessages.map(m => m.text) });
  assert.equal(h.pending.length, 0);
}
// 3. Página recente após desconexão > 50 mensagens deixa lacuna inacessível.
{
  let now = 1700000000000;
  const store = new RoomStore({ toSocket() {}, toRoom() {}, attach() {}, detach() {}, removed() {}, toRoomChat() {} },
    () => createSeededRandom(7), { clock: { now: () => now, setTimer: () => 1, clearTimer() {} } });
  const created = store.createRoom({ socketId: 'fixture_socket', nickname: 'Autor', avatar: 'lobo' });
  assert.equal(created.ok, true);
  const { room, participant } = created;
  const send = text => { now += 10000; assert.equal(store.sendChat(participant, room.code, text).ok, true); };
  const h = harness(); await h.enter(room.code);
  send('mensagem 1');
  const initial = h.render().loadChatHistory();
  h.respond('client:chatHistory', store.chatHistory(participant, room.code)); await initial;
  assert.equal(h.render().chatMessages.length, 1);
  // Durante a desconexão, o cliente não recebe broadcasts; outro autor mantém a sala.
  for (let seq = 2; seq <= 61; seq++) send(`mensagem ${seq}`);
  const refresh = h.render().loadChatHistory();
  h.respond('client:chatHistory', store.chatHistory(participant, room.code)); await refresh;
  const afterRefresh = h.render().chatMessages.map(m => m.seq);
  assert.equal(h.render().chatHasMore, true);
  // Cursor usado pelo botão real de ChatPanel: chatMessages[0].seq.
  const before = h.render().chatMessages[0].seq;
  const older = h.render().loadChatHistory(before);
  h.respond('client:chatHistory', store.chatHistory(participant, room.code, before)); await older;
  const received = new Set(h.render().chatMessages.map(m => m.seq));
  observation({ scenario: 'recuperação com mais de uma página perdida', serverMessages: room.chatMessages.length, receivedAfterRefresh: afterRefresh.length, receivedAfterLoadOlder: received.size, missing: room.chatMessages.filter(m => !received.has(m.seq)).map(m => m.seq), beforeSentByOlderButton: before, canLoadOlderAfterwards: h.render().chatHasMore });
  assert.equal(h.pending.length, 0); store.shutdown();
}

// Controle extra do critério 7: chat imediatamente após compra humana.
{
  const store = new RoomStore({ toSocket() {}, toRoom() {}, attach() {}, detach() {}, removed() {}, toRoomChat() {} },
    () => createSeededRandom(7));
  const created = store.createRoom({ socketId: 'a', nickname: 'Ana', avatar: 'raposa' });
  assert.equal(created.ok, true);
  const joined = store.joinRoom({ socketId: 'b', roomCode: created.room.code, nickname: 'Bia', avatar: 'lobo' });
  assert.equal(joined.ok, true);
  assert.equal(store.setReady(created.participant, true).ok, true);
  assert.equal(store.setReady(joined.participant, true).ok, true);
  assert.equal(store.startRound(created.participant).ok, true);
  const { room } = created;
  const currentId = room.round.state.seats[room.round.state.currentIndex].id;
  const actor = room.participants.get(currentId);
  assert.equal(store.applyRoundCommand(actor, room.round.id, { type: 'draw' }).ok, true);
  assert.equal(room.round.state.phase, 'after-draw');
  const before = JSON.stringify(room.round.state); const version = room.version; const timer = room.botTimer;
  assert.equal(store.sendChat(actor, room.code, 'logo após comprar').ok, true);
  assert.equal(store.chatHistory(actor, room.code).ok, true);
  assert.equal(JSON.stringify(room.round.state), before); assert.equal(room.version, version); assert.equal(room.botTimer, timer);
  observation({ scenario: 'controle: chat e consulta imediatamente após compra', phase: room.round.state.phase, engineUnchanged: true, roomVersionUnchanged: true, timerUnchanged: true });
  store.shutdown();
}
