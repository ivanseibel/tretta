

describe('validação independente: respostas e avisos obsoletos', () => {
  it('ack de menu já fechado não encerra o menu novo', async () => {
    await mount();
    await enterRoom();
    const t0 = Date.now();
    fireEvent.click(screen.getByTestId('mood-avatar-player_biA'));
    fireEvent.click(screen.getByTestId('mood-taunt-tomate'));
    const pending = takePending('client:tauntSend');
    fireEvent.click(screen.getByTestId('mood-menu-close'));
    fireEvent.click(screen.getByTestId('mood-avatar-player_anA'));
    expect(screen.getByTestId('mood-menu').dataset.menuKind).toBe('reaction');
    await complete(pending, { ok: true, taunt: taunt('old-menu', ANA_ACTOR, BIA_ACTOR), limits: { serverTime: t0, nextSendAt: t0 + 15000 } });
    expect(screen.queryByTestId('mood-menu')?.dataset.menuKind).toBe('reaction');
  });

  it.each(['disconnect', 'new-round'])('ack atrasado não restaura apresentação depois de %s', async (transition) => {
    await mount();
    await enterRoom();
    const t0 = Date.now();
    fireEvent.click(screen.getByTestId('mood-avatar-player_anA'));
    fireEvent.click(screen.getByTestId('mood-reaction-rindo'));
    const pending = takePending('client:reactionSend');
    if (transition === 'disconnect') {
      harness.state.connected = false;
      deliver('disconnect');
    } else {
      await pushState(stateMessage('ROOM01', { status: 'playing', roundId: 'new-round', version: 2 }));
    }
    expect(Object.keys(api().activeReactions)).toEqual([]);
    await complete(pending, { ok: true, reaction: reaction('old-generation', 'rindo', ANA_ACTOR), limits: { serverTime: t0, nextSendAt: t0 + 5000 } });
    expect(Object.keys(api().activeReactions)).toEqual([]);
    expect(screen.queryByTestId('mood-feedback')).toBeNull();
  });

  it('repetição de provocação antiga não substitui o aviso mais recente', async () => {
    await mount();
    await enterRoom();
    await pushState(stateMessage('ROOM01', { participants: [ANA, BIA, CAI], version: 2 }));
    const old = taunt('old-notice', BIA_ACTOR, ANA_ACTOR);
    deliver('server:taunt', { roomCode: 'ROOM01', taunt: old });
    advance(1000);
    const latest = taunt('new-notice', CAI_ACTOR, ANA_ACTOR);
    deliver('server:taunt', { roomCode: 'ROOM01', taunt: latest });
    const receivedAt = api().moodNotice?.receivedAt;
    expect(api().moodNotice?.taunt.id).toBe('new-notice');
    advance(1000);
    deliver('server:taunt', { roomCode: 'ROOM01', taunt: old });
    expect(api().moodNotice?.taunt.id).toBe('new-notice');
    expect(api().moodNotice?.receivedAt).toBe(receivedAt);
  });
});
