export interface Player {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  isHost: boolean;
}

export interface GameAction {
  type: string;
  payload?: Record<string, unknown>;
}

export interface GameResult {
  rankings: {
    playerId: string;
    rank: number;
    score: number;
    isWinner: boolean;
  }[];
  data?: Record<string, unknown>;
}

export interface Platform {
  getPlayers(): Player[];
  getLocalPlayer(): Player;
  send(action: GameAction): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
  reportResult(result: GameResult): void;
  /**
   * 获取游戏资产的运行时 URL。
   * @param path - 相对于游戏 assets/ 目录的路径，如 "cards/king.png"、"sounds/flip.mp3"
   * @returns 可直接用于 <img src> / <audio src> / fetch() 的完整 URL
   */
  getAssetUrl(path: string): string;
}
