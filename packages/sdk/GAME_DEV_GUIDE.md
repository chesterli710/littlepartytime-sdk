# Little Party Time SDK - Game Development Guide

This guide defines the specification for developing games on the Little Party Time platform. Follow this guide precisely to create a compatible game package.

## Overview

A game consists of two parts:
1. **Engine** (server-side): Pure logic, no UI. Manages game state, validates actions, determines winners.
2. **Renderer** (client-side): React component that displays the game UI and sends player actions.

Both parts communicate through the platform via well-defined interfaces.

## Project Structure

Each game is a standalone project:

```
my-game/
├── package.json
├── lpt.config.ts          # Project configuration (gameId, etc.)
├── vite.config.ts         # Build configuration
├── vitest.config.ts       # Test configuration
├── tsconfig.json
├── src/
│   ├── config.ts          # GameConfig - metadata
│   ├── engine.ts          # GameEngine - server-side logic
│   ├── renderer.tsx       # GameRenderer - client-side React component
│   ├── types.ts           # Game-specific types (actions, state shape)
│   └── index.ts           # Re-exports config, engine, renderer
├── tests/
│   ├── engine.test.ts     # Engine unit tests
│   └── e2e.e2e.test.ts    # Playwright E2E tests (optional)
└── dist/                  # Build output (generated)
    ├── bundle.js          # Client-side bundle
    ├── engine.cjs         # Server-side engine
    └── <gameId>.zip       # Upload package
```

## Quick Start

```bash
# Create a new game project
npx create-littlepartytime-game my-awesome-game
cd my-awesome-game

# Install dependencies
npm install

# Run tests
npm test

# Build and package for upload
npm run pack
```

## Step-by-Step Implementation

### Step 1: Define Game Config

```typescript
// src/config.ts
import type { GameConfig } from "@littlepartytime/sdk";

const config: GameConfig = {
  id: "my-game",             // Unique identifier, lowercase kebab-case
  name: "My Game",           // Display name (Chinese preferred for CN users)
  description: "...",        // Brief description
  coverImage: "/games/my-game/cover.png",
  minPlayers: 2,
  maxPlayers: 6,
  tags: ["strategy", "card"],
  version: "1.0.0",
  sdkVersion: "1.0.0",
};

export default config;
```

### Step 2: Define Game-Specific Types

```typescript
// src/types.ts
import type { GameAction, GameState } from "@littlepartytime/sdk";

// Define all possible actions your game supports
export type MyGameAction =
  | { type: "PLAY_CARD"; payload: { cardId: string } }
  | { type: "DRAW_CARD" }
  | { type: "PASS" };

// Define the shape of your game's data field in GameState
export interface MyGameData {
  deck: Card[];
  currentPlayerIndex: number;
  direction: 1 | -1;
  // ... game-specific fields
}

// GameState.data will be typed as Record<string, unknown> at the SDK level.
// Cast it in your engine: const data = state.data as MyGameData;
```

### Step 3: Implement Game Engine

The engine is the core of your game. It MUST be a pure, deterministic state machine.

