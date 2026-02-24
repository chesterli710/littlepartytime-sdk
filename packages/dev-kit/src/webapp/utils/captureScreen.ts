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
 * ## Why onclone?
 * html2canvas clones the entire document before rendering. The PhoneFrame DOM
 * has three CSS properties that break the capture:
 *
 * - `contain: paint` on Screen div and safe-area div — html2canvas uses
 *   getBoundingClientRect() to compute clip rects, which returns the *visual*
 *   (post-transform) size, clipping the output to ~half height.
 * - `transform: scale(x)` on the phone body — same getBoundingClientRect
 *   mismatch; intrinsic size is 390×751 but visual rect is smaller.
 * - `overflow: hidden` on ancestors — once transform is removed, the full-size
 *   phone body overflows its scaled wrapper and gets clipped.
 *
 * Fix: in the `onclone` callback, neutralise all three properties on ancestor
 * elements of the *cloned* document. The original DOM is never touched.
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
    onclone: (clonedDoc: Document) => {
      const clonedEl = clonedDoc.getElementById('devkit-game-screen');
      if (!clonedEl) return;

      let node: HTMLElement | null = clonedEl;
      while (node && node !== clonedDoc.body) {
        node.style.contain = '';
        node.style.transform = 'none';
        node.style.overflow = 'visible';
        node = node.parentElement;
      }
    },
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
