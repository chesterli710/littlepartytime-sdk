import React, { useRef, useState, useEffect } from 'react';

// iPhone 14/15 logical dimensions
const SCREEN_W = 390;
const SCREEN_H = 844;
const BEZEL = 8;
const OUTER_R = 48;
const INNER_R = OUTER_R - BEZEL;
const BODY_W = SCREEN_W + BEZEL * 2;
const BODY_H = SCREEN_H + BEZEL * 2;

export default function PhoneFrame({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const pad = 16;
      const s = Math.min(
        (el.clientWidth - pad * 2) / BODY_W,
        (el.clientHeight - pad * 2) / BODY_H,
        1,
      );
      setScale(Math.max(s, 0.3));
    };

    update();
    const ob = new ResizeObserver(update);
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center h-full overflow-hidden"
      style={{ flex: 1, minWidth: 0, minHeight: 0 }}
    >
      {/* Wrapper sized to the scaled phone for correct layout flow */}
      <div style={{ width: BODY_W * scale, height: BODY_H * scale, flexShrink: 0 }}>
        {/* Phone body at original pixel size, visually scaled */}
        <div
          className="relative"
          style={{
            width: BODY_W,
            height: BODY_H,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {/* Frame / bezel */}
          <div
            className="absolute inset-0"
            style={{
              borderRadius: OUTER_R,
              background: '#1c1c1e',
              boxShadow:
                '0 0 0 1px rgba(255,255,255,0.1), 0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
          />

          {/* Screen */}
          <div
            className="absolute overflow-hidden bg-black"
            style={{
              top: BEZEL,
              left: BEZEL,
              width: SCREEN_W,
              height: SCREEN_H,
              borderRadius: INNER_R,
              contain: 'paint',
            }}
          >
            {children}
          </div>

          {/* Dynamic Island */}
          <div
            className="absolute left-1/2 -translate-x-1/2 bg-black rounded-full"
            style={{ top: BEZEL + 11, width: 126, height: 37, zIndex: 10 }}
          />

          {/* Home Indicator */}
          <div
            className="absolute left-1/2 -translate-x-1/2 rounded-full"
            style={{
              bottom: BEZEL + 8,
              width: 134,
              height: 5,
              background: 'rgba(255,255,255,0.15)',
              zIndex: 10,
            }}
          />
        </div>
      </div>
    </div>
  );
}