```typescript
// src/engine.ts
import type { GameEngine, GameState, Player, GameAction, GameResult } from "@littlepartytime/sdk";

const engine: GameEngine = {
  /**
   * Initialize game state for the given players.
   * Called once when the host starts the game.
   *
   * @param players - Array of players in the game (from room's online members)
   * @param options - Optional game settings (e.g., difficulty, variant rules)
   * @returns Initial GameState
   */
  init(players: Player[], options?: Record<string, unknown>): GameState {
    return {
      phase: "playing",        // Use meaningful phase names: "playing", "voting", "scoring", etc.
      players: players.map(p => ({
        id: p.id,
        // Add per-player state here (hand, score, etc.)
      })),
      data: {
        // Global game state (deck, board, current turn, etc.)
      },
    };
  },

  /**
   * Process a player action and return the new state.
   * This is the main game logic function.
   *
   * IMPORTANT:
   * - MUST be pure: do not mutate the input state, return a new object.
   * - MUST validate the action: check if it's the player's turn, if the action is legal, etc.
   * - If the action is invalid, return the state unchanged (or throw an error).
   *
   * @param state - Current game state
   * @param playerId - ID of the player performing the action
   * @param action - The action being performed
   * @returns New GameState after applying the action
   */
  handleAction(state: GameState, playerId: string, action: GameAction): GameState {
    // 1. Validate it's this player's turn
    // 2. Validate the action is legal
    // 3. Apply the action and return new state
    // 4. Advance to next player or next phase as needed
    return { ...state };
  },

  /**
   * Check if the game has ended.
   * Called after every handleAction.
   *
   * @param state - Current game state
   * @returns true if the game is over
   */
  isGameOver(state: GameState): boolean {
    return state.phase === "ended";
  },

  /**
   * Compute final results/rankings.
   * Called only when isGameOver returns true.
   *
   * @param state - Final game state
   * @returns GameResult with player rankings
   */
  getResult(state: GameState): GameResult {
    return {
      rankings: state.players.map((p, i) => ({
        playerId: p.id,
        rank: i + 1,
        score: 0,
        isWinner: i === 0,
      })),
    };
  },

  /**
   * Filter the state to show only what a specific player should see.
   * This is critical for games with hidden information (e.g., cards in hand).
   *
   * For games with no hidden info, you can return the full state.
   * For games with hidden info:
   * - Hide other players' hands
   * - Hide the deck contents
   * - Only reveal public information
   *
   * @param state - Full game state
   * @param playerId - The player requesting their view
   * @returns Filtered state visible to this player
   */
  getPlayerView(state: GameState, playerId: string): Partial<GameState> {
    return state; // Override for hidden information games
  },
};

export default engine;
```

### Step 4: Implement Game Renderer

The renderer is a React component that receives the platform API and the player's visible state.

```tsx
// src/renderer.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import type { GameRendererProps, GameAction } from "@littlepartytime/sdk";

export default function GameRenderer({ platform, state }: GameRendererProps) {
  // Access player info
  const me = platform.getLocalPlayer();
  const players = platform.getPlayers();

  // Listen for state updates from the server
  const [gameState, setGameState] = useState(state);

  useEffect(() => {
    const handleStateUpdate = (newState: typeof state) => {
      setGameState(newState);
    };
    platform.on("stateUpdate", handleStateUpdate);
    return () => platform.off("stateUpdate", handleStateUpdate);
  }, [platform]);

  // Send actions to the server
  const sendAction = useCallback(
    (action: GameAction) => {
      platform.send(action);
    },
    [platform]
  );

  // Render game UI
  return (
    <div>
      {/* Your game UI here */}
      {/* Use Tailwind CSS classes - the platform provides Tailwind */}
      {/* Use the design tokens from the platform: bg-bg-primary, text-accent, etc. */}
    </div>
  );
}
```

### Step 5: Create Index File

```typescript
// src/index.ts
export { default as config } from "./config";
export { default as engine } from "./engine";
export { default as GameRenderer } from "./renderer";
```

## Testing Your Game

The SDK provides testing utilities to help you write tests for your game engine.

### Using createMockPlayers

Generate test players quickly:

```typescript
import { createMockPlayers } from '@littlepartytime/sdk/testing';

// Create 3 players with default IDs (player-1, player-2, player-3)
const players = createMockPlayers(3);

// The first player is the host by default
console.log(players[0].isHost); // true

// Override specific player properties
const customPlayers = createMockPlayers(2, [
  { nickname: 'Alice' },
  { nickname: 'Bob', isHost: true }
]);
```

### Using GameTester for Unit Tests

`GameTester` provides a simple wrapper for testing individual engine methods:

```typescript
import { describe, it, expect } from 'vitest';
import { GameTester, createMockPlayers } from '@littlepartytime/sdk/testing';
import engine from '../src/engine';

describe('My Game Engine', () => {
  it('should initialize with correct phase', () => {
    const tester = new GameTester(engine);
    tester.init(createMockPlayers(3));

    expect(tester.phase).toBe('playing');
    expect(tester.playerStates).toHaveLength(3);
  });

  it('should handle valid actions', () => {
    const tester = new GameTester(engine);
    const players = createMockPlayers(2);
    tester.init(players);

    // Perform an action
    tester.act(players[0].id, { type: 'PLAY_CARD', payload: { cardId: '1' } });

    // Assert state changes
    expect(tester.state.data.cardsPlayed).toContain('1');
  });

  it('should reject invalid actions', () => {
    const tester = new GameTester(engine);
    const players = createMockPlayers(2);
    tester.init(players);

    const before = tester.state;
    // Wrong player tries to act
    tester.act(players[1].id, { type: 'PLAY_CARD', payload: { cardId: '1' } });

    // State should be unchanged
    expect(tester.state).toBe(before);
  });

  it('should filter player views correctly', () => {
    const tester = new GameTester(engine);
    const players = createMockPlayers(2);
    tester.init(players);

    const view = tester.getPlayerView(players[0].id);
    expect(view.data).not.toHaveProperty('secretInfo');
  });
});
```

