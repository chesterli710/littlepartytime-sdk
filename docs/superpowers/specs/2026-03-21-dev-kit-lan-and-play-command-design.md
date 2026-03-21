# Dev-Kit LAN Access & `play` Command Design

**Date**: 2026-03-21
**Status**: Draft
**Scope**: `@littlepartytime/dev-kit` package

## Overview

Two independent features for the dev-kit:

1. **LAN Access**: Bind all servers to `0.0.0.0` so devices on the same network can access the dev server
2. **`play` Command**: A new CLI command that loads game ZIP packages for testing without requiring a game project directory

## Motivation

- **LAN Access**: Little Party Time games are designed for "each player uses their own phone." Developers need to test on real mobile devices over local WiFi during development.
- **`play` Command**: Developers need to test packaged game artifacts (ZIP bundles produced by `lpt-dev-kit pack`) without being inside a game project. This enables quick comparison between games and verifying that the packaged build works correctly.

---

## Feature 1: LAN Access

### Changes

#### 1.1 Server Binding

Both Vite dev server and Socket.IO server bind to `0.0.0.0` by default (applies to both `dev` and `play` commands):

- **Vite**: Add `server: { host: '0.0.0.0' }` to Vite config in `dev.ts`
- **Socket.IO**: Explicit `server.listen(port, '0.0.0.0')` in `socket-server.ts`

#### 1.2 Dynamic Socket.IO URL

Current state: `Play.tsx` and `Debug.tsx` hardcode `io('http://localhost:4001')`.

Change to:

```typescript
const socketUrl = `http://${window.location.hostname}:${SOCKET_PORT}`;
const socket = io(socketUrl);
```

The Socket.IO port (default 4001) should be passed to the frontend via Vite's `define` config or a meta tag, so it stays in sync with the CLI `--socketPort` option.

#### 1.3 Startup Banner

Print LAN address on startup using `os.networkInterfaces()` to find the first non-loopback IPv4 address:

```
  Dev server:     http://localhost:4000
  LAN:            http://192.168.1.100:4000
  Socket.IO:      http://192.168.1.100:4001
```

### Files Changed

| File | Change |
|------|--------|
| `src/commands/dev.ts` | Vite `server.host: '0.0.0.0'`, print LAN address |
| `src/server/socket-server.ts` | Explicit `0.0.0.0` binding |
| `src/webapp/pages/Play.tsx` | Dynamic Socket.IO URL |
| `src/webapp/pages/Debug.tsx` | Dynamic Socket.IO URL |

### Risks

- Binding to `0.0.0.0` exposes the dev server to the local network. This is acceptable for a development tool (Vite itself does this with `--host`). No auth is needed — this is a dev-only tool used on trusted networks.

---

## Feature 2: `play` Command

### 2.1 CLI Interface

```bash
# Start empty — upload ZIPs via Web UI
lpt-dev-kit play

# Pre-load ZIPs from a directory
lpt-dev-kit play --dir ./my-games/

