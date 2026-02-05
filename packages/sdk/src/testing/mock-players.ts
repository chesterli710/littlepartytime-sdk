import type { Player } from '../types';

export function createMockPlayers(
  count: number,
  overrides?: Partial<Player>[]
): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i + 1}`,
    nickname: `Player ${i + 1}`,
    avatarUrl: null,
    isHost: i === 0,
    ...overrides?.[i],
  }));
}
