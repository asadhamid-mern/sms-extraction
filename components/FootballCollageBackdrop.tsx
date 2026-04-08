'use client';

import { useMemo, type CSSProperties } from 'react';

const TILE_IMAGES = ['/football.png', '/real-madrid.png', '/barcelona.png'] as const;
const TILE_COUNT = 48;

type Scrim = 'light' | 'medium' | 'heavy';

type Props = {
  scrim?: Scrim;
  className?: string;
};

const scrimClass: Record<Scrim, string> = {
  light: 'from-[#0b0e14]/35 via-[#0b0e14]/55 to-[#0b0e14]/78',
  medium: 'from-[#0b0e14]/45 via-[#0b0e14]/72 to-[#0b0e14]/90',
  heavy: 'from-[#0b0e14]/55 via-[#0b0e14]/82 to-[#0b0e14]/96',
};

/**
 * Looping backdrop: one large football image zooms in/out, then a tilted collage of
 * repeated football club tiles (same assets as the landing match-up). CSS lives in
 * `/football-collage-backdrop.css` (also linked from the standalone OTP HTML page).
 */
export function FootballCollageBackdrop({ scrim = 'medium', className = '' }: Props) {
  const tiles = useMemo(
    () =>
      Array.from({ length: TILE_COUNT }, (_, i) => ({
        src: TILE_IMAGES[i % TILE_IMAGES.length],
        rot: ((i * 13) % 19) - 9,
      })),
    []
  );

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#06060a] hero-bg fcb-perspective ${className}`}
      aria-hidden
    >
      <div className="fcb-collage-wrap">
        <div className="fcb-collage-inner">
          <div className="fcb-grid">
            {tiles.map((t, i) => (
              <div
                key={i}
                className="fcb-tile"
                style={
                  {
                    '--fcb-rot': t.rot,
                    backgroundImage: `url('${t.src}')`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        </div>
      </div>
      <div className="fcb-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/football.png"
          alt=""
          className="fcb-hero-img"
          width={1200}
          height={800}
          decoding="async"
        />
      </div>
      <div
        className={`absolute inset-0 z-[1] bg-gradient-to-b ${scrimClass[scrim]}`}
      />
      <div className="absolute inset-0 z-[1] shadow-[inset_0_0_120px_rgba(0,0,0,0.5)]" />
    </div>
  );
}
