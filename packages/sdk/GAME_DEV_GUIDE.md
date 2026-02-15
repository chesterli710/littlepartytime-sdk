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
├── lpt.config.ts          # Project configuration (gameId for local dev)
├── rules.md               # Game rules (Markdown, included in upload)
├── vite.config.ts         # Build configuration
├── vitest.config.ts       # Test configuration
├── tsconfig.json
├── assets/                # Game images and custom assets
│   ├── icon.png           # 1:1 (256x256+) - game list icon
│   ├── banner.png         # 16:9 (640x360+) - lobby banner
│   ├── cover.png          # 21:9 (840x360+) - store/featured cover
│   ├── splash.png         # 9:21 (360x840+) - loading screen
│   ├── cards/             # Custom game assets (optional)
│   │   ├── king.png
│   │   └── queen.png
│   └── sounds/
│       └── flip.mp3
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
  name: "My Game",           // Display name (Chinese preferred for CN users)
  description: "...",        // Brief description
  assets: {
    icon: "assets/icon.png",       // 1:1 game list icon
    banner: "assets/banner.png",   // 16:9 lobby banner
    cover: "assets/cover.png",     // 21:9 store/featured cover
    splash: "assets/splash.png",   // 9:21 loading screen
  },
  minPlayers: 2,
  maxPlayers: 6,
  tags: ["strategy", "card"],
  version: "1.0.0",
  sdkVersion: "2.0.0",
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

  // Render game UI — use inline styles + CSS variables for consistent styling
  return (
    <div style={{ color: "var(--text-primary)" }}>
      {/* Your game UI here */}
      {/* Use inline styles with CSS variables from the platform design tokens */}
      {/* See "Renderer Styling Guide" section below for details */}
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
- **Player switching**: Switch between players (2-32) via a dropdown to see each player's filtered view
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
3. Reads `GameConfig` from the built engine to extract metadata
4. Validates the required image assets (format, dimensions, aspect ratio)
5. Validates `rules.md` exists and is non-empty
6. Generates `manifest.json` from your config
7. Creates a `.zip` file in the `dist/` directory containing code, manifest, rules, and images

### Build Output

After running `pack`, your `dist/` folder will contain:

```
dist/
├── bundle.js      # Client-side bundle (React component + dependencies)
├── engine.cjs     # Server-side engine (CommonJS for Node.js)
└── <gameId>.zip   # Upload package
```

The `.zip` upload package contains:

```
<gameId>.zip
├── manifest.json  # Auto-generated metadata (from GameConfig)
├── rules.md       # Game rules
├── bundle.js      # Client-side bundle
├── engine.cjs     # Server-side engine
├── icon.png       # 1:1 game icon
├── banner.png     # 16:9 banner
├── cover.png      # 21:9 cover
├── splash.png     # 9:21 splash screen
└── assets/        # Custom game assets (if any)
    ├── cards/
    │   └── king.png
    └── sounds/
        └── flip.mp3
```

### Configuration

The `lpt.config.ts` file configures local development. The `gameId` is a local project identifier used for the zip filename and dev server — it is NOT the platform game ID (the platform assigns that upon upload):

```typescript
// lpt.config.ts
export default {
  gameId: 'my-awesome-game',  // Local project identifier (zip filename, dev server)
};
```

### Vite Configuration (Important)

Your `vite.config.ts` **must** use a single entry point with `fileName` mapping. Do NOT use multiple entry points, as Vite will extract shared code into separate chunk files that won't be included in the upload package.

**Recommended configuration:**

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),  // Single entry point
      formats: ["es", "cjs"],
      fileName: (format) => {
        if (format === "es") return "bundle.js";
        if (format === "cjs") return "engine.cjs";
        return `bundle.${format}.js`;
      },
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "@littlepartytime/sdk"],
    },
    outDir: "dist",
    emptyOutDir: true,
  },
});
```

**Why single entry?** With multiple entry points (e.g., separate `renderer.tsx` and `engine.ts`), Vite extracts shared code into chunk files like `types-D0Vb4wB4.js`. The `pack` command only includes `bundle.js` and `engine.cjs` in the upload package — extra chunks will be missing at runtime, causing 404 errors.

**The `pack` command will reject builds with extra chunk files** to prevent this issue.

### Required Game Images

Every game must include 4 images in the `assets/` directory. These are validated and packaged by the `pack` command.

| Image | Aspect Ratio | Min Size | Purpose |
|-------|-------------|----------|---------|
| `icon.png` | 1:1 | 256x256 | Game list icon |
| `banner.png` | 16:9 | 640x360 | Lobby banner |
| `cover.png` | 21:9 | 840x360 | Store/featured cover |
| `splash.png` | 9:21 | 360x840 | Loading/splash screen |

**Rules:**
- **Formats**: PNG or WebP only
- **Aspect ratio**: Must match exactly (1% tolerance)
- **Minimum dimensions**: Must meet or exceed the minimum size
- **File size**: Warning if any image exceeds 2MB
- **Paths**: Referenced in `GameConfig.assets` as relative paths from the project root

The `pack` command reads these images, validates them, and includes them in the zip with canonical names (`icon.png`, `banner.png`, etc.).

### Custom Game Assets

For assets used inside your game UI (card images, sound effects, fonts, etc.), place them in subdirectories under `assets/`:

```
assets/
├── icon.png          # Platform display images (root level, required)
├── banner.png
├── cover.png
├── splash.png
├── cards/            # Custom game assets (subdirectories)
│   ├── king.png
│   └── queen.png
└── sounds/
    └── flip.mp3
