'use client';

import { useRef, useEffect, useState } from 'react';

const VIDEO_MP4 = '/videos/match-bg.mp4';
/** Optional poster while video loads; ignored if missing in browser */
const POSTER = '/football.png';

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
 * Full-bleed muted loop video (match / stadium feel). Falls back to poster image on error.
 * Replace `public/videos/match-bg.mp4` with your own royalty-free football clip.
 */
export function HeroMatchBackdrop({ scrim = 'medium', className = '' }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoOk, setVideoOk] = useState(true);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const fail = () => setVideoOk(false);
    v.addEventListener('error', fail);
    const p = v.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
    return () => v.removeEventListener('error', fail);
  }, []);

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}
      aria-hidden
    >
      {videoOk ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover object-center"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={POSTER}
        >
          <source src={VIDEO_MP4} type="video/mp4" />
        </video>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={POSTER}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center bg-[#0b0e14]"
        />
      )}
      <div
        className={`absolute inset-0 bg-gradient-to-b ${scrimClass[scrim]}`}
      />
      <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.5)]" />
    </div>
  );
}
