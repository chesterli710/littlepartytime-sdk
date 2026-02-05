import { describe, it, expect } from 'vitest';
import { createMockPlayers } from '../index';

describe('createMockPlayers', () => {
  it('should create the specified number of players', () => {
    const players = createMockPlayers(3);
    expect(players).toHaveLength(3);
  });

  it('should make the first player the host', () => {
    const players = createMockPlayers(2);
    expect(players[0].isHost).toBe(true);
    expect(players[1].isHost).toBe(false);
  });

  it('should generate unique ids', () => {
    const players = createMockPlayers(4);
    const ids = players.map(p => p.id);
    expect(new Set(ids).size).toBe(4);
  });

  it('should generate default nicknames', () => {
    const players = createMockPlayers(2);
    expect(players[0].nickname).toBe('Player 1');
    expect(players[1].nickname).toBe('Player 2');
  });

  it('should accept overrides', () => {
    const players = createMockPlayers(2, [
      { nickname: 'Alice' },
      { nickname: 'Bob', isHost: true },
    ]);
    expect(players[0].nickname).toBe('Alice');
    expect(players[1].nickname).toBe('Bob');
    expect(players[1].isHost).toBe(true);
  });

  it('should set avatarUrl to null by default', () => {
    const players = createMockPlayers(1);
    expect(players[0].avatarUrl).toBeNull();
  });
});
