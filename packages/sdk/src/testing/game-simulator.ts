import type { GameEngine, GameState } from '../interfaces';
import type { Player, GameAction, GameResult } from '../types';
import { createMockPlayers } from './mock-players';

export interface ActionLogEntry {
  playerIndex: number;
  playerId: string;
  action: GameAction;
  stateBefore: GameState;
  stateAfter: GameState;
}

export class GameSimulator {
  private engine: GameEngine;
  private playerCount: number;
  private _players: Player[] = [];
  private _state: GameState | null = null;
  private _actionLog: ActionLogEntry[] = [];

  constructor(engine: GameEngine, options: { playerCount: number }) {
    this.engine = engine;
    this.playerCount = options.playerCount;
  }

  get players(): Player[] { return this._players; }

  get state(): GameState {
    if (!this._state) throw new Error('GameSimulator: call start() first');
    return this._state;
  }

  get actionLog(): ActionLogEntry[] { return this._actionLog; }

  get currentTurn(): number {
    const data = this.state.data as { currentPlayerIndex?: number };
    return data.currentPlayerIndex ?? 0;
  }

  start(options?: Record<string, unknown>): void {
    this._players = createMockPlayers(this.playerCount);
    this._state = this.engine.init(this._players, options);
    this._actionLog = [];
  }

  act(playerIndex: number, action: GameAction): void {
    if (!this._state) throw new Error('GameSimulator: call start() first');
    if (playerIndex < 0 || playerIndex >= this._players.length) {
      throw new Error(`GameSimulator: invalid playerIndex ${playerIndex}`);
    }
    const playerId = this._players[playerIndex].id;
    const stateBefore = this._state;
    this._state = this.engine.handleAction(this._state, playerId, action);
    this._actionLog.push({ playerIndex, playerId, action, stateBefore, stateAfter: this._state });
  }

  getView(playerIndex: number): Partial<GameState> {
    if (playerIndex < 0 || playerIndex >= this._players.length) {
      throw new Error(`GameSimulator: invalid playerIndex ${playerIndex}`);
    }
    return this.engine.getPlayerView(this.state, this._players[playerIndex].id);
  }

  isGameOver(): boolean { return this.engine.isGameOver(this.state); }

  getResult(): GameResult { return this.engine.getResult(this.state); }
}