### Using GameSimulator for E2E Tests

`GameSimulator` helps you simulate complete game sessions:

```typescript
import { describe, it, expect } from 'vitest';
import { GameSimulator } from '@littlepartytime/sdk/testing';
import engine from '../src/engine';

describe('My Game E2E', () => {
  it('should play a complete game', () => {
    const sim = new GameSimulator(engine, { playerCount: 3 });
    sim.start();

    // Simulate game actions using player indices (0, 1, 2)
    sim.act(0, { type: 'PLAY_CARD', payload: { cardId: '1' } });
    sim.act(1, { type: 'DRAW_CARD' });
    sim.act(2, { type: 'PASS' });

    // Continue until game ends
    while (!sim.isGameOver()) {
      const turn = sim.currentTurn;
      sim.act(turn, { type: 'PASS' });
    }

    // Verify results
    expect(sim.isGameOver()).toBe(true);
    const result = sim.getResult();
    expect(result.rankings).toHaveLength(3);

    // Access the action log for debugging
    console.log(`Game finished in ${sim.actionLog.length} actions`);
  });

  it('should provide correct player views', () => {
    const sim = new GameSimulator(engine, { playerCount: 2 });
    sim.start();

    // Each player sees only their own view
    const view0 = sim.getView(0);
    const view1 = sim.getView(1);

    expect(view0).not.toEqual(view1);
  });
});
```

## Local Development Server

The dev-kit provides a local development server for previewing and testing your game without uploading to the platform.

### Starting the Dev Server

```bash
# From your game project directory
npm run dev
# or directly:
npx lpt-dev-kit dev
```

This starts two servers and provides three pages:

```
Preview:      http://localhost:4000/preview    # Single-player preview with engine
Multiplayer:  http://localhost:4000/play       # Multi-player via Socket.IO
Debug Panel:  http://localhost:4000/debug      # Real-time state inspection
```

### Preview Page (Single-Player)

The Preview page runs your **engine locally in the browser** — no network needed.

Features:
- **Engine integration**: `platform.send()` calls `engine.handleAction()` locally, computes `getPlayerView()`, and triggers `stateUpdate` events automatically
- **Player switching**: Switch between players (2-8) via a dropdown to see each player's filtered view
- **State editor**: View and override the full game state as JSON for debugging
- **Action log**: See all actions sent by players in real-time
- **Game over detection**: Automatically detects when `isGameOver()` returns true and displays results
- **Reset**: Re-initialize the game at any time

This enables a rapid development cycle: **edit code -> refresh browser -> test immediately**.

### Multiplayer Page

The Play page runs your game with real Socket.IO multiplayer:
1. Open multiple browser tabs/windows to `http://localhost:4000/play`
2. Each tab enters a different nickname and joins the lobby
3. All players click "Ready", then the host starts the game
4. Actions flow through Socket.IO to the engine running on the dev server

### Debug Page

The Debug page shows the raw room state and full (unfiltered) game state in real-time. Useful for inspecting hidden information during development.

## Playwright E2E Testing

For automated UI testing, the dev-kit provides a `GamePreview` class that orchestrates the dev server and Playwright browser.

### Setup

```bash
# Install playwright as a dev dependency
npm install -D playwright
```

### Writing E2E Tests

Create a test file (e.g., `tests/e2e.e2e.test.ts`):

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GamePreview } from '@littlepartytime/dev-kit/testing';
import path from 'path';

