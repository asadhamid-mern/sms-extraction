'use client';

import { useEffect, useState, useCallback } from 'react';
import { FootballCollageBackdrop } from '@/components/FootballCollageBackdrop';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, config: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export default function GoogleSignInPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [countryCode, setCountryCode] = useState('');

  const handleCredentialResponse = useCallback(async (response: { credential: string }) => {
    setSigningIn(true);
    setError('');

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken: response.credential,
          countryCode,
        }),
      });

      const data = await res.json();

      if (data.success && data.sessionToken) {
        sessionStorage.setItem('session_token', data.sessionToken);
        sessionStorage.setItem('user_email', data.user?.email || '');
        sessionStorage.setItem('user_name', data.user?.name || '');
        // Redirect to phone verification
        window.location.href = '/auth/verify-phone';
      } else {
        setError(data.error || 'Sign-in failed. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setSigningIn(false);
    }
  }, [countryCode]);

  useEffect(() => {
    // Detect country
    fetch('/api/detect-country')
      .then(r => r.json())
      .then(d => setCountryCode(d.countryCode || ''))
      .catch(() => {});

    // Load Google Identity Services
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setLoading(false);
    };
    script.onerror = () => {
      setError('Failed to load Google Sign-In');
      setLoading(false);
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (loading || !window.google) return;

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError('Google Client ID not configured');
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredentialResponse,
      auto_select: false,
    });

    const btnEl = document.getElementById('google-signin-btn');
    if (btnEl) {
      window.google.accounts.id.renderButton(btnEl, {
        theme: 'filled_black',
        size: 'large',
        width: 320,
        shape: 'pill',
        text: 'continue_with',
      });
    }
  }, [loading, handleCredentialResponse]);

  return (
    <div className="min-h-screen bg-[#0b0e14] flex flex-col relative overflow-hidden">
      <FootballCollageBackdrop scrim="heavy" />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-[#e2383a] rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
          <span className="text-white font-extrabold text-lg tracking-tight">GOAL<span className="text-[#e2383a]">NOWX</span></span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-8 relative z-10">
        <div className="w-full max-w-sm">
          <div className="bg-[#141923]/90 backdrop-blur-xl rounded-2xl p-8 border border-white/10 shadow-2xl text-center">
            {/* Icon */}
            <div className="w-20 h-20 bg-[#e2383a]/10 rounded-full mx-auto mb-6 flex items-center justify-center">
              <svg className="w-10 h-10 text-[#e2383a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>

            <h1 className="text-2xl font-black text-white mb-2">Welcome to GoalNowX</h1>
            <p className="text-white/40 text-sm mb-8 leading-relaxed">
              Sign in to access live football matches,<br/>
              scores, and highlights worldwide.
            </p>

            {signingIn ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-[3px] border-[#e2383a]/20 border-t-[#e2383a] rounded-full animate-spin" />
                <span className="text-white/40 text-sm">Signing you in...</span>
              </div>
            ) : (
              <>
                <div id="google-signin-btn" className="flex justify-center mb-4" />

                {loading && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-[3px] border-white/10 border-t-white/40 rounded-full animate-spin" />
                    <span className="text-white/30 text-xs">Loading sign-in...</span>
                  </div>
                )}
              </>
            )}

            {error && (
              <p className="text-red-400 text-sm mt-4">{error}</p>
            )}

            {/* Features */}
            <div className="grid grid-cols-3 gap-3 mt-8 pt-6 border-t border-white/5">
              <div className="text-center">
                <div className="text-white font-black text-lg">500+</div>
                <div className="text-white/30 text-[10px] font-semibold uppercase tracking-wider">Matches</div>
              </div>
              <div className="text-center">
                <div className="text-white font-black text-lg">50+</div>
                <div className="text-white/30 text-[10px] font-semibold uppercase tracking-wider">Leagues</div>
              </div>
              <div className="text-center">
                <div className="text-white font-black text-lg">HD</div>
                <div className="text-white/30 text-[10px] font-semibold uppercase tracking-wider">Quality</div>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-white/15 text-center mt-5 leading-relaxed">
            By signing in you agree to our Terms &amp; Conditions.
          </p>
        </div>
      </div>
    </div>
  );
}
