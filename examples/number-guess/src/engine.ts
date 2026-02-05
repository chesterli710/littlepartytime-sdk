// examples/number-guess/src/engine.ts
import type {
  GameEngine,
  GameState,
  Player,
  GameAction,
  GameResult,
} from "@littlepartytime/sdk";
import type { GuessGameData } from "./types";

function asData(state: GameState): GuessGameData {
  return state.data as unknown as GuessGameData;
}

function withData(state: GameState, data: GuessGameData): GameState {
  return { ...state, data: data as unknown as Record<string, unknown> };
}

const engine: GameEngine = {
  init(players: Player[]): GameState {
    const secretNumber = Math.floor(Math.random() * 100) + 1;
    const data: GuessGameData = {
      secretNumber,
      low: 1,
      high: 100,
      currentPlayerIndex: 0,
      lastGuess: null,
      loserId: null,
    };
    return {
      phase: "playing",
      players: players.map((p) => ({ id: p.id, nickname: p.nickname })),
      data: data as unknown as Record<string, unknown>,
    };
  },

  handleAction(
    state: GameState,
    playerId: string,
    action: GameAction
  ): GameState {
    if (state.phase !== "playing") return state;
    if (action.type !== "GUESS") return state;

    const data = asData(state);
    const currentPlayer = state.players[data.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.id !== playerId) return state;

    const guess = (action.payload as { number: number })?.number;
    if (typeof guess !== "number" || !Number.isInteger(guess)) return state;
    if (guess < data.low || guess > data.high) return state;

    const playerName =
      (currentPlayer as Record<string, unknown>).nickname as string ?? "";

    // Hit the secret number — this player wins!
    if (guess === data.secretNumber) {
      return withData(
        { ...state, phase: "ended" },
        {
          ...data,
          loserId: playerId,
          lastGuess: { playerId, playerName, guess, hint: "low" },
        }
      );
    }

    // Narrow the range
    const hint: "high" | "low" =
      guess > data.secretNumber ? "high" : "low";
    const newLow = hint === "low" ? Math.max(data.low, guess + 1) : data.low;
    const newHigh =
      hint === "high" ? Math.min(data.high, guess - 1) : data.high;
    const nextIndex =
      (data.currentPlayerIndex + 1) % state.players.length;

    return withData(state, {
      ...data,
      low: newLow,
      high: newHigh,
      currentPlayerIndex: nextIndex,
      lastGuess: { playerId, playerName, guess, hint },
    });
  },

  isGameOver(state: GameState): boolean {
    return state.phase === "ended";
  },

  getResult(state: GameState): GameResult {
    const data = asData(state);
    return {
      rankings: state.players.map((p) => ({
        playerId: p.id,
        rank: p.id === data.loserId ? state.players.length : 1,
        score: p.id === data.loserId ? 0 : 1,
        isWinner: p.id !== data.loserId,
      })),
    };
  },

  getPlayerView(state: GameState, _playerId: string): Partial<GameState> {
    const data = asData(state);
    // Hide secretNumber from all players during play
    const visibleData: Record<string, unknown> = {
      low: data.low,
      high: data.high,
      currentPlayerIndex: data.currentPlayerIndex,
      lastGuess: data.lastGuess,
      loserId: data.loserId,
    };
    // Reveal secret number when game ends
    if (state.phase === "ended") {
      visibleData.secretNumber = data.secretNumber;
    }
    return {
      ...state,
      data: visibleData,
    };
  },
};

export default engine;
