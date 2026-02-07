# @littlepartytime/sdk

Game SDK for the [Little Party Time](https://github.com/chesterli710/littlepartytime-sdk) platform — type definitions and testing utilities for game developers.

## Install

```bash
npm install @littlepartytime/sdk
```

## What's Included

- **Type definitions** — `GameConfig`, `GameEngine`, `GameState`, `GameAction`, `GameResult`, `GameRendererProps`, etc.
- **Testing utilities** — `GameTester`, `GameSimulator`, `createMockPlayers` (import from `@littlepartytime/sdk/testing`)

## Quick Example

```typescript
import type { GameEngine, GameState, Player } from "@littlepartytime/sdk";

const engine: GameEngine = {
  init(players: Player[]): GameState { /* ... */ },
  handleAction(state, playerId, action) { /* ... */ },
  isGameOver(state) { /* ... */ },
  getResult(state) { /* ... */ },
  getPlayerView(state, playerId) { /* ... */ },
};
```

## Documentation

Full development guide with step-by-step instructions, testing patterns, build configuration, and asset requirements:

**[GAME_DEV_GUIDE.md](https://github.com/chesterli710/littlepartytime-sdk/blob/main/packages/sdk/GAME_DEV_GUIDE.md)**

After installing the SDK, the guide is also available locally:

```bash
cat node_modules/@littlepartytime/sdk/GAME_DEV_GUIDE.md
```

## Related Packages

| Package | Description |
|---------|-------------|
| [`@littlepartytime/dev-kit`](https://www.npmjs.com/package/@littlepartytime/dev-kit) | CLI dev server, build & pack toolchain |
| [`create-littlepartytime-game`](https://www.npmjs.com/package/create-littlepartytime-game) | Project scaffolding (`npx create-littlepartytime-game`) |

## License

MIT
