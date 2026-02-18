import { describe, it, expect } from 'vitest';
import * as GameRoom from '../server/game-room';

describe('getNextAvailableName', () => {
  it('should return Alice for an empty room', () => {
    const room = GameRoom.createRoom('test');
    expect(GameRoom.getNextAvailableName(room)).toBe('Alice');
  });

  it('should skip names already taken', () => {
    const room = GameRoom.createRoom('test');
    GameRoom.addPlayer(room, 's1', 'Alice');
    GameRoom.addPlayer(room, 's2', 'Bob');
    expect(GameRoom.getNextAvailableName(room)).toBe('Carol');
  });

  it('should fill gaps when a middle name is freed', () => {
    const room = GameRoom.createRoom('test');
    GameRoom.addPlayer(room, 's1', 'Alice');
    GameRoom.addPlayer(room, 's2', 'Bob');
    GameRoom.addPlayer(room, 's3', 'Carol');
    GameRoom.removePlayer(room, 's2'); // Bob leaves
    expect(GameRoom.getNextAvailableName(room)).toBe('Bob');
  });

  it('should fallback to Player N when all 8 names are used', () => {
    const room = GameRoom.createRoom('test');
    const names = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Heidi'];
    names.forEach((n, i) => GameRoom.addPlayer(room, `s${i}`, n));
    expect(GameRoom.getNextAvailableName(room)).toBe('Player 9');
  });

  it('should not return a duplicate Player N when a fallback name is already taken', () => {
    const room = GameRoom.createRoom('test');
    const names = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Heidi'];
    names.forEach((n, i) => GameRoom.addPlayer(room, `s${i}`, n));
    GameRoom.addPlayer(room, 's8', 'Player 9');
    GameRoom.removePlayer(room, 's0'); // Alice leaves
    GameRoom.addPlayer(room, 's9', 'Alice'); // Alice slot taken again
    // All 8 pool names taken, Player 9 also taken → must not return 'Player 9'
    expect(GameRoom.getNextAvailableName(room)).toBe('Player 10');
  });
});
