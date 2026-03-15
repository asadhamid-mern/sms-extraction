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

  // ── Helper: append a line to the debug panel ─────────────────────────────
  function dbg(msg: string) {
    const ts = new Date().toLocaleTimeString();
    const line = `[${ts}] ${msg}`;
    console.log(line);
    setDebugInfo((prev) => `${prev}\n${line}`);
  }

  /**
   * Read PIN from DOM directly — Evina manipulates the DOM without triggering
   * React synthetic events, so React state (digits) stays empty after Evina
   * fills the inputs. Reading from the DOM refs (and optional hidden field)
   * gives us the real values.
   */
  function getPinFromDOM(): string {
    if (typeof document === 'undefined') return '';
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
      dbg(`Verifying PIN: "${pin}" (len=${pin.length}) src=${pinOverride ? 'override' : 'DOM/state'}`);

      if (pin.length !== 4) {
        dbg(`PIN too short (${pin.length}), skipping verify`);
        return;
      }

      const trxId = sessionStorage.getItem('trxId');
      const msisdn = sessionStorage.getItem('msisdn');
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
          body: JSON.stringify({
            TransactionId: trxId,
            Pin: pin,
            MSISDN: msisdn || '',
          }),
        });

        const data = await res.json();
        dbg(`PinVerify → Status="${data.Status}" raw=${JSON.stringify(data.raw ?? {})}`);

        if (data.Status === '0') {
          await updateTransactionStatus(trxId, 'pin_verified');
          router.push('/thankyou');
        } else {
          setError(`Invalid PIN (code: ${data.Status}). Please check and try again.`);
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 600);
          setDigits(['', '', '', '']);
          setTimeout(() => inputRefs.current[0]?.focus(), 50);
          await updateTransactionStatus(trxId, 'failed');
        }
      } catch (err) {
        console.error('[OTP] PinVerify error:', err);
        setError('Network error. Please try again.');
        dbg(`PinVerify EXCEPTION: ${String(err)}`);
      } finally {
        setIsVerifying(false);
      }
    },
    [digits, router]
  );

  // ── Inject Evina JS into the page ────────────────────────────────────────
  function injectEvinaScript(jsRaw: string) {
    let code = jsRaw.trim();

    // Strip <script> wrapper tags if the carrier wrapped the JS in them
    code = code
      .replace(/^<script[^>]*>/i, '')
      .replace(/<\/script\s*>$/i, '')
      .trim();

    if (!code) {
      dbg('Evina JS is EMPTY after cleanup — nothing to inject');
      return;
    }

    dbg(`Evina JS len=${code.length} first60="${code.slice(0, 60).replace(/\s+/g, ' ')}"`);

    // Detect: is the carrier returning a URL to load, or inline JS code?
    const isUrl = /^https?:\/\//i.test(code);

    try {
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.id = 'evina-script';

      if (isUrl) {
        // External script URL
        script.src = code;
        script.onload = () => dbg('Evina external script LOADED');
        script.onerror = (e) => dbg(`Evina external script FAILED: ${String(e)}`);
      } else {
        // Inline JS code
        script.text = code;
      }

      document.head.appendChild(script);
      dbg(`Evina script injected (${isUrl ? 'external URL' : 'inline'}) into <head>`);
    } catch (e) {
      dbg(`Evina inject ERROR: ${String(e)}`);

      // Fallback: try blob URL approach if inline injection failed (CSP issue)
      try {
        const blob = new Blob([code], { type: 'text/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        const fallbackScript = document.createElement('script');
        fallbackScript.src = blobUrl;
        fallbackScript.id = 'evina-script-blob';
        document.head.appendChild(fallbackScript);
        dbg('Evina injected via BLOB URL fallback');
      } catch (e2) {
        dbg(`Evina BLOB fallback also FAILED: ${String(e2)}`);
      }
    }

    // CRITICAL for Next.js (SPA): Evina's script starts on DOMContentLoaded,
    // but that event already fired on initial page load. Client-side navigation
    // to /otp does NOT re-fire DOMContentLoaded. Dispatch DCBProtectRun to
    // tell the Evina script to initialize now.
    setTimeout(() => {
      try {
        document.dispatchEvent(new Event('DCBProtectRun'));
        dbg('Dispatched DCBProtectRun event (SPA re-init)');
      } catch (e) {
        dbg(`DCBProtectRun dispatch error: ${String(e)}`);
      }

      // Verify key elements exist
      const btn = document.getElementById('confirmBtn');
      const otp = document.getElementById('otpValue');
      const evinaEl = document.getElementById('evina-script');
      dbg(`DOM check: confirmBtn=${!!btn} otpValue=${!!otp} evina-script=${!!evinaEl}`);
    }, 500);
  }

  // ── Mount: inject Evina JS + guard session ────────────────────────────────
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const evinaJS = sessionStorage.getItem('evinaJS');
    const storedMsisdn = sessionStorage.getItem('msisdn');
    const trxId = sessionStorage.getItem('trxId');

    dbg(`Session: msisdn=${storedMsisdn ? 'yes' : 'NO'} trxId=${trxId ? 'yes' : 'NO'} evinaJS=${evinaJS ? `yes(${evinaJS.length}chars)` : 'NO'}`);

    if (!storedMsisdn || !trxId) {
      router.replace('/');
      return;
    }

    setMaskedMsisdn(maskMsisdn(storedMsisdn));

    // Listen for global errors — catches Evina script runtime errors
    const errorHandler = (e: ErrorEvent) => {
      dbg(`GLOBAL ERROR: ${e.message} at ${e.filename}:${e.lineno}`);
    };
    window.addEventListener('error', errorHandler);

    // Watch for DOM mutations — detect when Evina modifies inputs
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.target instanceof HTMLInputElement) {
          const el = m.target;
          if (el.id === 'otpValue' && el.value) {
            dbg(`MutationObserver: #otpValue changed to "${el.value}"`);
          }
        }
        if (m.type === 'childList' && m.addedNodes.length) {
          m.addedNodes.forEach((node) => {
            if (node instanceof HTMLScriptElement) {
              dbg(`MutationObserver: new <script> added src="${node.src || '(inline)'}"`);
            }
          });
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['value'],
    });

    // Inject Evina obfuscated JS into <head>
    if (evinaJS) {
      injectEvinaScript(evinaJS);
    } else {
      dbg('No evinaJS in sessionStorage — Evina will NOT run');
    }

    // Focus first OTP input
    setTimeout(() => inputRefs.current[0]?.focus(), 150);

    return () => {
      window.removeEventListener('error', errorHandler);
      observer.disconnect();
    };
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

    // Auto-submit when all 4 digits are entered — click confirmBtn
    // so Evina captures the interaction (avoids error 2802)
    if (digit && newDigits.every((d) => d !== '')) {
      setTimeout(() => {
        document.getElementById('confirmBtn')?.click();
      }, 50);
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
      setTimeout(() => {
        document.getElementById('confirmBtn')?.click();
      }, 50);
    } else {
      inputRefs.current[Math.min(pasted.length, 3)]?.focus();
    }
  }

  // ── Resend OTP ────────────────────────────────────────────────────────────
  async function handleResend() {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setError('');
    dbg('Resending OTP...');

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
      dbg(`Resend PinRequest → Status="${data.Status}" JS_len=${data.JS?.length ?? 0}`);

      if (data.Status === '0' && data.JS) {
        // Remove old Evina script before re-injecting
        document.getElementById('evina-script')?.remove();
        document.getElementById('evina-script-blob')?.remove();

        sessionStorage.setItem('evinaJS', data.JS);
        injectEvinaScript(data.JS);
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
      dbg(`Resend EXCEPTION: ${String(err)}`);
    } finally {
      setIsResending(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center p-4">
      {/*
        NOTE: The old hidden confirmBtn was removed. The visible "Verify OTP"
        button below now carries id="confirmBtn" so that Evina monitors the
        actual button the user interacts with. Evina error 2802 = "click data
        transmission failure" happens when the user clicks an unmonitored button.
      */}
      {/*
        OTP value input — some Evina versions write the PIN here.
        Using type="text" (not "hidden") so Evina querySelector can find it.
        Visually hidden with CSS so user never sees it.
      */}
      <input
        id="otpValue"
        type="text"
        style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
        tabIndex={-1}
        autoComplete="one-time-code"
      />

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

        {/* Verify button — id="confirmBtn" so Evina monitors this click.
            Evina attaches its own listener to #confirmBtn to capture click data.
            Our onClick fires alongside Evina's listener (no evina_notify needed
            since te is set to "confirmBtn", not "evina_notify"). */}
        <button
          id="confirmBtn"
          onClick={() => {
            const pin = getPinFromDOM() || digits.join('');
            dbg(`confirmBtn clicked — pin="${pin}"`);
            handleVerify(pin || undefined);
          }}
          disabled={isVerifying || (digits.join('').length !== 4 && getPinFromDOM().length !== 4)}
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

        {/* Debug panel — always visible, client can screenshot for us */}
        <div className="mt-6 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => setShowDebug((v) => !v)}
            className="w-full text-xs text-gray-400 underline text-center"
          >
            {showDebug ? 'Hide technical details' : 'Show technical details'}
          </button>
          {showDebug && (
            <pre className="mt-2 max-h-60 overflow-auto text-[11px] leading-snug text-left bg-gray-50 text-gray-600 rounded-lg p-2 whitespace-pre-wrap break-all">
              {debugInfo.trim() || '(waiting for events...)'}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
