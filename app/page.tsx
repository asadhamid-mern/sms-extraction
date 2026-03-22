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
    const trxidParam   = getParam('trxid');

    dbg('URL params: msisdn=' + (msisdnParam || 'NONE') + ' status=' + (statusParam || 'NONE') + ' trxid=' + (trxidParam || 'NONE'));

    let userIP = '127.0.0.1';
    try {
      const ipRes = await fetch('/api/get-ip');
      const ipData = await ipRes.json();
      userIP = ipData.ip;
      dbg('User IP: ' + userIP);
    } catch (e) {
      dbg('Failed to get IP: ' + String(e));
    }

    const userAgent = navigator.userAgent;
    const isSuccess = statusParam?.toLowerCase() === 'success';

    if (msisdnParam && isSuccess) {
      dbg('HE SUCCESS — MSISDN detected: ' + msisdnParam);
      let trxId = sessionStorage.getItem('trxId');
      if (!trxId) trxId = trxidParam || generateTransactionId();
      const msisdn = msisdnParam.startsWith('965') ? msisdnParam : `965${msisdnParam}`;
      dbg('Normalized MSISDN: ' + msisdn + ' | TrxId: ' + trxId);
      sessionStorage.setItem('msisdn', msisdn);
      sessionStorage.setItem('trxId', trxId);
      window.history.replaceState({}, '', '/');
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

      try {
        await logTransaction({
          transaction_id: trxId,
          msisdn: '',
          status: 'initiated',
          user_ip: userIP,
          user_agent: userAgent,
        });
      } catch (e) {
        dbg('Supabase log error (non-blocking): ' + String(e));
      }

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

      const heUrl = `${HE_BASE_URL}?Spname=mobility&trxId=${trxId}`;
      dbg('Redirecting to HE: ' + heUrl);
      window.location.href = heUrl;
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

  // ── Debug panel ──────────────────────────────────────────────────────────
  const debugPanel = (
    <div className="mt-4 w-full">
      <button
        onClick={() => setShowDebug(v => !v)}
        className="text-xs text-white/30 underline w-full text-center"
      >
        {showDebug ? 'Hide' : 'Show'} technical details
      </button>
      {showDebug && debugLines.length > 0 && (
        <pre className="mt-2 text-xs text-left bg-black/30 text-white/70 rounded-lg p-3 break-all whitespace-pre-wrap max-h-60 overflow-auto font-mono leading-relaxed">
          {debugLines.join('\n')}
        </pre>
      )}
    </div>
  );

  // ── Error state ──────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a1628] via-[#0d1f3c] to-[#0a1628] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl">
            <div className="w-20 h-20 bg-red-500/20 rounded-full mx-auto mb-5 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-white/60 text-sm mb-6">{errorMsg}</p>
            <button
              onClick={handleRetry}
              className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/25"
            >
              Try Again
            </button>
            <button
              onClick={() => setState('manual_input')}
              className="mt-3 w-full text-emerald-400 text-sm underline"
            >
              Enter number manually
            </button>
          </div>
          {debugPanel}
        </div>
      </div>
    );
  }

  // ── Manual input fallback ────────────────────────────────────────────────
  if (state === 'manual_input') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a1628] via-[#0d1f3c] to-[#0a1628] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
          {/* Football field lines */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] border border-white/[0.03] rounded-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 border border-white/[0.03] rounded-full" />
        </div>

        <div className="w-full max-w-md relative z-10">
          {/* Header with branding */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-600 rounded-2xl shadow-lg shadow-emerald-500/30 mb-4">
              <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M12 2C12 2 14.5 6 14.5 12S12 22 12 22M12 2C12 2 9.5 6 9.5 12S12 22 12 22M2 12h20M3.5 7h17M3.5 17h17" fill="none" stroke="currentColor" strokeWidth="1"/>
              </svg>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              XoomSports
            </h1>
            <p className="text-emerald-400/80 text-sm font-medium mt-1">LIVE Football Streaming</p>
          </div>

          {/* Card */}
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-7 border border-white/10 shadow-2xl">
            {/* Feature highlights */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white text-xs font-bold border-2 border-[#0d1f3c]">⚽</div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold border-2 border-[#0d1f3c]">🏆</div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold border-2 border-[#0d1f3c]">📺</div>
              </div>
              <div>
                <p className="text-white text-sm font-semibold">Premium Access</p>
                <p className="text-white/50 text-xs">All leagues, all matches</p>
              </div>
            </div>

            <h2 className="text-xl font-bold text-white mb-1">
              Enter Your Number
            </h2>
            <p className="text-white/50 text-sm mb-5">
              Subscribe to watch live football matches
            </p>

            <form onSubmit={handleManualSubmit} noValidate>
              <div className="flex border-2 border-white/20 rounded-xl overflow-hidden mb-4 focus-within:border-emerald-500/60 transition-colors bg-white/5">
                <div className="flex items-center px-3 border-r border-white/20 gap-1.5 shrink-0">
                  <span className="text-xl leading-none">🇰🇼</span>
                  <span className="text-white/80 font-semibold text-sm">+965</span>
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={manualNumber}
                  onChange={(e) => setManualNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="50000000"
                  className="flex-1 px-3 py-3.5 text-white text-base outline-none min-h-[48px] bg-transparent placeholder:text-white/30"
                  maxLength={8}
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || manualNumber.length < 7}
                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/25 disabled:shadow-none flex items-center justify-center gap-2 text-lg"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>Watch Now</span>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Trust signals */}
            <div className="flex items-center justify-center gap-4 mt-5">
              <div className="flex items-center gap-1 text-white/40 text-xs">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Secure
              </div>
              <div className="flex items-center gap-1 text-white/40 text-xs">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Verified
              </div>
              <div className="flex items-center gap-1 text-white/40 text-xs">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Instant
              </div>
            </div>

            <p className="text-xs text-white/30 text-center mt-4 leading-relaxed">
              By subscribing you agree to our{' '}
              <span className="text-emerald-400/60 underline cursor-pointer">Terms &amp; Conditions</span>.
              Standard operator charges may apply.
            </p>
          </div>

          {debugPanel}
        </div>
      </div>
    );
  }

  // ── Loading / verifying state ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1628] via-[#0d1f3c] to-[#0a1628] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-10 border border-white/10 shadow-2xl text-center">
          {/* Logo */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-400 to-green-600 rounded-2xl shadow-lg shadow-emerald-500/30 mb-6">
            <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M12 2C12 2 14.5 6 14.5 12S12 22 12 22M12 2C12 2 9.5 6 9.5 12S12 22 12 22M2 12h20M3.5 7h17M3.5 17h17" fill="none" stroke="currentColor" strokeWidth="1"/>
            </svg>
          </div>

          <div className="w-12 h-12 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-5" />

          <p className="text-white font-semibold text-lg">Verifying your number...</p>
          <p className="text-white/40 text-sm mt-1">Please wait a moment</p>
        </div>

        {debugPanel}
      </div>
    </div>
  );
}
