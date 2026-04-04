'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { generateTransactionId } from '@/lib/utils';
import { logTransaction, updateTransactionStatus } from '@/lib/supabase';

type PageState = 'loading' | 'manual_input' | 'error';

const HE_BASE_URL =
  'http://20.8.168.69/hepage/he.aspx';

export default function LandingPage() {
  const [state, setState] = useState<PageState>('loading');
  const [manualNumber, setManualNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const initialized = useRef(false);

  const dbg = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    const line = `[${ts}] ${msg}`;
    console.log('[Landing]', line);
    setDebugLines(prev => [...prev, line]);
  }, []);

  const goToOTPPage = useCallback(
    async ({
      msisdn,
      trxId,
      userIP,
    }: {
      msisdn: string;
      trxId: string;
      userIP: string;
    }) => {
      try {
        sessionStorage.setItem('msisdn', msisdn);
        sessionStorage.setItem('trxId', trxId);
        await updateTransactionStatus(trxId, 'pin_requested');
        window.location.href = `/api/otp-page?msisdn=${encodeURIComponent(msisdn)}&trxId=${encodeURIComponent(trxId)}&userIP=${encodeURIComponent(userIP)}`;
      } catch (err) {
        dbg('Navigation error: ' + String(err));
        setErrorMsg('Network error. Please check your connection and try again.');
        setState('error');
      }
    },
    [dbg]
  );

  const initFlow = useCallback(async () => {
    dbg('Landing page loaded');
    dbg('URL: ' + window.location.href);

    const params = new URLSearchParams(window.location.search);
    const getParam = (key: string) =>
      params.get(key) ??
      params.get(key.toLowerCase()) ??
      params.get(key.toUpperCase()) ??
      null;

    const msisdnParam = getParam('msisdn');
    const statusParam  = getParam('status');
    // Carrier may return trxid, trid, or TrxId — all must resolve to the same session id
    const trxidParam =
      getParam('trxid') ?? getParam('trid') ?? getParam('TrxId') ?? getParam('TRXID');

    dbg(
      'URL params: msisdn=' +
        (msisdnParam || 'NONE') +
        ' status=' +
        (statusParam || 'NONE') +
        ' trxId=' +
        (trxidParam || 'NONE')
    );

    const userAgent = navigator.userAgent;
    const isSuccess = statusParam?.toLowerCase() === 'success';

    // Only fetch IP when we actually need it (HE returned MSISDN)
    async function getUserIP() {
      try {
        const ipRes = await fetch('/api/get-ip');
        const ipData = await ipRes.json();
        dbg('User IP: ' + ipData.ip);
        return ipData.ip;
      } catch (e) {
        dbg('Failed to get IP: ' + String(e));
        return '127.0.0.1';
      }
    }

    if (msisdnParam && isSuccess) {
      dbg('HE SUCCESS — MSISDN detected: ' + msisdnParam);
      let trxId = sessionStorage.getItem('trxId');
      if (!trxId) trxId = trxidParam || generateTransactionId();
      const msisdn = msisdnParam.startsWith('965') ? msisdnParam : `965${msisdnParam}`;
      dbg('Normalized MSISDN: ' + msisdn + ' | TrxId: ' + trxId);
      sessionStorage.setItem('msisdn', msisdn);
      sessionStorage.setItem('trxId', trxId);
      window.history.replaceState({}, '', '/');
      const userIP = await getUserIP();
      dbg('Navigating to OTP page...');
      await goToOTPPage({ msisdn, trxId, userIP });
    } else if (msisdnParam && !isSuccess) {
      dbg('HE returned MSISDN but status="' + statusParam + '" — proceeding anyway');
      let trxId = sessionStorage.getItem('trxId');
      if (!trxId) trxId = trxidParam || generateTransactionId();
      const msisdn = msisdnParam.startsWith('965') ? msisdnParam : `965${msisdnParam}`;
      sessionStorage.setItem('msisdn', msisdn);
      sessionStorage.setItem('trxId', trxId);
      window.history.replaceState({}, '', '/');
      const userIP = await getUserIP();
      dbg('Navigating to OTP page with MSISDN: ' + msisdn);
      await goToOTPPage({ msisdn, trxId, userIP });
    } else if (statusParam && !msisdnParam) {
      dbg('HE FAILED — status="' + statusParam + '" but NO msisdn returned');
      setState('manual_input');
    } else {
      dbg('First visit — no HE params detected');
      let trxId = sessionStorage.getItem('trxId');
      if (!trxId) {
        trxId = generateTransactionId();
        sessionStorage.setItem('trxId', trxId);
      }
      dbg('TrxId: ' + trxId);

      const isLocalhost =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.');

      if (isLocalhost) {
        dbg('Localhost detected — skipping HE redirect, showing manual input');
        setState('manual_input');
        return;
      }

      // Redirect to HE immediately — don't wait for IP/Supabase
      const heUrl = `${HE_BASE_URL}?Spname=mobility&trxId=${trxId}`;
      dbg('Redirecting to HE: ' + heUrl);
      sessionStorage.setItem('he_redirect_ts', String(Date.now()));
      window.location.href = heUrl;

      // Log to Supabase in background (non-blocking, page is already redirecting)
      getUserIP().then(ip => {
        logTransaction({
          transaction_id: trxId!,
          msisdn: '',
          status: 'initiated',
          user_ip: ip,
          user_agent: userAgent,
        }).catch(() => {});
      });
    }
  }, [goToOTPPage, dbg]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    initFlow();
  }, [initFlow]);

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualNumber || manualNumber.length < 7) return;
    setIsSubmitting(true);

    let userIP = '127.0.0.1';
    try {
      const ipRes = await fetch('/api/get-ip');
      const ipData = await ipRes.json();
      userIP = ipData.ip;
    } catch {}

    const userAgent = navigator.userAgent;
    const trxId = sessionStorage.getItem('trxId') || generateTransactionId();
    sessionStorage.setItem('trxId', trxId);

    const msisdn = manualNumber.startsWith('965') ? manualNumber : `965${manualNumber}`;
    sessionStorage.setItem('msisdn', msisdn);

    try {
      await logTransaction({
        transaction_id: trxId,
        msisdn,
        status: 'initiated',
        user_ip: userIP,
        user_agent: userAgent,
      });
    } catch {}

    await goToOTPPage({ msisdn, trxId, userIP });
    setIsSubmitting(false);
  }

  function handleRetry() {
    setState('loading');
    setErrorMsg('');
    initialized.current = false;
    initFlow();
  }

  const debugPanel = (
    <div className="mt-4 w-full">
      <button
        onClick={() => setShowDebug(v => !v)}
        className="text-xs text-white/20 underline w-full text-center"
      >
        {showDebug ? 'Hide' : 'Show'} technical details
      </button>
      {showDebug && debugLines.length > 0 && (
        <pre className="mt-2 text-xs text-left bg-black/40 text-white/60 rounded-lg p-3 break-all whitespace-pre-wrap max-h-60 overflow-auto font-mono leading-relaxed">
          {debugLines.join('\n')}
        </pre>
      )}
    </div>
  );

  // ── Error state ──────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-[#141923] rounded-2xl p-8 border border-white/5 shadow-2xl">
            <div className="w-20 h-20 bg-red-500/10 rounded-full mx-auto mb-5 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Connection Error</h2>
            <p className="text-white/50 text-sm mb-6">{errorMsg}</p>
            <button
              onClick={handleRetry}
              className="w-full bg-[#e2383a] hover:bg-[#c42f31] text-white font-bold py-3.5 rounded-xl transition-all"
            >
              Try Again
            </button>
            <button
              onClick={() => setState('manual_input')}
              className="mt-3 w-full text-[#e2383a] text-sm font-medium"
            >
              Enter number manually
            </button>
          </div>
          {debugPanel}
        </div>
      </div>
    );
  }

  // ── Manual input ────────────────────────────────────────────────────────
  if (state === 'manual_input') {
    return (
      <div className="min-h-screen bg-[#0b0e14] flex flex-col relative overflow-hidden">
        {/* Hero background image */}
        <div className="absolute inset-0 pointer-events-none">
          <img src="/football.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b0e14]/60 via-[#0b0e14]/80 to-[#0b0e14]" />
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
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-[11px] text-white/70 font-semibold uppercase tracking-wider">Live</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-5 pb-8 relative z-10">
          <div className="w-full max-w-sm">
            {/* Live match card */}
            <div className="bg-gradient-to-br from-[#1a1f2e] to-[#141923] rounded-2xl p-5 border border-white/5 mb-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Featured Match</span>
                <div className="flex items-center gap-1.5 bg-red-500/15 rounded-full px-2.5 py-1">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-[10px] text-red-400 font-bold uppercase">Live Now</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex flex-col items-center gap-2 flex-1">
                  <img src="/real-madrid.png" alt="Real Madrid" className="w-12 h-12 object-contain drop-shadow-lg" />
                  <span className="text-white text-xs font-bold text-center">Real Madrid</span>
                </div>
                <div className="flex flex-col items-center gap-1 px-4">
                  <div className="flex items-center gap-3">
                    <span className="text-white text-2xl font-black">2</span>
                    <span className="text-white/30 text-lg">-</span>
                    <span className="text-white text-2xl font-black">1</span>
                  </div>
                  <span className="text-[10px] text-[#e2383a] font-bold">78&apos;</span>
                </div>
                <div className="flex flex-col items-center gap-2 flex-1">
                  <img src="/barcelona.png" alt="Barcelona" className="w-12 h-12 object-contain drop-shadow-lg" />
                  <span className="text-white text-xs font-bold text-center">Barcelona</span>
                </div>
              </div>
            </div>

            {/* Leagues */}
            <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none">
              {['Premier League', 'La Liga', 'Serie A', 'UCL'].map((league) => (
                <div key={league} className="shrink-0 bg-white/5 border border-white/5 rounded-full px-3.5 py-1.5 text-[11px] text-white/60 font-semibold">
                  {league}
                </div>
              ))}
            </div>

            {/* Main card */}
            <div className="bg-[#141923] rounded-2xl p-6 border border-white/5">
              <h1 className="text-2xl font-black text-white leading-tight mb-1">
                Watch Every Match<br/><span className="text-[#e2383a]">Live & Unlimited</span>
              </h1>
              <p className="text-white/40 text-sm mb-6">
                Get instant access to all live football matches in HD quality
              </p>

              <form onSubmit={handleManualSubmit} noValidate>
                <label className="block text-white/50 text-xs font-semibold mb-2 uppercase tracking-wider">
                  Mobile Number
                </label>
                <div className="flex border border-white/10 rounded-xl overflow-hidden mb-4 focus-within:border-[#e2383a]/50 transition-colors bg-white/5">
                  <div className="flex items-center px-3.5 border-r border-white/10 gap-2 shrink-0 bg-white/3">
                    <span className="text-lg leading-none">🇰🇼</span>
                    <span className="text-white/70 font-bold text-sm">+965</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={manualNumber}
                    onChange={(e) => setManualNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter your number"
                    className="flex-1 px-3.5 py-4 text-white text-base outline-none bg-transparent placeholder:text-white/20 font-medium"
                    maxLength={8}
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || manualNumber.length < 7}
                  className="w-full bg-[#e2383a] hover:bg-[#c42f31] disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2.5 text-base shadow-lg shadow-[#e2383a]/20 disabled:shadow-none"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <span>Start Watching</span>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </>
                  )}
                </button>
              </form>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-white/5">
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

            {/* Trust footer */}
            <div className="flex items-center justify-center gap-5 mt-5">
              <div className="flex items-center gap-1.5 text-white/25 text-[11px] font-medium">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Secure
              </div>
              <div className="flex items-center gap-1.5 text-white/25 text-[11px] font-medium">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Verified
              </div>
              <div className="flex items-center gap-1.5 text-white/25 text-[11px] font-medium">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Instant
              </div>
            </div>

            <p className="text-[10px] text-white/15 text-center mt-4 leading-relaxed">
              By subscribing you agree to our Terms &amp; Conditions.
              Standard operator charges apply.
            </p>

            {debugPanel}
          </div>
        </div>
      </div>
    );
  }

  // ── Loading / verifying state ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0b0e14] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <img src="/football.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-[#0b0e14]/85" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="bg-[#141923] rounded-2xl p-10 border border-white/5 shadow-2xl text-center">
          <div className="flex items-center justify-center gap-2.5 mb-8">
            <div className="w-9 h-9 bg-[#e2383a] rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </div>
            <span className="text-white font-extrabold text-lg tracking-tight">XOOM<span className="text-[#e2383a]">SPORTS</span></span>
          </div>

          <div className="w-12 h-12 border-[3px] border-[#e2383a]/30 border-t-[#e2383a] rounded-full animate-spin mx-auto mb-6" />

          <p className="text-white font-bold text-lg">Detecting your network...</p>
          <p className="text-white/30 text-sm mt-1">This will only take a moment</p>
          <button
            onClick={() => setState('manual_input')}
            className="mt-5 text-[#e2383a] text-sm font-medium hover:underline"
          >
            Enter number manually
          </button>
        </div>

        {debugPanel}
      </div>
    </div>
  );
}
