import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QrModalProps {
  url: string;
  onClose: () => void;
}

export default function QrModal({ url, onClose }: QrModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: 280,
      margin: 2,
      color: { dark: '#000', light: '#fff' },
    }).catch(() => setError('Failed to generate QR code'));
  }, [url]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#18181b', borderRadius: 16, padding: 24,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          border: '1px solid #3f3f46',
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e5e5e5' }}>Scan to play on mobile</h3>
        {error ? (
          <div style={{ color: '#ef4444', fontSize: 14 }}>{error}</div>
        ) : (
          <canvas ref={canvasRef} style={{ borderRadius: 8 }} />
        )}
        <div style={{ fontSize: 13, color: '#a1a1aa', wordBreak: 'break-all', maxWidth: 280, textAlign: 'center' }}>
          {url}
        </div>
        <button
          onClick={onClose}
          style={{ background: '#3f3f46', color: '#d4d4d8', border: 'none', padding: '8px 24px', borderRadius: 6, fontSize: 14, cursor: 'pointer' }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
