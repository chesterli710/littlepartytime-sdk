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
}
