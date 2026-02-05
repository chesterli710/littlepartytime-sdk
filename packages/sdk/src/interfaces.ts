import type { Player, GameAction, GameResult, Platform } from './types';

export interface PlayerState {
  id: string;
  [key: string]: unknown;
}

export interface GameState {
  phase: string;
  players: PlayerState[];
  data: Record<string, unknown>;
}

export interface GameConfig {
  id: string;
  name: string;
  description: string;
  coverImage: string;
  minPlayers: number;
  maxPlayers: number;
  tags: string[];
  version: string;
  sdkVersion: string;
  price?: number;
}

export interface GameEngine {
  init(players: Player[], options?: Record<string, unknown>): GameState;
  handleAction(state: GameState, playerId: string, action: GameAction): GameState;
  isGameOver(state: GameState): boolean;
  getResult(state: GameState): GameResult;
  getPlayerView(state: GameState, playerId: string): Partial<GameState>;
}

export interface GameRendererProps {
  platform: Platform;
  state: Partial<GameState>;
}