# Custom ports
lpt-dev-kit play --port 4000 --socketPort 4001
```

The command can be run from **any directory** — it does not depend on a game project structure. It is intended for use with a global install (`npm install -g @littlepartytime/dev-kit`), though it also works via `npx`.

### 2.2 Architecture

```
┌──────────────────────────────────────────────┐
│  lpt-dev-kit play [--dir] [--port]           │
├──────────────────────────────────────────────┤
│                                              │
│  Vite Static Server (:4000)                  │
│  ├── Play UI (game selector + PhoneFrame)    │
│  ├── Preview UI                              │
│  └── serves /api/* via middleware             │
│                                              │
│  Socket.IO Server (:4001)                    │
│  └── Reuses GameRoom + engine logic          │
│                                              │
│  ZipManager (server-side)                    │
│  ├── Extracts ZIP → temp directory           │
│  ├── Reads manifest.json + loads engine.cjs  │
│  ├── Serves bundle.js + assets statically    │
│  └── Manages loaded games list               │
│                                              │
└──────────────────────────────────────────────┘
```

### 2.3 ZIP Loading Flow

1. **Upload**: Web UI uploads ZIP → `POST /api/games/upload` (multipart/form-data)
2. **Extract**: Server extracts ZIP to OS temp directory, validates required files (`engine.cjs`, `bundle.js`, `manifest.json`)
3. **Register**: Read manifest, add game to in-memory registry
4. **Activate**: User selects game in UI → `POST /api/games/:id/activate`
5. **Engine Hot-Swap**: Socket.IO server loads the new `engine.cjs` via `createSandboxedEngine()`, disconnects all players, resets room
6. **Frontend Reload**: Broadcast event tells frontend to load the new `bundle.js`

For `--dir` startup: scan directory for `*.zip` files, auto-extract and register all of them.

### 2.4 REST API

All APIs are served via Vite middleware on the same port as the web UI.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/games` | GET | List all loaded games (id, name, version, active status, player count) |
| `/api/games/upload` | POST | Upload ZIP file (multipart/form-data, single file) |
| `/api/games/:id/activate` | POST | Activate a game (hot-swap engine, reset room) |
| `/api/games/:id` | DELETE | Remove a loaded game (delete temp files) |
| `/api/games/active/bundle.js` | GET | Serve the active game's client bundle |
| `/api/games/active/assets/*` | GET | Serve the active game's custom asset files |

### 2.5 ZipManager

New server-side module responsible for ZIP lifecycle:

```typescript
interface GameEntry {
  id: string;              // Generated unique ID
  name: string;            // From manifest
  description: string;     // From manifest
  version: string;         // From manifest
  minPlayers: number;      // From manifest
  maxPlayers: number;      // From manifest
  iconPath: string;        // Extracted icon file path
  extractDir: string;      // Temp directory with extracted files
  enginePath: string;      // Path to engine.cjs
  bundlePath: string;      // Path to bundle.js
  assetsDir: string;       // Path to assets/ directory
}

class ZipManager {
  loadZip(zipPath: string): Promise<GameEntry>
  loadFromUpload(buffer: Buffer, filename: string): Promise<GameEntry>
  removeGame(id: string): void
  getGame(id: string): GameEntry | undefined
  listGames(): GameEntry[]
  cleanup(): void  // Remove all temp directories on shutdown
}
```

Temp directory cleanup: register `process.on('exit')` and `process.on('SIGINT')` handlers to clean up extracted files.

### 2.6 Web UI Changes

#### Game Selector Bar

Added to the top of Play and Preview pages (only in `play` mode, not `dev` mode):

- Horizontal bar showing loaded games as cards (icon + name + version + player count range)
- Active game highlighted
- "Upload Game" button opens file picker (accepts `.zip`)
- Upload progress indicator
- Click a game card to activate it (confirms if players are connected)

#### Bundle Loading

In `dev` mode, the game renderer is imported via Vite from source code. In `play` mode:

- Frontend loads `bundle.js` via dynamic `<script>` tag from `/api/games/active/bundle.js`
- The bundle registers itself on `window.__LPT_GAME__` (or similar global)
- PhoneFrame renders the registered component
- On game switch: remove old script tag, load new bundle, re-render

#### Mode Detection

The frontend needs to know whether it's running in `dev` mode or `play` mode. This is passed via Vite's `define` config:

```typescript
define: {
  __DEV_KIT_MODE__: JSON.stringify('play'), // or 'dev'
}
```

### 2.7 Differences from `dev` Command

| Aspect | `dev` | `play` |
|--------|-------|--------|
| Requires game project directory | Yes | No |
| Source code watching / hot reload | Yes (Vite HMR) | No |
| Auto-rebuild engine on change | Yes | No |
| Multiple games | No (single project) | Yes (upload/switch) |
| Bundle source | Vite import from `src/` | Static serve from ZIP `bundle.js` |
| Engine source | Built from `src/` | Loaded from ZIP `engine.cjs` |
| Game assets | From project `assets/` dir | From ZIP `assets/` dir |
| Typical install | devDependency in project | Global install |

### 2.8 Code Reuse

| Module | Reuse Strategy |
|--------|---------------|
| `socket-server.ts` + `game-room.ts` | Direct reuse — engine loaded via `reloadEngine()` |
| `sandbox-guard.ts` | Direct reuse |
| `engine-loader.ts` | Extend to support loading from arbitrary path (not just `projectDir/dist/`) |
| `PhoneFrame.tsx` | Direct reuse |
| `Play.tsx` / `Preview.tsx` / `Debug.tsx` | Reuse with conditional game selector bar |
| `PlatformTakeover.tsx` | Direct reuse |
| `App.tsx` | Extend routing for play mode |

### 2.9 New Files

| File | Purpose |
|------|---------|
| `src/commands/play.ts` | CLI command handler |
| `src/server/zip-manager.ts` | ZIP extraction, validation, lifecycle |
| `src/server/games-api.ts` | REST API route handlers |
| `src/webapp/components/GameSelector.tsx` | Game selector bar component |

---

## Out of Scope

- Authentication / access control (dev tool on trusted networks)
- Game state persistence across server restarts
- Concurrent multi-game rooms (one active game at a time)
- Remote ZIP URLs (only local file upload and directory scan)
- Auto-update of installed ZIPs

## Future Considerations

- Could evolve into a lightweight "local game lobby" for demo/party use
- QR code generation for easy mobile device connection
- Multiple concurrent game rooms (different games for different groups)