```

Access custom assets in your renderer via `platform.getAssetUrl()`:

```tsx
export default function GameRenderer({ platform, state }: GameRendererProps) {
  const cardImg = platform.getAssetUrl('cards/king.png');
  const flipSound = platform.getAssetUrl('sounds/flip.mp3');

  return (
    <div>
      <img src={cardImg} alt="King" />
      <audio src={flipSound} />
    </div>
  );
}
```

**How it works:**
- During `lpt-dev-kit dev`: returns a local URL (e.g., `http://localhost:4000/assets/cards/king.png`)
- In production: returns a CDN URL (the platform uploads assets to OSS automatically)

**Validation rules (enforced by `pack` command):**

| Rule | Limit |
|------|-------|
| Single file size | ≤ 20MB |
| Total assets size | ≤ 100MB |
| Allowed file types | `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`, `.gif`, `.mp3`, `.wav`, `.ogg`, `.json`, `.woff2`, `.woff` |
| Path rules | No `..`, no spaces |

**Alternative approaches for small assets:**

| Approach | When to Use | How |
|----------|-------------|-----|
| **Inline in bundle** | Tiny assets (< 4KB) | Vite automatically inlines as data URLs |
| **CSS/SVG** | UI elements, icons | Inline styles, `<style>` injection, or inline SVG components |
| **Emoji/Unicode** | Simple visual indicators | Unicode characters directly in JSX |

> **Tip:** Use `platform.getAssetUrl()` for assets 100KB+ instead of inlining them into the bundle.

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
| `getAssetUrl(path)` | Returns the runtime URL for a custom asset (e.g., `"cards/king.png"` → CDN URL) |
| `getDeviceCapabilities()` | Returns `{ haptics: boolean, motion: boolean }` indicating available device features |
| `haptic(type, option?)` | Triggers haptic feedback. `type`: `'impact'` / `'notification'` / `'selection'`. Silent no-op if unsupported |
| `onShake(handler)` | Listens for device shake events. Returns an unsubscribe function |
| `onTilt(handler)` | Streams device tilt data (`{ alpha, beta, gamma }`) at ~60fps. Returns an unsubscribe function |

#### Device Capabilities & Graceful Degradation

Games can query runtime capabilities via `getDeviceCapabilities()` and provide fallback UI:

