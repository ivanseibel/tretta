import { expect, it } from 'vitest';
import type { Ack, JoinRoomAck } from '@tretta/protocol';
import {
  connect, createRoom, FakeClock, intent, joinOrFail, latestState,
  reactionSend, record, request, setReady, startTestServer, tauntSend, waitFor,
  type TestClient,
} from './helpers.js';

function ok<T extends object>(ack: Ack<T>): T {
  if (!ack.ok) throw new Error(ack.error.code);
  return ack;
}

it('rejoin com ambos os limites ativos e replay vencido preservam prazos e broadcast único', async () => {
  const clock = new FakeClock();
  const server = await startTestServer({ clock });
  const clients: TestClient[] = [];
  async function client() {
    const socket = await connect(server.url);
    clients.push(socket);
    return socket;
  }
  try {
    const host = await client();
    const created = ok(await createRoom(host, 'Origem'));
    const guest = await client();
    const guestRec = record(guest);
    const joined = ok(await joinOrFail(guest, created.roomCode, 'Alvo'));
    const t0 = clock.now();
    const originalIntent = intent();
    const first = ok(await reactionSend(host, created.roomCode, 'rindo', originalIntent));
    ok(await tauntSend(host, created.roomCode, 'tomate', joined.playerId));
    const refusalIntent = intent();
    const refused = await reactionSend(host, created.roomCode, 'bravo', refusalIntent);
    expect(refused.ok).toBe(false);
    host.disconnect();
    await waitFor(() => latestState(guestRec).room.participants.some(p => p.id === created.playerId && !p.connected));
    clock.advance(1000);
    const back = await client();
    const rec = record(back);
    ok(await request<Ack<JoinRoomAck>>(back, 'client:joinRoom', {
      intentId: intent(), roomCode: created.roomCode, nickname: 'Origem',
      avatar: 'raposa', credential: created.credential,
    }));
    await waitFor(() => rec.states.length > 0);
    const recovered = latestState(rec);
    expect(recovered.self.playerId).toBe(created.playerId);
    expect(recovered.room.serverTime).toBe(t0 + 1000);
    expect(recovered.self.reactionNextSendAt).toBe(t0 + 5000);
    expect(recovered.self.tauntNextSendAt).toBe(t0 + 15000);
    const tauntBlocked = await tauntSend(back, created.roomCode, 'torta', joined.playerId);
    expect(tauntBlocked.ok).toBe(false);
    if (!tauntBlocked.ok) expect(tauntBlocked.error.retry?.retryAt).toBe(t0 + 15000);

    clock.advance(4000);
    expect(ok(await reactionSend(back, created.roomCode, 'rindo', originalIntent))).toEqual(first);
    expect(await reactionSend(back, created.roomCode, 'bravo', refusalIntent)).toEqual(refused);
    ok(await setReady(back, true));
    await waitFor(() => latestState(rec).self.ready);
    expect(rec.reactions).toHaveLength(0);
    expect(latestState(rec).self.reactionNextSendAt).toBeNull();
    expect(latestState(rec).self.tauntNextSendAt).toBe(t0 + 15000);
    const next = ok(await reactionSend(back, created.roomCode, 'bravo'));
    expect(next.limits.nextSendAt).toBe(t0 + 10000);
    await waitFor(() => rec.reactions.length === 1);
    expect(rec.reactions[0]?.reaction.id).toBe(next.reaction.id);

    clock.advance(10000);
    const nextTaunt = ok(await tauntSend(back, created.roomCode, 'torta', joined.playerId));
    expect(nextTaunt.limits).toEqual({ serverTime: t0 + 15000, nextSendAt: t0 + 30000 });
  } finally {
    for (const socket of clients) socket.disconnect();
    await server.close();
  }
});
