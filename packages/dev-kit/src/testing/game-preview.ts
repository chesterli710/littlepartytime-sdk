// packages/dev-kit/src/testing/game-preview.ts
import type { DevServerHandle } from '../commands/dev';

export interface GamePreviewOptions {
  /** Absolute path to the game project directory */
  projectDir: string;
  /** Number of players to simulate */
  playerCount: number;
  /** Vite dev server port (default: 4100) */
  port?: number;
  /** Socket.IO server port (default: 4101) */
  socketPort?: number;
  /** Run browser in headless mode (default: true) */
  headless?: boolean;
  /** Browser type to use (default: 'chromium') */
  browserType?: 'chromium' | 'firefox' | 'webkit';
}

const PLAYER_NAMES = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Heidi'];

export class GamePreview {
  private options: Required<GamePreviewOptions>;
  private serverHandle: DevServerHandle | null = null;
  private browser: any = null;
  private context: any = null;
  private playerPages: { page: any; nickname: string }[] = [];

  constructor(options: GamePreviewOptions) {
    this.options = {
      port: 4100,
      socketPort: 4101,
      headless: true,
      browserType: 'chromium',
      ...options,
    };
  }

  /**
   * Start the dev server and launch browser pages for each player.
   * Each player automatically joins the game lobby.
   */
  async start(): Promise<void> {
    // 1. Start dev server programmatically
    const { devCommand } = await import('../commands/dev');
    this.serverHandle = await devCommand(this.options.projectDir, {
      port: this.options.port,
      socketPort: this.options.socketPort,
      silent: true,
    });

    // 2. Launch browser (dynamic import to handle optional dependency)
    let playwright: any;
    try {
      // Use variable to prevent TypeScript from resolving the module at compile time
      const moduleName = 'playwright';
      playwright = await import(/* webpackIgnore: true */ moduleName);
    } catch {
      throw new Error(
        'GamePreview requires playwright. Install it with: npm install -D playwright'
      );
    }

    const browserType = playwright[this.options.browserType];
    if (!browserType) {
      throw new Error(`Unknown browser type: ${this.options.browserType}`);
    }

    this.browser = await browserType.launch({
      headless: this.options.headless,
    });
    this.context = await this.browser.newContext();

    // 3. Open pages and join lobby for each player
    for (let i = 0; i < this.options.playerCount; i++) {
      const nickname = PLAYER_NAMES[i] || `Player ${i + 1}`;
      const page = await this.context.newPage();

      await page.goto(`http://localhost:${this.options.port}/play`);

      // Fill nickname and join
      await page.fill('input[placeholder="Your nickname"]', nickname);
      await page.click('button:has-text("Join")');

      // Wait for lobby to appear
      await page.waitForSelector('text=Lobby', { timeout: 10000 });

      this.playerPages.push({ page, nickname });
    }
  }

  /**
   * Get the Playwright Page object for a specific player by index.
   * Player 0 is the host.
   */
  getPlayerPage(playerIndex: number): any {
    if (playerIndex < 0 || playerIndex >= this.playerPages.length) {
      throw new Error(
        `Invalid playerIndex: ${playerIndex}. Valid range: 0-${this.playerPages.length - 1}`
      );
    }
    return this.playerPages[playerIndex].page;
  }

  /**
   * Get all Playwright Page objects.
   */
  getPlayerPages(): any[] {
    return this.playerPages.map(pp => pp.page);
  }

  /**
   * Get the number of players.
   */
  get playerCount(): number {
    return this.playerPages.length;
  }

  /**
   * Click "Ready" for all players.
   */
  async readyAll(): Promise<void> {
    for (const pp of this.playerPages) {
      const readyButton = pp.page.locator('button:has-text("Ready")');
      await readyButton.click();
      // Small delay to let Socket.IO propagate
      await pp.page.waitForTimeout(100);
    }
  }

  /**
   * Have the host start the game. Requires all players to be ready.
   */
  async startGame(): Promise<void> {
    const hostPage = this.playerPages[0].page;
    await hostPage.click('button:has-text("Start Game")');

    // Wait for game state to load on all pages
    await Promise.all(
      this.playerPages.map(pp =>
        pp.page.waitForTimeout(500)
      )
    );
  }

  /**
   * Stop the browser and dev server, cleaning up all resources.
   */
  async stop(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
    if (this.serverHandle) {
      await this.serverHandle.stop();
      this.serverHandle = null;
    }
    this.playerPages = [];
  }
}
