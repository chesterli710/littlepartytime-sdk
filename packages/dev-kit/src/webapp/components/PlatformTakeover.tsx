import React from 'react';

interface Ranking {
  playerId: string;
  rank: number;
  score: number;
  isWinner: boolean;
}

interface GameResult {
  rankings: Ranking[];
  data?: Record<string, unknown>;
}

interface Player {
  id: string;
  nickname: string;
}

interface Props {
  result: GameResult;
  players: Player[];
  onReturn: () => void;
}

const MEDAL = ['🥇', '🥈', '🥉'];

export default function PlatformTakeover({ result, players, onReturn }: Props) {
  const getName = (playerId: string) =>
    players.find((p) => p.id === playerId)?.nickname ?? playerId;

  const sorted = [...result.rankings].sort((a, b) => a.rank - b.rank);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(180deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-body, system-ui, sans-serif)',
        color: '#e2e8f0',
        overflow: 'hidden',
      }}
    >
      {/* Dev-Kit banner */}
      <div
        style={{
          background: 'rgba(217, 119, 6, 0.15)',
          borderBottom: '1px solid rgba(217, 119, 6, 0.3)',
          padding: '6px 12px',
          fontSize: 11,
          color: '#fbbf24',
          textAlign: 'center',
          flexShrink: 0,
        }}
      >
        ⚙ Dev-Kit · Platform Takeover
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 20px',
          gap: 24,
          overflow: 'auto',
        }}
      >
        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏆</div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              fontFamily: 'var(--font-display, var(--font-body, system-ui, sans-serif))',
            }}
          >
            Game Over
          </div>
        </div>

        {/* Rankings */}
        <div
          style={{
            width: '100%',
            maxWidth: 300,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {sorted.map((r) => (
            <div
              key={r.playerId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 8,
                background: r.isWinner
                  ? 'rgba(250, 204, 21, 0.12)'
                  : 'rgba(255, 255, 255, 0.05)',
                border: r.isWinner
                  ? '1px solid rgba(250, 204, 21, 0.25)'
                  : '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              {/* Rank */}
              <span style={{ fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 }}>
                {MEDAL[r.rank - 1] ?? `#${r.rank}`}
              </span>

              {/* Name */}
              <span
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontWeight: r.isWinner ? 600 : 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {getName(r.playerId)}
              </span>

              {/* Score */}
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: r.isWinner ? '#facc15' : '#94a3b8',
                  fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0,
                }}
              >
                {r.score}
              </span>
            </div>
          ))}
        </div>

        {/* Return button */}
        <button
          onClick={onReturn}
          style={{
            marginTop: 8,
            padding: '10px 32px',
            borderRadius: 8,
            border: 'none',
            background: '#d97706',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Return to Lobby
        </button>
      </div>
    </div>
  );
}
