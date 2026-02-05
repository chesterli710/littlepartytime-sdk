# Little Party Time SDK

Game development toolkit for the **Little Party Time** platform — a mobile-first party game platform where friends play board games together.

## Quick Start

```bash
# Create a new game project
npx create-littlepartytime-game my-awesome-game
cd my-awesome-game

# Install dependencies
npm install

# Run tests
npm test

# Start dev server (Phase 2)
# npm run dev

# Build and package for upload
npm run pack
```

## Packages

| Package | Description |
|---------|-------------|
| [`@littlepartytime/sdk`](./packages/sdk) | Type definitions + testing utilities |
| [`@littlepartytime/dev-kit`](./packages/dev-kit) | Development CLI (pack, dev server) |
| [`create-littlepartytime-game`](./packages/create-game) | Project scaffolding |

## SDK Overview

The SDK provides TypeScript interfaces for building games:

```typescript
import type {
  GameEngine,    // Server-side game logic
  GameConfig,    // Game metadata
  GameState,     // Current game state
  Platform,      // Client-side platform API
  GameRendererProps  // React component props
} from '@littlepartytime/sdk';
```

### Testing Utilities

```typescript
import {
  createMockPlayers,  // Generate test players
  GameTester,         // Unit test wrapper
  GameSimulator       // E2E simulation
} from '@littlepartytime/sdk/testing';
```

## Architecture

Games have two parts:

1. **Engine** (server-side) — Pure state machine. Handles game logic, validates actions, determines winners.
2. **Renderer** (client-side) — React component. Displays UI and sends player actions.

```
Player taps button
       |
Renderer calls platform.send(action)
       |
Server: engine.handleAction(state, playerId, action) -> newState
       |
Server: engine.getPlayerView(newState, playerId) -> filteredState
       |
Renderer receives "stateUpdate" event
       |
React re-renders
```

## Example Game

See [`examples/number-guess`](./examples/number-guess) for a complete working example.

## Development Workflow

1. **Create game**: `npx create-littlepartytime-game my-game`
2. **Write tests**: Use `GameTester` for unit tests, `GameSimulator` for E2E
3. **Implement engine**: Pure functions, no side effects
4. **Build renderer**: React component with Tailwind CSS
5. **Package**: `npm run pack` creates a `.zip` file
6. **Upload**: Submit `.zip` to the admin panel

## Documentation

- [Game Development Guide](./packages/sdk/GAME_DEV_GUIDE.md) — Complete reference
- [API Reference](./packages/sdk/src) — TypeScript interfaces

## Contributing

Issues and PRs welcome! Please file bugs and feature requests in the [issue tracker](https://github.com/chesterli710/littlepartytime-sdk/issues).

## License

MIT
