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

  /**
   * Navigate to the server-rendered OTP page.
   *
   * PinRequest is now called SERVER-SIDE by the /api/otp-page route, which
   * injects Evina JS directly into <head> as part of the initial HTML.
   * This matches the client's ASP.NET reference — Evina JS runs on
   * DOMContentLoaded naturally, fixing the 2501 fraud detection error.
   */
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

        // Full page navigation — NOT SPA. The server renders the HTML with
        // Evina JS already in <head>.
        window.location.href = `/api/otp-page?msisdn=${encodeURIComponent(msisdn)}&trxId=${encodeURIComponent(trxId)}&userIP=${encodeURIComponent(userIP)}`;
      } catch (err) {
        dbg('Navigation error: ' + String(err));
        setErrorMsg('Network error. Please check your connection and try again.');
        setState('error');
      }
    },
    []
  );

  const initFlow = useCallback(async () => {
    dbg('Landing page loaded');
    dbg('URL: ' + window.location.href);
    dbg('Hostname: ' + window.location.hostname);

    // Parse URL params without useSearchParams to avoid Suspense requirement
    const params = new URLSearchParams(window.location.search);

    // Case-insensitive key lookup — carrier may send 'msisdn', 'MSISDN', etc.
    const getParam = (key: string) =>
      params.get(key) ??
      params.get(key.toLowerCase()) ??
      params.get(key.toUpperCase()) ??
      null;

    const msisdnParam = getParam('msisdn');
    const statusParam  = getParam('status');
    const trxidParam   = getParam('trxid');

    dbg('URL params: msisdn=' + (msisdnParam || 'NONE') + ' status=' + (statusParam || 'NONE') + ' trxid=' + (trxidParam || 'NONE'));

    // Get user IP server-side
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

    // Accept any casing of "success" — carrier may send Success / success / SUCCESS
    const isSuccess = statusParam?.toLowerCase() === 'success';

    if (msisdnParam && isSuccess) {
      // Returning from HE redirect — carrier has given us the MSISDN
      dbg('HE SUCCESS — MSISDN detected: ' + msisdnParam);
      let trxId = sessionStorage.getItem('trxId');
      if (!trxId) trxId = trxidParam || generateTransactionId();

      const msisdn = msisdnParam.startsWith('965')
        ? msisdnParam
        : `965${msisdnParam}`;

      dbg('Normalized MSISDN: ' + msisdn + ' | TrxId: ' + trxId);
      sessionStorage.setItem('msisdn', msisdn);
      sessionStorage.setItem('trxId', trxId);

      // Clean URL params without triggering a page reload
      window.history.replaceState({}, '', '/');

      dbg('Navigating to OTP page...');
      await goToOTPPage({ msisdn, trxId, userIP });
    } else if (msisdnParam && !isSuccess) {
      // HE returned msisdn but status is not success — still try with the number
      dbg('HE returned MSISDN but status="' + statusParam + '" (not Success) — proceeding anyway');
      let trxId = sessionStorage.getItem('trxId');
      if (!trxId) trxId = trxidParam || generateTransactionId();

      const msisdn = msisdnParam.startsWith('965')
        ? msisdnParam
        : `965${msisdnParam}`;

      sessionStorage.setItem('msisdn', msisdn);
      sessionStorage.setItem('trxId', trxId);
      window.history.replaceState({}, '', '/');

      dbg('Navigating to OTP page with MSISDN: ' + msisdn);
      await goToOTPPage({ msisdn, trxId, userIP });
    } else if (statusParam && !msisdnParam) {
      // Status came back but no msisdn — fall back to manual input
      dbg('HE FAILED — status="' + statusParam + '" but NO msisdn returned');
      dbg('Falling back to manual number entry');
      setState('manual_input');
    } else {
      // First visit — generate trxId and log
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

      // HE redirect only works on a real mobile device on the carrier network.
      // On localhost / desktop skip it and show manual input instead.
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
      dbg('HE should redirect back to: https://sms-extraction.vercel.app/?msisdn=XXX&status=Success&trxid=' + trxId);
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
    const trxId =
      sessionStorage.getItem('trxId') || generateTransactionId();
    sessionStorage.setItem('trxId', trxId);

    const msisdn = manualNumber.startsWith('965')
      ? manualNumber
      : `965${manualNumber}`;
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

  // ── Debug panel component ─────────────────────────────────────────────────
  const debugPanel = (
    <div className="mt-4 w-full">
      <button
        onClick={() => setShowDebug(v => !v)}
        className="text-xs text-gray-300 underline w-full text-center"
      >
        {showDebug ? 'Hide' : 'Show'} technical details
      </button>
      {showDebug && debugLines.length > 0 && (
        <pre className="mt-2 text-xs text-left bg-gray-100 text-gray-700 rounded-lg p-3 break-all whitespace-pre-wrap max-h-60 overflow-auto font-mono leading-relaxed">
          {debugLines.join('\n')}
        </pre>
      )}
    </div>
  );

  // ── Error state ───────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center animate-fade-in">
          <div className="w-16 h-16 bg-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Something went wrong
          </h2>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            {errorMsg}
          </p>
          <button
            onClick={handleRetry}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors min-h-[48px]"
          >
            Try Again
          </button>
          <button
            onClick={() => setState('manual_input')}
            className="mt-3 w-full text-blue-600 text-sm underline"
          >
            Enter number manually
          </button>

          {debugPanel}
        </div>
      </div>
    );
  }

  // ── Manual input fallback ─────────────────────────────────────────────────
  if (state === 'manual_input') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm animate-fade-in">
          {/* Logo placeholder */}
          <div className="w-20 h-14 bg-gray-100 rounded-xl mx-auto mb-6 flex items-center justify-center border border-gray-200">
            <span className="text-gray-400 text-xs font-semibold tracking-wide">
              LOGO
            </span>
          </div>

          <h1 className="text-2xl font-bold text-gray-800 text-center mb-1">
            Enter Your Mobile Number
          </h1>
          <p className="text-gray-500 text-sm text-center mb-6">
            Subscribe to exclusive premium content
          </p>

          <form onSubmit={handleManualSubmit} noValidate>
            <div className="flex border-2 border-gray-300 rounded-xl overflow-hidden mb-4 focus-within:border-blue-500 transition-colors">
              <div className="flex items-center px-3 bg-gray-50 border-r-2 border-gray-300 gap-1.5 shrink-0">
                <span className="text-xl leading-none">🇰🇼</span>
                <span className="text-gray-700 font-semibold text-sm">
                  +965
                </span>
              </div>
              <input
                type="tel"
                inputMode="numeric"
                value={manualNumber}
                onChange={(e) =>
                  setManualNumber(e.target.value.replace(/\D/g, ''))
                }
                placeholder="50000000"
                className="flex-1 px-3 py-3 text-gray-800 text-base outline-none min-h-[48px] bg-transparent"
                maxLength={8}
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || manualNumber.length < 7}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 rounded-xl transition-colors min-h-[48px] flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                'Subscribe Now'
              )}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-5 leading-relaxed">
            By subscribing you agree to our{' '}
            <span className="text-blue-500 underline cursor-pointer">
              Terms &amp; Conditions
            </span>
            . Standard operator charges may apply.
          </p>

          {debugPanel}
        </div>
      </div>
    );
  }

  // ── Loading / verifying state (default) ───────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-sm mx-4 text-center">
        {/* Logo placeholder */}
        <div className="w-20 h-14 bg-gray-100 rounded-xl mx-auto mb-8 flex items-center justify-center border border-gray-200">
          <span className="text-gray-400 text-xs font-semibold tracking-wide">
            LOGO
          </span>
        </div>

        <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-5" />

        <p className="text-gray-800 font-semibold text-lg">
          Verifying your number...
        </p>
        <p className="text-gray-400 text-sm mt-1">Please wait a moment</p>

        {debugPanel}
      </div>
    </div>
  );
}
