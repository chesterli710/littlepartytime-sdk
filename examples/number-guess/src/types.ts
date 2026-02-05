// examples/number-guess/src/types.ts

export interface GuessGameData {
  secretNumber: number;
  low: number;
  high: number;
  currentPlayerIndex: number;
  lastGuess: {
    playerId: string;
    playerName: string;
    guess: number;
    hint: "high" | "low";
  } | null;
  loserId: string | null;
}

export type GuessAction = { type: "GUESS"; payload: { number: number } };