describe('My Game E2E', () => {
  let preview: GamePreview;

  beforeAll(async () => {
    preview = new GamePreview({
      projectDir: path.resolve(__dirname, '..'),
      playerCount: 3,
      headless: true,
      port: 4100,        // Use non-default ports to avoid conflicts
      socketPort: 4101,
    });
    await preview.start();
  }, 30000); // Allow time for server startup and browser launch

  afterAll(async () => {
    await preview.stop();
  }, 10000);

  it('should show lobby with all players', async () => {
    const page = preview.getPlayerPage(0);
    await expect(page.locator('text=Alice')).toBeVisible();
    await expect(page.locator('text=Bob')).toBeVisible();
    await expect(page.locator('text=Carol')).toBeVisible();
  });

  it('should play through a complete game', async () => {
    // All players click "Ready"
    await preview.readyAll();

    // Host starts the game
    await preview.startGame();

    // Interact with the game UI via Playwright
    const hostPage = preview.getPlayerPage(0);
    const player2Page = preview.getPlayerPage(1);

    // Use standard Playwright assertions
    await expect(hostPage.locator('.game-board')).toBeVisible({ timeout: 5000 });

    // Send actions by interacting with the UI
    await hostPage.click('button:has-text("Play")');

    // Assert state changes on other players' screens
    await expect(player2Page.locator('text=waiting')).toBeVisible();
  });
});
```

### GamePreview API

```typescript
import { GamePreview } from '@littlepartytime/dev-kit/testing';

const preview = new GamePreview({
  projectDir: string;             // Absolute path to game project
  playerCount: number;            // Number of players (2-8)
  port?: number;                  // Vite server port (default: 4100)
  socketPort?: number;            // Socket.IO port (default: 4101)
  headless?: boolean;             // Headless browser (default: true)
  browserType?: 'chromium' | 'firefox' | 'webkit';  // default: 'chromium'
});

await preview.start();                    // Start server + browser, join all players
const page = preview.getPlayerPage(0);    // Get Playwright Page for player (0 = host)
const pages = preview.getPlayerPages();   // Get all Page objects
await preview.readyAll();                 // Click "Ready" for all players
await preview.startGame();                // Host clicks "Start Game"
await preview.stop();                     // Clean up browser + server
```

### Excluding E2E Tests from Unit Test Runs

E2E tests are slower and require playwright. Exclude them from the default `vitest run`:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/**/*.e2e.test.ts"],
  },
});
```

Run E2E tests separately:

```bash
npx vitest run tests/e2e.e2e.test.ts
```

## Building and Packaging

### The pack Command

Use `lpt-dev-kit pack` (or `npm run pack`) to build and package your game:

```bash
# From your game project directory
npm run pack
```

This command:
1. Runs `vite build` to compile your game
2. Validates the build output (checks for bundle.js and engine.cjs)
3. Creates a `.zip` file in the `dist/` directory

### Build Output

After running `pack`, your `dist/` folder will contain:

```
dist/
├── bundle.js      # Client-side bundle (React component + dependencies)
├── engine.cjs     # Server-side engine (CommonJS for Node.js)
└── <gameId>.zip   # Upload package containing both files
```

### Configuration

The `lpt.config.ts` file configures the build:

```typescript
// lpt.config.ts
export default {
  gameId: 'my-awesome-game',  // Used for the zip filename
};
```

### Submitting Your Game

1. Run `npm run pack` to build and package
2. Navigate to the Little Party Time admin panel
3. Upload the generated `.zip` file from `dist/`
4. Fill in game details and submit for review

## SDK Interfaces Reference

### Platform (injected by the platform into the renderer)

| Method | Description |
|--------|-------------|
| `getPlayers()` | Returns all players in the game |
| `getLocalPlayer()` | Returns the current user's Player object |
| `send(action)` | Sends a GameAction to the server |
| `on(event, handler)` | Listens for events from the server |
| `off(event, handler)` | Removes an event listener |
| `reportResult(result)` | Reports game results (called by platform, not games) |

### Events the renderer should listen for

| Event | Payload | Description |
|-------|---------|-------------|
| `stateUpdate` | `Partial<GameState>` | Player-specific state update after any action |

### GameState

```typescript
interface GameState {
  phase: string;              // Current game phase
  players: PlayerState[];     // Per-player state
  data: Record<string, unknown>;  // Global game data
}

interface PlayerState {
  id: string;
  [key: string]: unknown;     // Game-specific per-player data
}
```

