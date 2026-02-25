import html2canvas from 'html2canvas';

// PhoneFrame body width (bezel included): 390 + 8*2
const PHONE_W = 406;

/**
 * Captures the phone model (game content + bezel frame) as a PNG.
 * Returns a base64-encoded data URL.
 *
 * Also exposed on window.__devkit__.captureScreen() for LLM/Playwright callers:
 *   await page.evaluate(() => window.__devkit__.captureScreen())
 *
 * ## Strategy: capture from documentElement with visual crop
 *
 * The phone body lives inside transform:scale(x) + contain:paint, which makes
 * its getBoundingClientRect() return the *visual* (scaled) size. Previous
 * attempts to target the game element directly all failed because html2canvas
 * reads the target's bounding rect first, then clones — the crop coordinates
 * never agree with the clone's layout.
 *
 * By targeting document.documentElement and passing the phone body's visual
 * bounding rect as an explicit crop, html2canvas renders the full page as-is
 * (all CSS respected) and simply cuts out the phone region. Crop coordinates
 * equal visual coordinates — no mismatch possible.
 */
export async function captureScreen(): Promise<string> {
  const phone = document.getElementById('devkit-phone');
  if (!phone) throw new Error('[devkit] #devkit-phone not found — is the Preview page active?');

  const rect = phone.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    throw new Error('[devkit] phone frame has zero dimensions');
  }

  // Upsample so the output matches the phone's natural size at 2× retina.
  const outputScale = (PHONE_W * 2) / rect.width;

  const canvas = await html2canvas(document.documentElement, {
    x: rect.left + window.scrollX,
    y: rect.top + window.scrollY,
    width: rect.width,
    height: rect.height,
    scale: outputScale,
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