```tsx
const caps = platform.getDeviceCapabilities();

// Shake: use motion sensor or fall back to a button
useEffect(() => {
  if (!caps.motion) return;
  return platform.onShake(() => {
    platform.haptic('impact', 'heavy');
    platform.send({ type: 'ROLL_DICE' });
  });
}, [platform, caps.motion]);

// Tilt: stream orientation data for motion-controlled games
useEffect(() => {
  if (!caps.motion) return;
  return platform.onTilt((tilt) => {
    // tilt.beta = front/back (-180~180), tilt.gamma = left/right (-90~90)
    updateBallPosition(tilt.gamma, tilt.beta);
  });
}, [platform, caps.motion]);

// Haptic feedback on user action (silent no-op if unsupported)
platform.haptic('impact', 'light');
```

| Environment | Haptics | Motion (Shake/Tilt) |
|---|---|---|
| Native App (iOS/Android) | Full support (Impact/Notification/Selection) | Full support |
| Web (Android Chrome) | Basic vibration | Supported |
| Web (iOS Safari) | Not supported (silent) | Requires permission (handled by platform) |
| Dev-kit preview | Not supported (silent) | Not supported |

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
2. **Inline styles + `<style>` injection**: Do NOT use Tailwind CSS (see "Renderer Styling Guide" below). Use inline styles with CSS variables for layout and theming. Use `<style>` injection for animations and pseudo-classes.
3. **Mobile-first**: Design for phone screens (375px width). The platform is a PWA.
4. **No direct socket access**: Only use `platform.send()` and `platform.on()`.
5. **Chinese UI text**: The platform targets Chinese-speaking users.
6. **Responsive touch targets**: Buttons should be at least 44x44px for mobile.

### Renderer Styling Guide

**Do NOT use Tailwind CSS in game renderers.** The production platform pre-compiles Tailwind at build time and only scans the platform's own source code — game bundles are loaded dynamically at runtime, so Tailwind utility classes (especially arbitrary values like `w-[280px]`, `text-[18px]`) will silently fail in production even though they work in the dev-kit.

Use **inline styles** as the primary styling method, with **`<style>` injection** for features that inline styles can't express (animations, pseudo-classes, hover states).

#### Inline styles (primary)

```tsx
// ✅ Use inline styles with CSS variables
<div style={{ width: 280, height: 60, fontSize: 18, color: "var(--text-primary)" }}>

// ❌ Do NOT use Tailwind classes
<div className="w-[280px] h-[60px] text-[18px] text-text-primary">
```

#### `<style>` injection (for animations and pseudo-classes)

```tsx
const GameStyles = () => (
  <style>{`
    @keyframes card-flip {
      0% { transform: rotateY(0deg); }
      50% { transform: rotateY(90deg); scale: 1.1; }
      100% { transform: rotateY(180deg); }
    }
    .my-game-card-flip { animation: card-flip 0.6s ease-in-out; }
    .my-game-btn:disabled { opacity: 0.4; }
    .my-game-input:focus { outline: none; border-color: var(--accent-primary); }
  `}</style>
);

export default function GameRenderer({ platform, state }: GameRendererProps) {
  return (
    <div>
      <GameStyles />
      <div className="my-game-card-flip" style={{ width: 120, height: 180 }}>
        {/* card content */}
      </div>
    </div>
  );
}
```

> **Tip:** Prefix your CSS class names with your game name (e.g., `my-game-`) to avoid conflicts when multiple games coexist.

#### Why this approach

- **Zero dependencies**: No CSS framework needed
- **Consistent across environments**: Inline styles work identically in dev-kit and production
- **No conflicts**: Inline styles are naturally isolated; multiple games won't interfere
- **More flexible animations**: Native CSS keyframes support multi-stage animations, cubic-bezier curves, and staggered delays — more powerful than Tailwind's preset `animate-*` classes

### Design Token Reference

Use these CSS variables in your inline styles for consistent theming:

