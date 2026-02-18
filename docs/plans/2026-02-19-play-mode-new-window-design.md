# Play/Debug 模式新窗口打开 + 自动加入

**日期**: 2026-02-19
**方案**: B（服务端完全控制，连接即分配）

## 背景

当前 dev-kit 的 Preview/Play/Debug 三个 tab 在同一窗口内切换。Play 模式需要手动输入昵称、点击 Join 才能加入。开发者测试多人游戏时需要手动打开多个浏览器 tab 并逐个输入昵称。

## 需求

1. 点击导航栏 Play/Debug 时，在新窗口中打开，原窗口保持不变
2. Play 模式新窗口自动命名（Alice/Bob/Carol...）、自动准备、自动加入
3. Debug 模式作为只读观察者，不计入玩家

## 设计

### 1. 导航栏行为变更（App.tsx）

- **Preview**: 保持原样，同窗口内切换
- **Play**: `window.open('/play?auto=true', '_blank')` 打开新窗口
- **Debug**: `window.open('/debug', '_blank')` 打开新窗口
- 原窗口状态不变
- 新窗口显示完整 App（带导航栏）

### 2. 服务端自动分配名字（game-room.ts + socket-server.ts）

**game-room.ts** 新增：

```ts
const PLAYER_NAMES = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Heidi'];

export function getNextAvailableName(room: GameRoom): string {
  const usedNames = new Set(room.players.map(p => p.nickname));
  return PLAYER_NAMES.find(n => !usedNames.has(n)) ?? `Player ${room.players.length + 1}`;
}
```

前 8 个用名字，之后 `Player 9`、`Player 10`...

**socket-server.ts** 连接处理：

```ts
io.on('connection', (socket) => {
  const isAuto = socket.handshake.query.auto === 'true';
  const nickname = isAuto
    ? GameRoom.getNextAvailableName(room)
    : (socket.handshake.query.nickname as string) || `Player ${room.players.length + 1}`;

  // ... addPlayer 逻辑不变 ...

  // 新增：告知客户端分配的身份
  socket.emit('player:assigned', { id: player.id, nickname: player.nickname });
});
```

### 3. Play.tsx 自动加入逻辑

检测 URL 参数 `auto=true`：

- **auto 模式**: 跳过 join form，`useEffect` 中立即创建 socket（`query: { auto: 'true' }`），监听 `player:assigned` 获取昵称，设置 `joined = true`
- **手动模式**（直接访问 `/play`）: 保持现有 join form 流程不变

`me` 查找改进为优先用 `playerId` 匹配：

```ts
const me = room.players.find(p => myPlayerId && p.id === myPlayerId)
         || room.players.find(p => p.nickname === nickname);
```

### 4. Debug 观察者模式（socket-server.ts）

`__debug__` 连接时跳过 addPlayer，只监听广播事件：

```ts
if (nickname === '__debug__') {
  log('Debug observer connected');
  socket.emit('room:update', { /* 当前房间状态 */ });
  if (room.state) socket.emit('debug:state', room.state);
  socket.on('disconnect', () => log('Debug observer disconnected'));
  return; // 跳过玩家逻辑
}
```

不出现在玩家列表，不影响人数判定。

## 涉及文件

| 文件 | 改动 |
|------|------|
| `packages/dev-kit/src/webapp/App.tsx` | Play/Debug 按钮改为 window.open |
| `packages/dev-kit/src/webapp/pages/Play.tsx` | 新增 auto 模式自动加入逻辑 |
| `packages/dev-kit/src/server/game-room.ts` | 新增 getNextAvailableName |
| `packages/dev-kit/src/server/socket-server.ts` | auto 名字分配 + player:assigned 事件 + debug 观察者 |

## 不变的部分

- Preview 模式完全不变
- Debug.tsx 完全不变
- 手动访问 `/play` 的 join form 流程不变
- `Platform` 接口契约不变，游戏逻辑测试不受影响
- 玩家 auto-ready（`ready: true`）已是现有行为，无需改动
