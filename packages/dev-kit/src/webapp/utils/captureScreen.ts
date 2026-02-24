import html2canvas from 'html2canvas';

// Must match PhoneFrame constants: SCREEN_W=390, SAFE_AREA_TOP=59, SAFE_AREA_BOTTOM=34, SCREEN_H=844
const CAPTURE_W = 390;
const CAPTURE_H = 751; // 844 - 59 - 34

/**
 * Captures the game content area (safe area only, no phone bezel).
 * Returns a base64-encoded PNG data URL.
 *
 * Also exposed on window.__devkit__.captureScreen() for LLM/Playwright callers:
 *   await page.evaluate(() => window.__devkit__.captureScreen())
 */
export async function captureScreen(): Promise<string> {
  const el = document.getElementById('devkit-game-screen');
  if (!el) throw new Error('[devkit] #devkit-game-screen not found — is the Preview page active?');

  const canvas = await html2canvas(el, {
    width: CAPTURE_W,
    height: CAPTURE_H,
    scale: 2,
    logging: false,
    backgroundColor: null,
    useCORS: true,
    allowTaint: true,
  });

  return canvas.toDataURL('image/png');
}

export function downloadScreenshot(dataUrl: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `game-screenshot-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
