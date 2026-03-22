'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const DEFAULT_CONTENT_URL = 'https://www.xoomsports.com';

export default function ThankYouPage() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [contentUrl, setContentUrl] = useState(DEFAULT_CONTENT_URL);

  useEffect(() => {
    const trxId = sessionStorage.getItem('trxId');
    if (!trxId) {
      router.replace('/');
      return;
    }

    // Fetch dynamic content URL from config
    fetch('/api/admin/config')
      .then(r => r.json())
      .then(cfg => {
        if (cfg.content_url) setContentUrl(cfg.content_url);
        // If redirect_to is 'content', go directly to content URL
        if (cfg.redirect_to === 'content' && cfg.content_url) {
          window.location.href = cfg.content_url;
          return;
        }
      })
      .catch(() => {});

    const t = setTimeout(() => setShow(true), 100);

    // Auto-redirect countdown
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          // Will use latest contentUrl from state
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

  // Redirect when countdown hits 0
  useEffect(() => {
    if (countdown === 0) {
      window.location.href = contentUrl;
    }
  }, [countdown, contentUrl]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1628] via-[#0d1f3c] to-[#0a1628] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className={`w-full max-w-md relative z-10 transition-all duration-500 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl text-center">
          {/* Success animation */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center relative">
              <div className="absolute inset-0 bg-emerald-500/10 rounded-full animate-ping" />
              <svg className="w-12 h-12 text-emerald-400 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-extrabold text-white mb-2">
            You&apos;re Subscribed!
          </h1>
          <p className="text-white/50 text-sm leading-relaxed mb-6">
            Welcome to XoomSports! Enjoy live football streaming.
          </p>

          {/* Countdown */}
          <p className="text-white/40 text-xs mb-4">
            Redirecting to content in <span className="text-emerald-400 font-bold">{countdown}s</span>...
          </p>

          <button
            onClick={() => { window.location.href = contentUrl; }}
            className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 text-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            </svg>
            Watch Now
          </button>

          <p className="text-xs text-white/25 mt-6 leading-relaxed">
            To unsubscribe, send <span className="font-medium text-white/40">STOP</span> to{' '}
            <span className="font-medium text-white/40">50995</span> or contact support.
          </p>
        </div>
      </div>
    </div>
  );
}
