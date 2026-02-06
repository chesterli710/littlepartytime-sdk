import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GamePreview } from '@littlepartytime/dev-kit/testing';
import path from 'path';

describe('Number Guess E2E', () => {
  let preview: GamePreview;

  beforeAll(async () => {
    preview = new GamePreview({
      projectDir: path.resolve(__dirname, '..'),
      playerCount: 3,
      headless: true,
      port: 4100,
      socketPort: 4101,
    });
    await preview.start();
  }, 30000);

  afterAll(async () => {
    await preview.stop();
  }, 10000);

  it('should show lobby with all players', async () => {
    const page = preview.getPlayerPage(0);
    // All 3 players should be visible in the lobby
    await expect(page.locator('text=Alice')).toBeVisible();
    await expect(page.locator('text=Bob')).toBeVisible();
    await expect(page.locator('text=Carol')).toBeVisible();
  });

  it('should start game after all players ready', async () => {
    // All players click "Ready"
    await preview.readyAll();

    // Host starts the game
    await preview.startGame();

    // All players should see the game UI (number guess shows range display)
    for (let i = 0; i < 3; i++) {
      const page = preview.getPlayerPage(i);
      await expect(page.locator('text=猜数范围')).toBeVisible({ timeout: 5000 });
    }
  });
});
