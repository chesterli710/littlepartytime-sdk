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
 * ## Why the style normalization?
 * The PhoneFrame has two CSS properties that break html2canvas:
 *
 * 1. `contain: paint` on Screen div and safe-area div — html2canvas uses
 *    getBoundingClientRect() to determine clip rects. With a scaled ancestor,
 *    getBoundingClientRect() returns the *visual* (post-transform) size. Combined
 *    with contain:paint, html2canvas clips the rendered output to the visual height
 *    (e.g. 375px at 0.5× scale) even though the canvas is 751px tall, leaving the
 *    bottom half black.
 *
 * 2. `transform: scale(x)` on the phone body — causes the same getBoundingClientRect
 *    mismatch; the element's intrinsic size is 390×751 but its visual rect is smaller.
 *
 * Fix: temporarily set both to neutral values, wait two rAF ticks for the browser to
 * apply the changes, run html2canvas, then restore. An invisible overlay prevents the
 * user from seeing the brief layout shift.
 */
export async function captureScreen(): Promise<string> {
  const el = document.getElementById('devkit-game-screen');
  if (!el) throw new Error('[devkit] #devkit-game-screen not found — is the Preview page active?');

  // Invisible overlay so the user never sees the brief style normalization flash.
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;';
  document.body.appendChild(overlay);

  // Wait for overlay to paint before touching any styles.
  await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  // Walk up the DOM and neutralise contain:paint and transform:scale on all ancestors.
  const saved: Array<[HTMLElement, 'contain' | 'transform', string]> = [];
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    for (const prop of ['contain', 'transform'] as const) {
      if (node.style[prop]) {
        saved.push([node, prop, node.style[prop]]);
        node.style[prop] = prop === 'transform' ? 'none' : '';
      }
    }
    node = node.parentElement;
  }

  // Wait for the browser to reflow/repaint with the normalised styles.
  await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
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
  } finally {
    // Restore styles and remove overlay regardless of success/failure.
    for (const [node, prop, val] of saved) node.style[prop] = val;
    document.body.removeChild(overlay);
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
