import type { GameEngine, GameState } from '../interfaces';
import type { Player, GameAction, GameResult } from '../types';

export class GameTester {
  private engine: GameEngine;
  private _state: GameState | null = null;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  get state(): GameState {
    if (!this._state) throw new Error('GameTester: call init() before accessing state');
    return this._state;
  }

  get phase(): string {
    return this.state.phase;
  }

  get playerStates() {
    return this.state.players;
  }

  init(players: Player[], options?: Record<string, unknown>): GameState {
    this._state = this.engine.init(players, options);
    return this._state;
  }

  act(playerId: string, action: GameAction): GameState {
    if (!this._state) throw new Error('GameTester: call init() before act()');
    this._state = this.engine.handleAction(this._state, playerId, action);
    return this._state;
  }

  isGameOver(): boolean {
    return this.engine.isGameOver(this.state);
  }

  getResult(): GameResult {
    return this.engine.getResult(this.state);
  }

  getPlayerView(playerId: string): Partial<GameState> {
    return this.engine.getPlayerView(this.state, playerId);
  }
}