| Purpose | CSS Variable | Inline Style Example |
|---------|-------------|---------------------|
| Page background | `--bg-primary` | `background: "var(--bg-primary)"` |
| Card background | `--bg-secondary` | `background: "var(--bg-secondary)"` |
| Elevated surface | `--bg-tertiary` | `background: "var(--bg-tertiary)"` |
| Primary accent | `--accent-primary` | `color: "var(--accent-primary)"` |
| Primary text | `--text-primary` | `color: "var(--text-primary)"` |
| Secondary text | `--text-secondary` | `color: "var(--text-secondary)"` |
| Muted text | `--text-tertiary` | `color: "var(--text-tertiary)"` |
| Border | `--border-default` | `border: "1px solid var(--border-default)"` |
| Success | `--success` | `color: "var(--success)"` |
| Error | `--error` | `color: "var(--error)"` |
| Display font | `--font-display` | `fontFamily: "var(--font-display)"` |
| Body font | `--font-body` | `fontFamily: "var(--font-body)"` |

## Platform Runtime Constraints

The production platform runs game engines inside a Node.js `vm` sandbox. The dev-kit (`npm run dev`) automatically enforces key constraints so issues surface during local development, not after deployment.

### Timer APIs Are Disabled

The sandbox replaces `setTimeout`, `setInterval`, `clearTimeout`, and `clearInterval` with no-ops. Calling them inside engine code will:

- **In production**: silently do nothing (the callback is never executed)
- **In dev-kit**: print a warning to the console and return `0`

```typescript
// BAD - will not work in production
handleAction(state, playerId, action) {
  setTimeout(() => {
    // This callback will NEVER run in the sandbox
  }, 2000);
  return { ...state, phase: 'animating' };
}

// GOOD - let the client handle timing
handleAction(state, playerId, action) {
  return { ...state, phase: 'animating' };
}
// In renderer: after animation completes, send a follow-up action:
//   platform.send({ type: 'ANIMATION_DONE' })
// Engine handles ANIMATION_DONE to advance to the next phase.
```

### State Must Be JSON-Serializable

The platform stores game state in Redis via `JSON.stringify` / `JSON.parse` round-trips. Non-serializable types will silently lose data:

| Type | After JSON Round-Trip | Result |
|------|----------------------|--------|
| `Map` | `{}` | Data lost |
| `Set` | `{}` | Data lost |
| `Date` | `"2026-02-10T..."` (string) | Type changed |
| `undefined` | Removed | Field disappears |
| `RegExp` | `{}` | Data lost |
| Function | Removed | Lost |

The dev-kit checks your state after every `init()` and `handleAction()` call and prints warnings if non-serializable types are detected.

```typescript
// BAD
data: {
  players: new Map([['p1', { score: 0 }]]),
  seen: new Set(['card-1']),
  createdAt: new Date(),
}

// GOOD
data: {
  players: { p1: { score: 0 } },
  seen: ['card-1'],
  createdAt: '2026-02-10T00:00:00.000Z',
}
```

### Engine Instance Is Shared

The platform loads your engine bundle once and reuses it across all game rooms. This means **module-level mutable variables are shared between games**:

```typescript
// BAD - shared across all rooms!
let gameCounter = 0;

const engine: GameEngine = {
  init(players) {
    gameCounter++; // Will increment across different rooms
    // ...
  },
};

// GOOD - all state lives in GameState
const engine: GameEngine = {
  init(players) {
    return {
      phase: 'playing',
      players: players.map(p => ({ id: p.id })),
      data: { roundNumber: 1 },  // State is per-room
    };
  },
};
```

### Restricted Global Variables

The following globals are `undefined` in the sandbox:

| Global | Alternative |
|--------|-------------|
| `fetch` | Not available. Engines cannot make network calls. |
| `process` | Not available. |
| `globalThis` | Not available. |
| `global` | Not available. |

