'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FootballCollageBackdrop } from '@/components/FootballCollageBackdrop';

const DEFAULT_CONTENT_URL = 'https://www.xoomsports.com';

export default function ThankYouPage() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [countdown, setCountdown] = useState(4);
  const [contentUrl, setContentUrl] = useState(DEFAULT_CONTENT_URL);

  useEffect(() => {
    const trxId = sessionStorage.getItem('trxId');
    if (!trxId) {
      router.replace('/');
      return;
    }

    fetch('/api/admin/config')
      .then(r => r.json())
      .then(cfg => {
        if (cfg.content_url) setContentUrl(cfg.content_url);
        if (cfg.redirect_to === 'content' && cfg.content_url) {
          window.location.href = cfg.content_url;
          return;
        }
      })
      .catch(() => {});

    const t = setTimeout(() => setShow(true), 100);

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(t);
      clearInterval(interval);
    };
  }, [router]);

  useEffect(() => {
    if (countdown === 0) {
      window.location.href = contentUrl;
    }
  }, [countdown, contentUrl]);

  return (
    <div className="min-h-screen bg-[#0b0e14] flex flex-col relative overflow-hidden">
      <FootballCollageBackdrop scrim="heavy" />
      <div className="pointer-events-none absolute inset-0 z-[1]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#e2383a]/6 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-green-500/5 rounded-full blur-[80px]" />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-[#e2383a] rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
          <span className="text-white font-extrabold text-lg tracking-tight">XOOM<span className="text-[#e2383a]">SPORTS</span></span>
        </div>
        <div className="flex items-center gap-1.5 bg-white/5 rounded-full px-3 py-1.5">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-[11px] text-white/70 font-semibold uppercase tracking-wider">Active</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-5 pb-8 relative z-10">
        <div className={`w-full max-w-sm transition-all duration-500 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="bg-[#141923]/85 backdrop-blur-xl rounded-2xl p-8 border border-white/10 text-center shadow-2xl shadow-black/40">
            {/* Success icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center relative">
                <div className="absolute inset-0 bg-green-500/5 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
                <svg className="w-10 h-10 text-green-500 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <h1 className="text-2xl font-black text-white mb-2">
              You&apos;re All Set!
            </h1>
            <p className="text-white/40 text-sm leading-relaxed mb-6">
              Your premium subscription is now active.<br/>Enjoy unlimited live football streaming.
            </p>

            {/* Features unlocked */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              <div className="bg-white/3 rounded-xl p-3 border border-white/5">
                <div className="text-xl mb-1">⚽</div>
                <div className="text-[10px] text-white/40 font-semibold">All Matches</div>
              </div>
              <div className="bg-white/3 rounded-xl p-3 border border-white/5">
                <div className="text-xl mb-1">📺</div>
                <div className="text-[10px] text-white/40 font-semibold">HD Quality</div>
              </div>
              <div className="bg-white/3 rounded-xl p-3 border border-white/5">
                <div className="text-xl mb-1">🏆</div>
                <div className="text-[10px] text-white/40 font-semibold">All Leagues</div>
              </div>
            </div>

            {/* Countdown */}
            <p className="text-white/25 text-xs mb-4">
              Redirecting in <span className="text-[#e2383a] font-bold">{countdown}s</span>
            </p>

            <button
              onClick={() => { window.location.href = contentUrl; }}
              className="w-full bg-[#e2383a] hover:bg-[#c42f31] text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2.5 text-base shadow-lg shadow-[#e2383a]/20"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
              Watch Now
            </button>

            <p className="text-[10px] text-white/15 mt-5 leading-relaxed">
              To unsubscribe, send <span className="text-white/25 font-medium">STOP</span> to{' '}
              <span className="text-white/25 font-medium">50995</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
