// examples/number-guess/src/renderer.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import type { GameRendererProps } from "@littlepartytime/sdk";

interface ViewData {
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
  secretNumber?: number; // revealed on game end
}

interface PlayerInfo {
  id: string;
  nickname?: string;
}

export default function NumberGuessRenderer({
  platform,
  state: initialState,
}: GameRendererProps) {
  const me = platform.getLocalPlayer();
  const players = platform.getPlayers();
  const [gameState, setGameState] =
    useState<GameRendererProps["state"]>(initialState);
  const [inputValue, setInputValue] = useState("");
  const [justGuessed, setJustGuessed] = useState(false);

  // Sync state from props (handles reconnect where props update but useState ignores them)
  useEffect(() => {
    if (initialState && initialState.phase !== "loading") {
      setGameState(initialState);
    }
  }, [initialState]);

  useEffect(() => {
    const handler = (...args: unknown[]) => {
      setGameState(args[0] as GameRendererProps["state"]);
      setJustGuessed(false);
    };
    platform.on("stateUpdate", handler);
    return () => platform.off("stateUpdate", handler);
  }, [platform]);

  const data = (gameState?.data ?? {}) as unknown as ViewData;
  const playerList = (gameState?.players ?? []) as PlayerInfo[];
  const currentPlayer = playerList[data.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === me.id;
  const isEnded = gameState?.phase === "ended";

  const findName = (id: string) =>
    players.find((p) => p.id === id)?.nickname ?? id;

  const handleGuess = useCallback(() => {
    const num = parseInt(inputValue, 10);
    if (isNaN(num) || num < data.low || num > data.high) return;
    platform.send({ type: "GUESS", payload: { number: num } });
    setInputValue("");
    setJustGuessed(true);
  }, [inputValue, data.low, data.high, platform]);

  // ---- Game Over Screen ----
  if (isEnded) {
    const loserName = data.loserId ? findName(data.loserId) : "???";
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 px-4">
        <div className="text-5xl">&#127942;</div>
        <p className="font-display text-2xl font-bold text-accent">
          游戏结束
        </p>
        <div className="card-felt rounded-2xl border border-border-default p-5 text-center w-full max-w-xs">
          <p className="text-text-secondary text-sm mb-2">
            秘密数字是
          </p>
          <p className="text-4xl font-bold font-mono text-accent mb-3">
            {data.secretNumber}
          </p>
          <p className="text-text-secondary text-sm">
            <span className="text-error font-semibold">{loserName}</span>{" "}
            猜中了数字，被淘汰！
          </p>
        </div>
        <div className="w-full max-w-xs space-y-2 mt-2">
          <p className="text-xs text-text-tertiary text-center tracking-wider uppercase">
            结果
          </p>
          {playerList.map((p) => (
            <div
              key={p.id}
              className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${
                p.id === data.loserId
                  ? "border-error/30 bg-error/5"
                  : "border-accent/30 bg-accent/5"
              }`}
            >
              <span className="text-sm text-text-primary">
                {findName(p.id)}
                {p.id === me.id && (
                  <span className="text-text-tertiary ml-1">(我)</span>
                )}
              </span>
              <span
                className={`text-xs font-semibold ${
                  p.id === data.loserId ? "text-error" : "text-accent"
                }`}
              >
                {p.id === data.loserId ? "淘汰" : "存活"}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---- Playing Screen ----
  return (
    <div className="flex flex-col items-center gap-5 pt-6 px-4 pb-8">
      {/* Range display */}
      <div className="text-center">
        <p className="text-xs text-text-tertiary tracking-wider uppercase mb-2">
          猜数范围
        </p>
        <div className="flex items-center gap-3">
          <span className="text-3xl font-bold font-mono text-text-primary">
            {data.low}
          </span>
          <span className="text-text-tertiary">~</span>
          <span className="text-3xl font-bold font-mono text-text-primary">
            {data.high}
          </span>
        </div>
      </div>

      {/* Last guess hint */}
      {data.lastGuess && (
        <div className="card-felt rounded-xl border border-border-default px-4 py-3 text-center w-full max-w-xs">
          <p className="text-sm text-text-secondary">
            <span className="text-text-primary font-semibold">
              {data.lastGuess.playerName || findName(data.lastGuess.playerId)}
            </span>{" "}
            猜了{" "}
            <span className="font-mono font-bold text-accent">
              {data.lastGuess.guess}
            </span>{" "}
            —{" "}
            <span
              className={
                data.lastGuess.hint === "high"
                  ? "text-error"
                  : "text-success"
              }
            >
              {data.lastGuess.hint === "high" ? "太大了 ↓" : "太小了 ↑"}
            </span>
          </p>
        </div>
      )}

      {/* Player turn indicator */}
      <div className="w-full max-w-xs">
        <div className="flex items-center gap-2 justify-center py-2">
          {isMyTurn ? (
            <p className="text-accent font-semibold text-sm animate-pulse">
              轮到你猜了！
            </p>
          ) : (
            <p className="text-text-tertiary text-sm">
              等待{" "}
              <span className="text-text-primary font-medium">
                {findName(currentPlayer?.id ?? "")}
              </span>{" "}
              猜数...
            </p>
          )}
        </div>
      </div>

      {/* Input area */}
      {isMyTurn && !justGuessed && (
        <div className="flex gap-2 w-full max-w-xs animate-fade-in-up">
          <input
            type="number"
            inputMode="numeric"
            value={inputValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
            min={data.low}
            max={data.high}
            placeholder={`${data.low} ~ ${data.high}`}
            className="flex-1 h-12 px-4 rounded-xl bg-bg-secondary border border-border-default text-text-primary text-center text-lg font-mono transition-all duration-200"
            onKeyDown={(e) => e.key === "Enter" && handleGuess()}
            autoFocus
          />
          <button
            onClick={handleGuess}
            disabled={
              !inputValue ||
              parseInt(inputValue) < data.low ||
              parseInt(inputValue) > data.high
            }
            className="btn-press h-12 px-5 rounded-xl bg-accent text-text-on-accent font-semibold transition-all disabled:opacity-40"
          >
            猜！
          </button>
        </div>
      )}

      {justGuessed && (
        <p className="text-text-tertiary text-sm animate-pulse">
          提交中...
        </p>
      )}

      {/* Player list */}
      <div className="w-full max-w-xs mt-2">
        <p className="text-xs text-text-tertiary tracking-wider uppercase mb-2">
          玩家
        </p>
        <div className="space-y-1.5">
          {playerList.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                i === data.currentPlayerIndex
                  ? "bg-accent/10 border border-accent/20"
                  : "bg-bg-secondary/50"
              }`}
            >
              <span className="text-sm text-text-primary">
                {findName(p.id)}
                {p.id === me.id && (
                  <span className="text-text-tertiary ml-1">(我)</span>
                )}
              </span>
              {i === data.currentPlayerIndex && (
                <span className="text-[10px] text-accent font-medium">
                  当前
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
