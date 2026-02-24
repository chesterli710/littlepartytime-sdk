import React, { useRef, useState, useEffect } from 'react';

// iPhone 14/15 logical dimensions
const SCREEN_W = 390;
const SCREEN_H = 844;
const BEZEL = 8;
const OUTER_R = 48;
const INNER_R = OUTER_R - BEZEL;
const BODY_W = SCREEN_W + BEZEL * 2;
const BODY_H = SCREEN_H + BEZEL * 2;

// iPhone 14/15 safe area insets (portrait)
const SAFE_AREA_TOP = 59; // Dynamic Island
const SAFE_AREA_BOTTOM = 34; // Home Indicator

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
      style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', overflow: 'hidden' }}
    >
      {/* Wrapper sized to the scaled phone for correct layout flow */}
      <div style={{ width: BODY_W * scale, height: BODY_H * scale, flexShrink: 0 }}>
        {/* Phone body at original pixel size, visually scaled */}
        <div
          style={{
            position: 'relative',
            width: BODY_W,
            height: BODY_H,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {/* Frame / bezel */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: OUTER_R,
              background: '#1c1c1e',
              boxShadow:
                '0 0 0 1px rgba(255,255,255,0.1), 0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
          />

          {/* Screen */}
          <div
            style={{
              position: 'absolute',
              overflow: 'hidden',
              background: '#000',
              top: BEZEL,
              left: BEZEL,
              width: SCREEN_W,
              height: SCREEN_H,
              borderRadius: INNER_R,
              contain: 'paint',
            }}
          >
            {/* Safe area: game content is constrained here.
                contain:paint makes this the containing block for
                position:fixed elements inside the game. */}
            <div
              id="devkit-game-screen"
              data-testid="game-screen"
              style={{
                position: 'absolute',
                overflow: 'hidden',
                top: SAFE_AREA_TOP,
                left: 0,
                right: 0,
                bottom: SAFE_AREA_BOTTOM,
                contain: 'paint',
              }}
            >
              {children}
            </div>
          </div>

          {/* Dynamic Island */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#000',
              borderRadius: 9999,
              top: BEZEL + 11,
              width: 126,
              height: 37,
              zIndex: 10,
            }}
          />

          {/* Home Indicator */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              borderRadius: 9999,
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
