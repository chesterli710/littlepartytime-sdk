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

export interface GameAssets {
  /** 1:1 game list icon (relative path from project root, .png or .webp) */
  icon: string;
  /** 16:9 lobby banner */
  banner: string;
  /** 21:9 store/featured cover */
  cover: string;
  /** 9:21 loading/splash screen */
  splash: string;
}

export interface GameConfig {
  name: string;
  description: string;
  assets: GameAssets;
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
  /**
   * Called after every handleAction. When this returns true, the platform
   * immediately sends game:result, unloads the renderer, and shows the
   * platform settlement screen.
   *
   * If your game has an in-game result screen (animations, rankings, etc.),
   * keep returning false during that phase and only return true when the
   * in-game result screen is done. See "Game Settlement Lifecycle" in
   * GAME_DEV_GUIDE.md.
   */
  isGameOver(state: GameState): boolean;
  getResult(state: GameState): GameResult;
  getPlayerView(state: GameState, playerId: string): Partial<GameState>;
}

export interface GameRendererProps {
  platform: Platform;
  state: Partial<GameState>;
}