Available built-ins: `Math`, `JSON`, `Date`, `Array`, `Object`, `Map`, `Set`, `Number`, `String`, `Boolean`, `Error`, `TypeError`, `RangeError`, `parseInt`, `parseFloat`, `isNaN`, `isFinite`, `console` (log/error/warn).

### `require()` Whitelist

Only the following modules can be required in engine code (all are stubs for compatibility):
`react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`

Any other `require()` call will throw an error.

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

## Game Settlement Lifecycle

When `isGameOver()` returns `true`, the platform **immediately** takes over: it sends `game:result` to all clients, transitions to the settlement screen, and **unloads the game renderer**. This happens in the same tick as the final `game:state` broadcast:

```
engine.handleAction(state, playerId, action) → newState
broadcastPlayerViews(newState)          ← last game frame sent
engine.isGameOver(newState) → true
handleGameEnd()                         ← platform takes over, renderer unloaded
```

If your game needs an in-game settlement screen (animations, rankings, replay, etc.), you **must not** let `isGameOver()` return `true` until that screen is done.

### Two-Phase Settlement Pattern

Split game ending into two phases:

```
playing → (winner decided) → settlement → (player confirms or timer expires) → finished
                               ↑                                                  ↑
                        isGameOver = false                                 isGameOver = true
                        game renderer shows                                platform takes over
                        its own result screen
```

#### Engine Implementation

```typescript
handleAction(state: GameState, playerId: string, action: GameAction): GameState {
  const data = state.data as MyGameData;

  // 1. Normal gameplay — when winner is decided, enter settlement
  if (state.phase === "playing" && winnerDecided(data)) {
    return {
      ...state,
      phase: "settlement",
      data: { ...data, rankings: computeRankings(data) },
    };
  }

  // 2. Settlement — wait for confirm action, then finish
  if (state.phase === "settlement" && action.type === "CONFIRM_RESULT") {
    return { ...state, phase: "finished" };
  }

  return state;
},

isGameOver(state: GameState): boolean {
  return state.phase === "finished";   // NOT "settlement"!
},

getPlayerView(state: GameState, playerId: string): Partial<GameState> {
  if (state.phase === "settlement") {
    // Return rankings / stats for the in-game result screen
    return {
      ...state,
      data: { rankings: (state.data as MyGameData).rankings },
    };
  }
  // ...
},
```

#### Renderer Implementation

```tsx
export default function GameRenderer({ platform, state }: GameRendererProps) {
  if (state.phase === "settlement") {
    return (
      <div>
        {/* Show your in-game result screen here */}
        <Rankings data={state.data.rankings} />
        <button onClick={() => platform.send({ type: "CONFIRM_RESULT" })}>
          确认
        </button>
      </div>
    );
  }
  // ... normal gameplay UI
}
```

### Common Mistakes

| Mistake | Consequence |
|---------|------------|
| `isGameOver()` returns `true` in `settlement` phase | In-game result screen is skipped — platform unloads the renderer immediately |
| No `settlement` phase; jumping straight from `playing` to `finished` | Players never see the in-game result animation / ranking |
| Calling `platform.reportResult()` from the renderer | No-op — settlement is driven entirely by the server via `isGameOver` + `getResult` |

### One-Liner Rule

> **`isGameOver()` is the platform takeover switch. Do not return `true` until your in-game result screen is done.**

## Complete Example: Number Guessing Game

See the [`examples/number-guess`](../../examples/number-guess) directory for a complete working example.

### config.ts
```typescript
import type { GameConfig } from "@littlepartytime/sdk";

const config: GameConfig = {
  name: "Guess the Number",
  description: "Take turns guessing a secret number between 1-100. The range narrows with each guess!",
  assets: {
    icon: "assets/icon.png",
    banner: "assets/banner.png",
    cover: "assets/cover.png",
    splash: "assets/splash.png",
  },
  minPlayers: 2,
  maxPlayers: 8,
  tags: ["casual", "party"],
  version: "1.0.0",
  sdkVersion: "2.0.0",
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
