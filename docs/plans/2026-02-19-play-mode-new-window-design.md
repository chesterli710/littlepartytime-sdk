# Play/Debug 模式新窗口打开 + 自动加入

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 dev-kit 的 Play/Debug 按钮在新窗口中打开，Play 模式自动命名并加入，Debug 模式作为只读观察者。

**Architecture:** 服务端完全控制方案（方案 B）。socket 连接时通过 `auto` query 参数触发服务端自动分配名字并加入。Debug 连接以 `__debug__` 身份连接时跳过 addPlayer，作为纯观察者。

**Tech Stack:** React, Socket.IO, Vitest

---

## Task 1: game-room.ts — 新增 getNextAvailableName

**Files:**
- Modify: `packages/dev-kit/src/server/game-room.ts:1-27`
- Test: `packages/dev-kit/src/__tests__/game-room.test.ts` (create)

**Step 1: Write the failing test**

Create `packages/dev-kit/src/__tests__/game-room.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as GameRoom from '../server/game-room';

describe('getNextAvailableName', () => {
  it('should return Alice for an empty room', () => {
    const room = GameRoom.createRoom('test');
    expect(GameRoom.getNextAvailableName(room)).toBe('Alice');
  });

  it('should skip names already taken', () => {
    const room = GameRoom.createRoom('test');
    GameRoom.addPlayer(room, 's1', 'Alice');
    GameRoom.addPlayer(room, 's2', 'Bob');
    expect(GameRoom.getNextAvailableName(room)).toBe('Carol');
  });

  it('should fill gaps when a middle name is freed', () => {
    const room = GameRoom.createRoom('test');
    GameRoom.addPlayer(room, 's1', 'Alice');
    GameRoom.addPlayer(room, 's2', 'Bob');
    GameRoom.addPlayer(room, 's3', 'Carol');
    GameRoom.removePlayer(room, 's2'); // Bob leaves
    expect(GameRoom.getNextAvailableName(room)).toBe('Bob');
  });

  it('should fallback to Player N when all 8 names are used', () => {
    const room = GameRoom.createRoom('test');
    const names = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Heidi'];
    names.forEach((n, i) => GameRoom.addPlayer(room, `s${i}`, n));
    expect(GameRoom.getNextAvailableName(room)).toBe('Player 9');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@littlepartytime/dev-kit -- --run src/__tests__/game-room.test.ts`
Expected: FAIL — `getNextAvailableName is not a function`

**Step 3: Write minimal implementation**

Add to `packages/dev-kit/src/server/game-room.ts` after the `GameRoom` interface (before `createRoom`):

```ts
const PLAYER_NAMES = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Heidi'];

export function getNextAvailableName(room: GameRoom): string {
  const usedNames = new Set(room.players.map(p => p.nickname));
  return PLAYER_NAMES.find(n => !usedNames.has(n)) ?? `Player ${room.players.length + 1}`;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@littlepartytime/dev-kit -- --run src/__tests__/game-room.test.ts`
Expected: 4 tests PASS

**Step 5: Run full test suite for regression**

Run: `npm run test --workspace=@littlepartytime/dev-kit`
Expected: All existing tests still pass

**Step 6: Commit**

```bash
git add packages/dev-kit/src/server/game-room.ts packages/dev-kit/src/__tests__/game-room.test.ts
git commit -m "feat(dev-kit): add getNextAvailableName for auto player naming"
```

---

## Task 2: socket-server.ts — Debug 观察者 + auto 名字分配 + player:assigned 事件

**Files:**
- Modify: `packages/dev-kit/src/server/socket-server.ts:40-56`

**Step 1: Add debug observer early return**

In `socket-server.ts`, inside `io.on('connection', ...)`, add at the very top (before any addPlayer logic):

```ts
io.on('connection', (socket) => {
  const nickname = socket.handshake.query.nickname as string;

  // Debug observer: receive broadcasts but don't join as player
  if (nickname === '__debug__') {
    log('Debug observer connected');
    socket.emit('room:update', {
      players: room.players.map(p => ({ id: p.id, nickname: p.nickname, isHost: p.isHost, ready: p.ready })),
      phase: room.phase,
    });
    if (room.state) socket.emit('debug:state', room.state);
    socket.on('disconnect', () => log('Debug observer disconnected'));
    return;
  }

  // Auto-assign name or use provided nickname
  const isAuto = socket.handshake.query.auto === 'true';
  const playerNickname = isAuto
    ? GameRoom.getNextAvailableName(room)
    : nickname || `Player ${room.players.length + 1}`;

  // (rest of existing logic, replacing old `nickname` variable with `playerNickname`)
```

**Step 2: Add player:assigned emit**

After the existing `addPlayer`/`reconnectPlayer` block and the `io.emit('room:update', ...)`, add:

```ts
  socket.emit('player:assigned', { id: player.id, nickname: player.nickname });
```

**Step 3: Update all references from `nickname` to `playerNickname`**