## Rules and Constraints

### Engine Rules
1. **Pure functions**: `handleAction` must NOT mutate the input state. Always return a new object.
2. **Deterministic**: Same state + same action = same result. No `Math.random()` in `handleAction`. Use random values only in `init()` to set up the initial state (e.g., shuffle deck).
3. **Validate everything**: Never trust the action payload. Validate it's the correct player's turn, the action is legal, etc.
4. **No side effects**: No network calls, no timers, no console.log in production.
5. **Serializable state**: `GameState` must be JSON-serializable (no functions, no class instances, no Dates - use ISO strings).

### Renderer Rules
1. **React functional component**: Use hooks, not class components.
2. **Tailwind CSS only**: Use the platform's design tokens for consistent styling.
3. **Mobile-first**: Design for phone screens (375px width). The platform is a PWA.
4. **No direct socket access**: Only use `platform.send()` and `platform.on()`.
5. **Chinese UI text**: The platform targets Chinese-speaking users.
6. **Responsive touch targets**: Buttons should be at least 44x44px for mobile.

### Design Token Reference

Use these CSS variables / Tailwind classes for consistent styling:

| Purpose | CSS Variable | Tailwind Class |
|---------|-------------|----------------|
| Page background | `--bg-primary` | `bg-bg-primary` |
| Card background | `--bg-secondary` | `bg-bg-secondary` |
| Elevated surface | `--bg-tertiary` | `bg-bg-tertiary` |
| Primary accent | `--accent-primary` | `text-accent` / `bg-accent` |
| Primary text | `--text-primary` | `text-text-primary` |
| Secondary text | `--text-secondary` | `text-text-secondary` |
| Muted text | `--text-tertiary` | `text-text-tertiary` |
| Border | `--border-default` | `border-border-default` |
| Success | `--success` | `text-success` |
| Error | `--error` | `text-error` |
| Display font | `--font-display` | `font-display` |
| Body font | `--font-body` | `font-body` |

## Data Flow Diagram

```
Player taps button
      │
      ▼
Renderer calls platform.send({ type: "PLAY_CARD", payload: { cardId: "3" } })
      │
      ▼
Platform sends action via Socket.IO to server
      │
      ▼
Server:
  1. Loads engine for this game
  2. Gets current GameState
  3. Calls engine.handleAction(state, playerId, action) → newState
  4. Saves newState
  5. For each player: engine.getPlayerView(newState, playerId) → playerView
  6. Emits "stateUpdate" to each player's socket with their view
  7. If engine.isGameOver(newState): triggers handleGameEnd
      │
      ▼
Renderer receives "stateUpdate" event with filtered state
      │
      ▼
React re-renders with new state
```

## Complete Example: Number Guessing Game

See the [`examples/number-guess`](../../examples/number-guess) directory for a complete working example.

### config.ts
```typescript
import type { GameConfig } from "@littlepartytime/sdk";

const config: GameConfig = {
  id: "number-guess",
  name: "Guess the Number",
  description: "Take turns guessing a secret number between 1-100. The range narrows with each guess!",
  coverImage: "/games/number-guess/cover.png",
  minPlayers: 2,
  maxPlayers: 8,
  tags: ["casual", "party"],
  version: "1.0.0",
  sdkVersion: "1.0.0",
};

export default config;
```

### types.ts
```typescript
export interface GuessGameData {
  secretNumber: number;
  low: number;
  high: number;
  currentPlayerIndex: number;
  lastGuess: { playerId: string; guess: number; hint: "high" | "low" } | null;
  loserId: string | null;
}

export type GuessAction = { type: "GUESS"; payload: { number: number } };
```

