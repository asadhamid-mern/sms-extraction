'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { updateTransactionStatus } from '@/lib/supabase';
import { maskMsisdn } from '@/lib/utils';

export default function OTPPage() {
  const router = useRouter();

  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [maskedMsisdn, setMaskedMsisdn] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const [showDebug, setShowDebug] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([
    null, null, null, null,
  ]);
  const initialized = useRef(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Read PIN from DOM directly — Evina manipulates the DOM without triggering
   * React synthetic events, so React state (digits) stays empty after Evina
   * fills the inputs. Reading from the DOM refs (and optional hidden field)
   * gives us the real values.
   */
  function getPinFromDOM(): string {
    // Some Evina integrations write the PIN into a hidden #otpValue input
    const hidden = document.getElementById('otpValue') as
      | HTMLInputElement
      | null;
    if (hidden?.value && hidden.value.replace(/\D/g, '').length === 4) {
      return hidden.value.replace(/\D/g, '').slice(0, 4);
    }

    // Fallback: read from the visible 4 OTP boxes
    return inputRefs.current
      .map((el) => el?.value ?? '')
      .join('');
  }

  // ── Verify PIN ────────────────────────────────────────────────────────────
  const handleVerify = useCallback(
    async (pinOverride?: string) => {
      // Priority: explicit override → DOM values → React state
      const pin = pinOverride ?? (getPinFromDOM() || digits.join(''));
      console.log('[OTP] handleVerify called, pin:', pin, 'source:', pinOverride ? 'override' : 'DOM/state');
      setDebugInfo((prev) =>
        `${prev}\n[client] Verifying PIN: "${pin}" (length=${pin.length})`
      );
      if (pin.length !== 4) {
        console.warn('[OTP] PIN length invalid:', pin.length);
        return;
      }

      const trxId = sessionStorage.getItem('trxId');
      if (!trxId) {
        router.replace('/');
        return;
      }

      setIsVerifying(true);
      setError('');

      try {
        const res = await fetch('/api/pin-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ TransactionId: trxId, Pin: pin }),
        });

        const data = await res.json();
        console.log('[OTP] PinVerify response:', data);
        setDebugInfo((prev) =>
          `${prev}\n[api] /api/pin-verify Status="${data.Status}" ${
            data.error ? `error="${data.error}"` : ''
          }`
        );

        if (data.Status === '0') {
          await updateTransactionStatus(trxId, 'pin_verified');
          router.push('/thankyou');
        } else {
          setError('Invalid PIN. Please check and try again.');
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 600);
          setDigits(['', '', '', '']);
          setTimeout(() => inputRefs.current[0]?.focus(), 50);
          await updateTransactionStatus(trxId, 'failed');
        }
      } catch (err) {
        console.error('[OTP] PinVerify error:', err);
        setError('Network error. Please try again.');
      } finally {
        setIsVerifying(false);
      }
    },
    [digits, router]
  );

  // ── Mount: inject Evina JS + guard session ────────────────────────────────
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const evinaJS = sessionStorage.getItem('evinaJS');
    const storedMsisdn = sessionStorage.getItem('msisdn');
    const trxId = sessionStorage.getItem('trxId');

    if (!storedMsisdn || !trxId) {
      router.replace('/');
      return;
    }

    setMaskedMsisdn(maskMsisdn(storedMsisdn));

    // Inject Evina obfuscated JS into <head> — never modify this script
    if (evinaJS) {
      try {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.id = 'evina-script';
        // The API returns raw JS without <script> tags — inject as-is.
        // Trim avoids accidental leading BOM/whitespace issues.
        script.text = evinaJS.trim();
        document.head.appendChild(script);
        const summary = `[OTP] Evina JS injected length=${evinaJS.length} startsWith="${evinaJS
          .slice(0, 40)
          .replace(/\s+/g, ' ')}"`;
        console.log(summary);
        setDebugInfo((prev) => `${prev}\n[client] ${summary}`);
      } catch (e) {
        console.error('[OTP] Failed to inject Evina JS:', e);
        setDebugInfo((prev) => `${prev}\n[client] Failed to inject Evina JS: ${String(e)}`);
      }
    } else {
      console.warn('[OTP] No evinaJS found in sessionStorage');
      setDebugInfo((prev) => `${prev}\n[client] No evinaJS found in sessionStorage`);
    }

    // Focus first OTP input
    setTimeout(() => inputRefs.current[0]?.focus(), 150);
  }, [router]);

  // Cleanup cooldown on unmount
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  // ── OTP input handlers ────────────────────────────────────────────────────
  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setError('');

    if (digit && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 4 digits are entered
    if (digit && newDigits.every((d) => d !== '')) {
      handleVerify(newDigits.join(''));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 4);

    const newDigits = ['', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setDigits(newDigits);
    setError('');

    if (pasted.length === 4) {
      handleVerify(pasted);
    } else {
      inputRefs.current[Math.min(pasted.length, 3)]?.focus();
    }
  }

  // ── Resend OTP ────────────────────────────────────────────────────────────
  async function handleResend() {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setError('');

    const storedMsisdn = sessionStorage.getItem('msisdn');
    const trxId = sessionStorage.getItem('trxId');

    try {
      let userIP = '127.0.0.1';
      try {
        const ipRes = await fetch('/api/get-ip');
        const ipData = await ipRes.json();
        userIP = ipData.ip;
      } catch {}

      const res = await fetch('/api/pin-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          MSISDN: storedMsisdn,
          TransactionId: trxId,
          CampaignURL: '',
          ContentURL: '',
          Headers: navigator.userAgent,
          UserIP: userIP,
        }),
      });

      const data = await res.json();
      if (data.Status === '0' && data.JS) {
        // Re-inject updated Evina JS
        sessionStorage.setItem('evinaJS', data.JS);
        const script = document.createElement('script');
        script.text = data.JS;
        document.head.appendChild(script);
      }

      setDigits(['', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);

      // Start 30s cooldown
      setResendCooldown(30);
      cooldownRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(cooldownRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error('[OTP] Resend error:', err);
      setError('Failed to resend. Please try again.');
    } finally {
      setIsResending(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center p-4">
      {/*
        Hidden confirm button — Evina JS auto-clicks this after reading the PIN
        from the device SMS inbox. id MUST match ConfirmButtonHTMLId in payload.
        On click we read PIN from DOM directly (not React state) because Evina
        fills inputs via vanilla JS which bypasses React's onChange events.
      */}
      <button
        id="confirmBtn"
        type="button"
        className="hidden"
        onClick={() => {
          const domPin = getPinFromDOM();
          console.log('[OTP] confirmBtn clicked by Evina, DOM pin:', domPin);
          setDebugInfo((prev) =>
            `${prev}\n[client] confirmBtn clicked, DOM pin="${domPin}"`
          );
          handleVerify(domPin || undefined);
        }}
        aria-hidden="true"
        tabIndex={-1}
      />
      {/* Hidden input — some Evina versions write the PIN here instead of the visible boxes */}
      <input id="otpValue" type="hidden" aria-hidden="true" />

      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">OTP Sent!</h1>
          <p className="text-gray-500 text-sm mt-1 leading-relaxed">
            Enter the PIN sent to{' '}
            <span className="font-semibold text-gray-700">{maskedMsisdn}</span>
          </p>
        </div>

        {/* 4-digit OTP inputs */}
        <div
          className={`flex gap-3 justify-center mb-2 ${
            isShaking ? 'animate-shake' : ''
          }`}
        >
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              type="tel"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              className={`w-14 h-16 text-center text-2xl font-bold border-2 rounded-xl outline-none transition-colors
                ${
                  error
                    ? 'border-red-400 bg-red-50'
                    : 'border-gray-300 focus:border-blue-500'
                }`}
              disabled={isVerifying}
            />
          ))}
        </div>

        {/* Error message */}
        <div className="min-h-[24px] text-center mb-4">
          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}
        </div>

        {/* Verify button */}
        <button
          onClick={() => handleVerify()}
          disabled={isVerifying || digits.join('').length !== 4}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 rounded-xl transition-colors min-h-[48px] flex items-center justify-center gap-2"
        >
          {isVerifying ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Verifying...</span>
            </>
          ) : (
            'Verify OTP'
          )}
        </button>

        {/* Resend */}
        <p className="text-center text-sm mt-5 text-gray-500">
          Didn&apos;t receive the OTP?{' '}
          {resendCooldown > 0 ? (
            <span className="text-gray-400">
              Resend in {resendCooldown}s
            </span>
          ) : (
            <button
              onClick={handleResend}
              disabled={isResending}
              className="text-blue-500 underline font-medium hover:text-blue-700 disabled:text-blue-300 transition-colors"
            >
              {isResending ? 'Sending...' : 'Resend OTP'}
            </button>
          )}
        </p>

        {/* Debug panel for you (not user-facing copy) */}
        {debugInfo.trim() && (
          <div className="mt-6 border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => setShowDebug((v) => !v)}
              className="w-full text-xs text-gray-400 underline text-center"
            >
              {showDebug ? 'Hide technical details' : 'Show technical details'}
            </button>
            {showDebug && (
              <pre className="mt-2 max-h-40 overflow-auto text-[11px] leading-snug text-left bg-gray-50 text-gray-600 rounded-lg p-2 whitespace-pre-wrap break-all">
                {debugInfo.trim()}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