In the existing code, the old `nickname` variable (line 41) is referenced in:
- `reconnectPlayer(room, socket.id, nickname)` → change to `playerNickname`
- `addPlayer(room, socket.id, nickname)` → change to `playerNickname`

**Step 4: Run full test suite**

Run: `npm run test --workspace=@littlepartytime/dev-kit`
Expected: All tests pass

**Step 5: Commit**

```bash
git add packages/dev-kit/src/server/socket-server.ts
git commit -m "feat(dev-kit): debug observer mode + auto name assignment + player:assigned event"
```

---

## Task 3: App.tsx — Play/Debug 按钮打开新窗口

**Files:**
- Modify: `packages/dev-kit/src/webapp/App.tsx:21-38`

**Step 1: Change nav button click handler**

Replace the onClick for each tab button. Preview stays in-window; Play and Debug open new windows:

```tsx
{(['preview', 'play', 'debug'] as Page[]).map((p) => (
  <button
    key={p}
    onClick={() => {
      if (p === 'preview') {
        setPage(p);
        history.pushState(null, '', `/${p}`);
      } else {
        window.open(
          p === 'play' ? '/play?auto=true' : `/${p}`,
          '_blank',
        );
      }
    }}
    className="dk-nav-btn"
    style={{
      padding: '4px 12px',
      borderRadius: 4,
      border: 'none',
      cursor: 'pointer',
      fontSize: 14,
      ...(page === p
        ? { background: '#d97706', color: '#fff' }
        : { background: 'transparent', color: '#a1a1aa' }),
    }}
  >
    {p.charAt(0).toUpperCase() + p.slice(1)}
  </button>
))}
```

**Step 2: Commit**

```bash
git add packages/dev-kit/src/webapp/App.tsx
git commit -m "feat(dev-kit): open Play/Debug in new window from nav bar"
```

---

## Task 4: Play.tsx — Auto 模式自动加入逻辑

**Files:**
- Modify: `packages/dev-kit/src/webapp/pages/Play.tsx`

**Step 1: Add auto-mode detection and myPlayerId state**

At the top of the `Play` component, add:

```tsx
const isAutoMode = useMemo(() => new URLSearchParams(window.location.search).get('auto') === 'true', []);
const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
```

**Step 2: Add auto-join useEffect**

After the existing `useEffect` that loads the renderer, add:

```tsx
// Auto-join: connect immediately with server-assigned name
useEffect(() => {
  if (!isAutoMode) return;

  const sock = io('http://localhost:4001', { query: { auto: 'true' } });

  sock.on('connect', () => {
    setMyId(sock.id);
    setJoined(true);
  });

  sock.on('player:assigned', ({ id, nickname: assignedName }: { id: string; nickname: string }) => {
    setMyPlayerId(id);
    setNickname(assignedName);
  });

  sock.on('room:update', (r: any) => {
    setRoom(r);
    if (r.phase === 'lobby') {
      setGameResult(null);
      setGameState(null);
    }
  });
  sock.on('game:state', setGameState);
  sock.on('game:result', (result) => {
    console.log('Game result:', result);
    setGameResult(result);
  });

  setSocket(sock);

  return () => { sock.disconnect(); };
}, [isAutoMode]);
```

**Step 3: Update `me` lookup**

Replace the existing `me` lookup (line 54) with:

```tsx
const me = room.players.find((p: any) => myPlayerId && p.id === myPlayerId)
         || room.players.find((p: any) => p.nickname === nickname);
```

**Step 4: Also listen for player:assigned in manual join flow**

In the existing `join` callback, after `sock.on('connect', ...)`, add:

```tsx
sock.on('player:assigned', ({ id }: { id: string; nickname: string }) => {
  setMyPlayerId(id);
});
```

This ensures `me` lookup works reliably in both modes.

**Step 5: Run full test suite**

Run: `npm run test --workspace=@littlepartytime/dev-kit`
Expected: All tests pass

**Step 6: Commit**

```bash
git add packages/dev-kit/src/webapp/pages/Play.tsx
git commit -m "feat(dev-kit): auto-join with server-assigned name in Play mode"
```

---

## Task 5: Build and manual verification

**Step 1: Build the package**

Run: `npm run build --workspace=@littlepartytime/dev-kit`
Expected: Build succeeds with no errors

**Step 2: Run full test suite across all packages**

Run: `npm test`
Expected: All tests pass

**Step 3: Manual smoke test (if game project available)**

1. Start dev server: `cd <game-project> && npx lpt-dev-kit dev`
2. Open `http://localhost:4000/preview` — should work as before
3. Click "Play" in nav — new window opens at `/play?auto=true`, player auto-named "Alice"
4. Click "Play" again — another window opens, player auto-named "Bob"
5. Click "Debug" in nav — new window opens at `/debug`, no new player in lobby
6. In Alice's window, start game — Debug window shows state but isn't a player
7. Manually open `http://localhost:4000/play` — should show join form as before

**Step 4: Commit any fixes if needed**