### engine.ts
```typescript
import type { GameEngine, GameState, Player, GameAction, GameResult } from "@littlepartytime/sdk";
import type { GuessGameData } from "./types";

const engine: GameEngine = {
  init(players: Player[]): GameState {
    const secretNumber = Math.floor(Math.random() * 100) + 1;
    return {
      phase: "playing",
      players: players.map(p => ({ id: p.id, nickname: p.nickname })),
      data: {
        secretNumber,
        low: 1,
        high: 100,
        currentPlayerIndex: 0,
        lastGuess: null,
        loserId: null,
      } satisfies GuessGameData as unknown as Record<string, unknown>,
    };
  },

  handleAction(state: GameState, playerId: string, action: GameAction): GameState {
    if (action.type !== "GUESS") return state;
    const data = state.data as unknown as GuessGameData;

    const currentPlayer = state.players[data.currentPlayerIndex];
    if (currentPlayer.id !== playerId) return state; // Not your turn

    const guess = (action.payload as { number: number }).number;
    if (guess < data.low || guess > data.high) return state; // Out of range

    if (guess === data.secretNumber) {
      return {
        ...state,
        phase: "ended",
        data: {
          ...data,
          loserId: playerId,
          lastGuess: { playerId, guess, hint: "low" },
        } as unknown as Record<string, unknown>,
      };
    }

    const hint = guess > data.secretNumber ? "high" : "low";
    const newLow = hint === "low" ? Math.max(data.low, guess + 1) : data.low;
    const newHigh = hint === "high" ? Math.min(data.high, guess - 1) : data.high;

    return {
      ...state,
      data: {
        ...data,
        low: newLow,
        high: newHigh,
        currentPlayerIndex: (data.currentPlayerIndex + 1) % state.players.length,
        lastGuess: { playerId, guess, hint },
      } as unknown as Record<string, unknown>,
    };
  },

  isGameOver(state: GameState): boolean {
    return state.phase === "ended";
  },

  getResult(state: GameState): GameResult {
    const data = state.data as unknown as GuessGameData;
    return {
      rankings: state.players.map(p => ({
        playerId: p.id,
        rank: p.id === data.loserId ? state.players.length : 1,
        score: p.id === data.loserId ? 0 : 1,
        isWinner: p.id !== data.loserId,
      })),
    };
  },

  getPlayerView(state: GameState, playerId: string): Partial<GameState> {
    const data = state.data as unknown as GuessGameData;
    // Hide the secret number while game is in progress
    if (state.phase !== "ended") {
      return {
        ...state,
        data: {
          low: data.low,
          high: data.high,
          currentPlayerIndex: data.currentPlayerIndex,
          lastGuess: data.lastGuess,
          loserId: data.loserId,
          // secretNumber is NOT included
        } as unknown as Record<string, unknown>,
      };
    }
    // Reveal everything after game ends
    return state;
  },
};

export default engine;
```

### Test file (tests/engine.test.ts)
```typescript
import { describe, it, expect } from 'vitest';
import { GameTester, GameSimulator, createMockPlayers } from '@littlepartytime/sdk/testing';
import engine from '../src/engine';

describe('Number Guess Engine', () => {
  describe('GameTester - unit tests', () => {
    it('should initialize with playing phase', () => {
      const tester = new GameTester(engine);
      tester.init(createMockPlayers(3));
      expect(tester.phase).toBe('playing');
      expect(tester.playerStates).toHaveLength(3);
    });

    it('should hide secretNumber in player view', () => {
      const tester = new GameTester(engine);
      const players = createMockPlayers(2);
      tester.init(players);
      const view = tester.getPlayerView(players[0].id);
      expect(view.data).not.toHaveProperty('secretNumber');
    });

    it('should reject out-of-turn actions', () => {
      const tester = new GameTester(engine);
      const players = createMockPlayers(2);
      tester.init(players);
      const before = tester.state;
      tester.act(players[1].id, { type: 'GUESS', payload: { number: 50 } });
      expect(tester.state).toBe(before);
    });
  });

  describe('GameSimulator - E2E', () => {
    it('should play a complete game', () => {
      const sim = new GameSimulator(engine, { playerCount: 3 });
      sim.start();

      // Binary search to end the game quickly
      let lo = 1, hi = 100;
      while (!sim.isGameOver()) {
        const mid = Math.floor((lo + hi) / 2);
        sim.act(sim.currentTurn, { type: 'GUESS', payload: { number: mid } });
        if (!sim.isGameOver()) {
          const data = sim.state.data as { low: number; high: number };
          lo = data.low;
          hi = data.high;
        }
      }

      expect(sim.isGameOver()).toBe(true);
      const result = sim.getResult();
      expect(result.rankings).toHaveLength(3);
    });
  });
});
```
