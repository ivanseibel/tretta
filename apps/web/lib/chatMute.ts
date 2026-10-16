const MUTE_PREFIX = 'tretta.chatMute.';

function muteKey(roomCode: string): string {
  return `${MUTE_PREFIX}${roomCode}`;
}

/** Identidades silenciadas nesta sala neste navegador (por playerId, nunca por apelido). */
export function loadMuted(roomCode: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(muteKey(roomCode));
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return [];
  }
}

/** Persiste a escolha; lista vazia remove a chave (mesma sala limpa). */
export function saveMuted(roomCode: string, playerIds: readonly string[]): void {
  if (typeof window === 'undefined') return;
  if (playerIds.length === 0) {
    window.localStorage.removeItem(muteKey(roomCode));
    return;
  }
  try {
    window.localStorage.setItem(muteKey(roomCode), JSON.stringify(playerIds));
  } catch {
    // Armazenamento indisponível: o silêncio vale só nesta sessão da página.
  }
}
