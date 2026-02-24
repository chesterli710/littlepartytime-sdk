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
 *
 * ## Strategy: clone into a mobile-viewport-sized container
 *
 * All LPT games are designed for full-screen mobile. In the dev-kit, the game
 * renders inside PhoneFrame which wraps it in transform:scale + contain:paint.
 * html2canvas cannot correctly capture elements inside this hierarchy because
 * getBoundingClientRect() returns the scaled visual size, not the natural size.
 *
 * Instead of fighting html2canvas, we deep-clone the game DOM subtree into a
 * standalone 390×751 container appended to <body> — no transforms, no contain,
 * no overflow clipping from ancestors. The game content is designed for exactly
 * this size, so it renders correctly. html2canvas captures the clean container
 * with no coordinate mismatches.
 */
export async function captureScreen(): Promise<string> {
  const el = document.getElementById('devkit-game-screen');
  if (!el) throw new Error('[devkit] #devkit-game-screen not found — is the Preview page active?');

  // Deep-clone the safe-area subtree into a standalone mobile-sized container.
  const clone = el.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  clone.removeAttribute('data-testid');
  clone.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    width: ${CAPTURE_W}px;
    height: ${CAPTURE_H}px;
    overflow: hidden;
  `;
  document.body.appendChild(clone);

  try {
    const canvas = await html2canvas(clone, {
      width: CAPTURE_W,
      height: CAPTURE_H,
      scale: 2,
      logging: false,
      backgroundColor: null,
      useCORS: true,
      allowTaint: true,
    });
    return canvas.toDataURL('image/png');
  } finally {
    document.body.removeChild(clone);
  }
}

export function downloadScreenshot(dataUrl: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `game-screenshot-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
