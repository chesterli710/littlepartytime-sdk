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

/** Injected <style> for animations and pseudo-classes that can't be expressed as inline styles */
const GameStyles = () => (
  <style>{`
    @keyframes lpt-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    @keyframes lpt-fade-in-up {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .lpt-pulse { animation: lpt-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    .lpt-fade-in-up { animation: lpt-fade-in-up 0.3s ease-out; }
    .lpt-card-felt { background: var(--bg-secondary); }
    .lpt-btn:disabled { opacity: 0.4; }
    .lpt-input:focus { outline: none; border-color: var(--accent-primary); }
  `}</style>
);

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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 20, padding: "0 16px" }}>
        <GameStyles />
        <div style={{ fontSize: 48 }}>&#127942;</div>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--accent-primary)" }}>
          游戏结束
        </p>
        <div className="lpt-card-felt" style={{ borderRadius: 16, border: "1px solid var(--border-default)", padding: 20, textAlign: "center", width: "100%", maxWidth: 320 }}>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 8 }}>
            秘密数字是
          </p>
          <p style={{ fontSize: 36, fontWeight: 700, fontFamily: "monospace", color: "var(--accent-primary)", marginBottom: 12 }}>
            {data.secretNumber}
          </p>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            <span style={{ color: "var(--error)", fontWeight: 600 }}>{loserName}</span>{" "}
            猜中了数字，被淘汰！
          </p>
        </div>
        <div style={{ width: "100%", maxWidth: 320, marginTop: 8 }}>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            结果
          </p>
          <div style={{ marginTop: 8 }}>
            {playerList.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 16px",
                  borderRadius: 12,
                  border: `1px solid ${p.id === data.loserId ? "rgba(var(--error-rgb, 239, 68, 68), 0.3)" : "rgba(var(--accent-rgb, 245, 158, 11), 0.3)"}`,
                  background: p.id === data.loserId ? "rgba(var(--error-rgb, 239, 68, 68), 0.05)" : "rgba(var(--accent-rgb, 245, 158, 11), 0.05)",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 14, color: "var(--text-primary)" }}>
                  {findName(p.id)}
                  {p.id === me.id && (
                    <span style={{ color: "var(--text-tertiary)", marginLeft: 4 }}>(我)</span>
                  )}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: p.id === data.loserId ? "var(--error)" : "var(--accent-primary)",
                  }}
                >
                  {p.id === data.loserId ? "淘汰" : "存活"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---- Playing Screen ----
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, paddingTop: 24, paddingLeft: 16, paddingRight: 16, paddingBottom: 32 }}>
      <GameStyles />
      {/* Range display */}
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "var(--text-tertiary)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
          猜数范围
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 30, fontWeight: 700, fontFamily: "monospace", color: "var(--text-primary)" }}>
            {data.low}
          </span>
          <span style={{ color: "var(--text-tertiary)" }}>~</span>
          <span style={{ fontSize: 30, fontWeight: 700, fontFamily: "monospace", color: "var(--text-primary)" }}>
            {data.high}
          </span>
        </div>
      </div>

      {/* Last guess hint */}
      {data.lastGuess && (
        <div className="lpt-card-felt" style={{ borderRadius: 12, border: "1px solid var(--border-default)", padding: "12px 16px", textAlign: "center", width: "100%", maxWidth: 320 }}>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
              {data.lastGuess.playerName || findName(data.lastGuess.playerId)}
            </span>{" "}
            猜了{" "}
            <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--accent-primary)" }}>
              {data.lastGuess.guess}
            </span>{" "}
            —{" "}
            <span
              style={{
                color: data.lastGuess.hint === "high" ? "var(--error)" : "var(--success)",
              }}
            >
              {data.lastGuess.hint === "high" ? "太大了 ↓" : "太小了 ↑"}
            </span>
          </p>
        </div>
      )}

      {/* Player turn indicator */}
      <div style={{ width: "100%", maxWidth: 320 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", padding: "8px 0" }}>
          {isMyTurn ? (
            <p className="lpt-pulse" style={{ color: "var(--accent-primary)", fontWeight: 600, fontSize: 14 }}>
              轮到你猜了！
            </p>
          ) : (
            <p style={{ color: "var(--text-tertiary)", fontSize: 14 }}>
              等待{" "}
              <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                {findName(currentPlayer?.id ?? "")}
              </span>{" "}
              猜数...
            </p>
          )}
        </div>
      </div>

      {/* Input area */}
      {isMyTurn && !justGuessed && (
        <div className="lpt-fade-in-up" style={{ display: "flex", gap: 8, width: "100%", maxWidth: 320 }}>
          <input
            type="number"
            inputMode="numeric"
            value={inputValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
            min={data.low}
            max={data.high}
            placeholder={`${data.low} ~ ${data.high}`}
            className="lpt-input"
            style={{
              flex: 1,
              height: 48,
              padding: "0 16px",
              borderRadius: 12,
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-default)",
              color: "var(--text-primary)",
              textAlign: "center",
              fontSize: 18,
              fontFamily: "monospace",
              transition: "all 0.2s",
            }}
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
            className="lpt-btn"
            style={{
              height: 48,
              padding: "0 20px",
              borderRadius: 12,
              background: "var(--accent-primary)",
              color: "var(--text-on-accent, #fff)",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            猜！
          </button>
        </div>
      )}

      {justGuessed && (
        <p className="lpt-pulse" style={{ color: "var(--text-tertiary)", fontSize: 14 }}>
          提交中...
        </p>
      )}

      {/* Player list */}
      <div style={{ width: "100%", maxWidth: 320, marginTop: 8 }}>
        <p style={{ fontSize: 12, color: "var(--text-tertiary)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 8 }}>
          玩家
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {playerList.map((p, i) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                borderRadius: 8,
                transition: "background 0.2s",
                ...(i === data.currentPlayerIndex
                  ? { background: "rgba(var(--accent-rgb, 245, 158, 11), 0.1)", border: "1px solid rgba(var(--accent-rgb, 245, 158, 11), 0.2)" }
                  : { background: "rgba(var(--bg-secondary-rgb, 39, 39, 42), 0.5)", border: "1px solid transparent" }),
              }}
            >
              <span style={{ fontSize: 14, color: "var(--text-primary)" }}>
                {findName(p.id)}
                {p.id === me.id && (
                  <span style={{ color: "var(--text-tertiary)", marginLeft: 4 }}>(我)</span>
                )}
              </span>
              {i === data.currentPlayerIndex && (
                <span style={{ fontSize: 10, color: "var(--accent-primary)", fontWeight: 500 }}>
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
