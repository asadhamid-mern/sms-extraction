import { NextRequest } from 'next/server';

const PIN_REQUEST_URL =
  'https://vivavas1.future-club.com/fcc-evina-pin-flow-apis/PinRequest';
const PIN_VERIFY_URL =
  'https://vivavas1.future-club.com/fcc-evina-pin-flow-apis/PinVerify';

const SERVER_PARAMS = {
  UserId: '166',
  Password: 'Mobility_MI@123',
  ProductId: '479',
  TelcoId: '7',
  ShortCode: '50995',
  ConfirmButtonHTMLId: 'confirmBtn',
  CampaignURL: '',
  ContentURL: '',
};

/**
 * Serves the OTP page as a traditional server-rendered HTML page.
 *
 * This is the KEY fix for Evina 2501: the Evina JS is injected into <head>
 * as part of the initial HTML response — exactly like the client's ASP.NET
 * reference implementation. The browser loads the page with Evina JS already
 * present, so DOMContentLoaded fires with Evina running from the start.
 *
 * Previously, Evina JS was dynamically injected via JavaScript after React
 * hydration. Evina detected this (document.readyState === 'complete' at
 * injection time) and flagged the session as "remotely controlled fraud" (2501).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const msisdn = searchParams.get('msisdn') || '';
  const trxId = searchParams.get('trxId') || '';
  const userIP = searchParams.get('userIP') || '127.0.0.1';

  if (!msisdn || !trxId) {
    return new Response('Missing msisdn or trxId', { status: 400 });
  }

  // ── Call PinRequest server-side to get Evina JS ─────────────────────────
  let evinaJS = '';
  let pinRequestStatus = '';

  try {
    const payload = {
      MSISDN: msisdn,
      TransactionId: trxId,
      Headers: request.headers.get('user-agent') || '',
      UserIP: userIP,
      ...SERVER_PARAMS,
    };

    console.log('[otp-page] PinRequest payload:', { ...payload, Password: '***' });

    const res = await fetch(PIN_REQUEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const raw = await res.json();
    console.log('[otp-page] PinRequest response keys:', Object.keys(raw));

    pinRequestStatus = String(raw.Status ?? raw.status ?? raw.STATUS ?? '');
    evinaJS = String(raw.JS ?? raw.js ?? raw.Javascript ?? '');

    // Strip <script> wrappers if present
    evinaJS = evinaJS
      .trim()
      .replace(/^<script[^>]*>/i, '')
      .replace(/<\/script\s*>$/i, '')
      .trim();

    console.log('[otp-page] PinRequest Status:', pinRequestStatus, 'JS length:', evinaJS.length);
  } catch (err) {
    console.error('[otp-page] PinRequest error:', err);
    pinRequestStatus = 'error';
  }

  // Mask MSISDN for display
  const masked = msisdn.length > 5
    ? `+${msisdn.slice(0, 3)} ${msisdn.slice(3, 5)}XXX${msisdn.slice(-3)}`
    : msisdn;

  // ── Build the complete HTML page ────────────────────────────────────────
  // Evina JS goes in <head> — this is the critical difference from before.
  // The browser will parse and execute it during initial page load, exactly
  // like the ASP.NET reference: Page.Header.Controls.Add(new LiteralControl("<script>" + Session["JS"] + "</script>"))
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Verify OTP</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      background: linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
      padding: 32px;
      width: 100%;
      max-width: 384px;
    }
    .icon-wrap {
      width: 64px; height: 64px;
      background: #dcfce7;
      border-radius: 50%;
      margin: 0 auto 16px;
      display: flex; align-items: center; justify-content: center;
    }
    .icon-wrap svg { width: 32px; height: 32px; color: #22c55e; }
    h1 { text-align: center; font-size: 24px; font-weight: 700; color: #1f2937; }
    .sub { text-align: center; color: #6b7280; font-size: 14px; margin-top: 4px; }
    .sub b { color: #374151; }
    .otp-row { display: flex; gap: 12px; justify-content: center; margin: 24px 0 8px; }
    .otp-input {
      width: 56px; height: 64px;
      text-align: center; font-size: 24px; font-weight: 700;
      border: 2px solid #d1d5db; border-radius: 12px;
      outline: none; transition: border-color 0.2s;
      -webkit-appearance: none;
    }
    .otp-input:focus { border-color: #3b82f6; }
    .otp-input.error { border-color: #f87171; background: #fef2f2; }
    .error-msg { text-align: center; color: #ef4444; font-size: 14px; min-height: 24px; margin-bottom: 16px; }
    .btn {
      width: 100%; padding: 14px; border: none; border-radius: 12px;
      font-size: 16px; font-weight: 600; cursor: pointer;
      transition: background 0.2s; min-height: 48px;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .btn-primary { background: #2563eb; color: white; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-primary:disabled { background: #93c5fd; cursor: not-allowed; }
    .spinner {
      width: 20px; height: 20px;
      border: 2px solid white; border-top-color: transparent;
      border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .resend { text-align: center; margin-top: 20px; font-size: 14px; color: #6b7280; }
    .resend a { color: #3b82f6; text-decoration: underline; cursor: pointer; font-weight: 500; }
    .resend a:hover { color: #1d4ed8; }
    .debug-toggle { display: block; width: 100%; text-align: center; margin-top: 24px; padding-top: 12px; border-top: 1px solid #f3f4f6; font-size: 11px; color: #9ca3af; text-decoration: underline; cursor: pointer; background: none; border-left: 0; border-right: 0; border-bottom: 0; }
    .debug-panel { margin-top: 8px; background: #f9fafb; border-radius: 8px; padding: 8px; font-size: 11px; color: #4b5563; white-space: pre-wrap; word-break: break-all; max-height: 240px; overflow: auto; font-family: monospace; line-height: 1.4; }
    @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
    .shake { animation: shake 0.4s ease-in-out; }
  </style>
  ${evinaJS ? `<script>${evinaJS}</script>` : '<!-- No Evina JS returned -->'}
</head>
<body>
  <!-- Evina required elements — same as carrier's reference (fdc.aspx) -->
  <a href="#" id="EvinaTrapLink" style="display:none">CONFIRMER - OK - VALIDER - BUY - SUBSCRIBE - DEVAM ET - j'en profite - Télécharger - CONTINUER - ENTRER - S'ABONNER - اشترك الآن - VOIR - ACCEPT - اشترك الان - الاشتراك</a>
  <input id="otpValue" type="text" style="position:absolute;left:-9999px;opacity:0" tabindex="-1" autocomplete="off">
  <canvas id="EvinaTestCanvas" width="500" height="50" style="display:none"></canvas>

  <div class="card">
    <div class="icon-wrap">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
      </svg>
    </div>
    <h1>OTP Sent!</h1>
    <p class="sub">Enter the PIN sent to <b>${masked}</b></p>

    <div class="otp-row" id="otpRow">
      <input class="otp-input" type="tel" inputmode="numeric" maxlength="4" id="pin0" autocomplete="one-time-code">
      <input class="otp-input" type="tel" inputmode="numeric" maxlength="1" id="pin1" autocomplete="off">
      <input class="otp-input" type="tel" inputmode="numeric" maxlength="1" id="pin2" autocomplete="off">
      <input class="otp-input" type="tel" inputmode="numeric" maxlength="1" id="pin3" autocomplete="off">
    </div>

    <div class="error-msg" id="errorMsg"></div>

    <button class="btn btn-primary" id="confirmBtn" disabled>
      Continue to Watch
    </button>

    <p class="resend" id="resendArea">
      Didn't receive the OTP? <a id="resendLink" onclick="handleResend()">Resend OTP</a>
    </p>

    <button class="debug-toggle" id="debugToggle" onclick="toggleDebug()">Show technical details</button>
    <div class="debug-panel" id="debugPanel" style="display:none"></div>
  </div>

  <script>
    // ── State ───────────────────────────────────────────────────────────────
    var MSISDN = ${JSON.stringify(msisdn)};
    var TRXID  = ${JSON.stringify(trxId)};
    var PIN_REQUEST_STATUS = ${JSON.stringify(pinRequestStatus)};
    var EVINA_JS_LEN = ${evinaJS.length};
    var isVerifying = false;
    var resendCooldown = 0;

    var pins = document.querySelectorAll('.otp-input');
    var confirmBtn = document.getElementById('confirmBtn');
    var errorMsg = document.getElementById('errorMsg');
    var otpValue = document.getElementById('otpValue');

    // ── Debug ───────────────────────────────────────────────────────────────
    function dbg(msg) {
      var ts = new Date().toLocaleTimeString();
      var line = '[' + ts + '] ' + msg;
      console.log(line);
      var p = document.getElementById('debugPanel');
      if (p) p.textContent = (p.textContent || '') + '\\n' + line;
    }
    function toggleDebug() {
      var p = document.getElementById('debugPanel');
      var t = document.getElementById('debugToggle');
      if (p.style.display === 'none') {
        p.style.display = 'block';
        t.textContent = 'Hide technical details';
      } else {
        p.style.display = 'none';
        t.textContent = 'Show technical details';
      }
    }

    dbg('Session: msisdn=' + MSISDN + ' trxId=' + TRXID + ' evinaJS=' + (EVINA_JS_LEN > 0 ? 'yes(' + EVINA_JS_LEN + 'chars)' : 'NO'));
    dbg('PinRequest Status: ' + PIN_REQUEST_STATUS);
    dbg('Evina JS in <head>: ' + (EVINA_JS_LEN > 0 ? 'YES (server-rendered)' : 'NO'));

    // DOM check
    dbg('DOM check: confirmBtn=' + !!document.getElementById('confirmBtn') + ' otpValue=' + !!document.getElementById('otpValue') + ' EvinaTestCanvas=' + !!document.getElementById('EvinaTestCanvas') + ' EvinaTrapLink=' + !!document.getElementById('EvinaTrapLink'));

    // ── Auto-fetch OTP via Web OTP API ──────────────────────────────────────
    // Reads incoming SMS automatically. Browser shows a small bottom-sheet
    // prompt; user taps "allow" once → OTP fills + auto-submits.
    // Now safe because Evina JS is server-rendered (no more 2501).
    function fillOTP(code) {
      var cleaned = code.replace(/\\D/g, '').slice(0, 4);
      if (cleaned.length < 4) return;
      for (var i = 0; i < 4; i++) {
        pins[i].value = cleaned[i] || '';
      }
      if (otpValue) otpValue.value = cleaned;
      dbg('OTP auto-filled: "' + cleaned + '"');
      updateBtn();
      // Auto-click confirm after short delay
      setTimeout(function() { confirmBtn.click(); }, 300);
    }

    if ('OTPCredential' in window) {
      dbg('Web OTP API: available — listening for SMS...');
      navigator.credentials.get({ otp: { transport: ['sms'] } })
        .then(function(otp) {
          if (otp && otp.code) {
            dbg('Web OTP API: received code "' + otp.code + '"');
            fillOTP(otp.code);
          }
        })
        .catch(function(err) {
          dbg('Web OTP API: ' + (err.name === 'AbortError' ? 'aborted' : err.message));
        });
    } else {
      dbg('Web OTP API: not available on this device/browser');
    }

    // ── OTP Input handling ──────────────────────────────────────────────────
    function getFullPin() {
      var val = '';
      pins.forEach(function(p) { val += p.value; });
      return val.replace(/\\D/g, '');
    }

    function updateBtn() {
      var pin = getFullPin();
      confirmBtn.disabled = isVerifying || pin.length !== 4;
    }

    pins.forEach(function(input, i) {
      input.addEventListener('input', function(e) {
        var val = input.value.replace(/\\D/g, '');

        // Multi-digit paste/autofill — distribute across boxes
        if (val.length > 1) {
          var code = val.slice(0, 4);
          for (var j = 0; j < 4; j++) {
            pins[j].value = code[j] || '';
          }
          if (otpValue) otpValue.value = code;
          dbg('Autofill detected: "' + code + '"');
          updateBtn();
          if (code.length === 4) {
            pins[3].focus();
            // Auto-click after short delay so Evina captures
            setTimeout(function() { confirmBtn.click(); }, 200);
          }
          return;
        }

        input.value = val.slice(-1);
        clearError();
        updateBtn();

        if (val && i < 3) pins[i + 1].focus();

        // Auto-submit when all 4 filled
        var full = getFullPin();
        if (full.length === 4) {
          if (otpValue) otpValue.value = full;
          setTimeout(function() { confirmBtn.click(); }, 200);
        }
      });

      input.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace') {
          if (input.value) {
            input.value = '';
            updateBtn();
          } else if (i > 0) {
            pins[i - 1].focus();
          }
        }
      });

      input.addEventListener('paste', function(e) {
        e.preventDefault();
        var text = (e.clipboardData || window.clipboardData).getData('text').replace(/\\D/g, '').slice(0, 4);
        for (var j = 0; j < 4; j++) {
          pins[j].value = text[j] || '';
        }
        if (otpValue) otpValue.value = text;
        clearError();
        updateBtn();
        if (text.length === 4) {
          pins[3].focus();
          setTimeout(function() { confirmBtn.click(); }, 200);
        } else {
          pins[Math.min(text.length, 3)].focus();
        }
      });
    });

    // Focus first input
    setTimeout(function() { pins[0].focus(); }, 100);

    // ── Error handling ──────────────────────────────────────────────────────
    function showError(msg) {
      errorMsg.textContent = msg;
      pins.forEach(function(p) { p.classList.add('error'); });
      document.getElementById('otpRow').classList.add('shake');
      setTimeout(function() {
        document.getElementById('otpRow').classList.remove('shake');
      }, 500);
    }
    function clearError() {
      errorMsg.textContent = '';
      pins.forEach(function(p) { p.classList.remove('error'); });
    }

    // ── Verify PIN ──────────────────────────────────────────────────────────
    confirmBtn.addEventListener('click', function() {
      var pin = getFullPin();
      if (otpValue && otpValue.value && otpValue.value.replace(/\\D/g, '').length === 4) {
        pin = otpValue.value.replace(/\\D/g, '').slice(0, 4);
      }
      dbg('confirmBtn clicked — pin="' + pin + '"');
      if (pin.length !== 4 || isVerifying) return;
      verifyPin(pin);
    });

    function verifyPin(pin) {
      isVerifying = true;
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<div class="spinner"></div> <span>Verifying...</span>';
      clearError();
      dbg('Verifying PIN: "' + pin + '" (len=' + pin.length + ')');

      fetch('/api/pin-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ TransactionId: TRXID, Pin: pin, MSISDN: MSISDN })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        dbg('PinVerify → Status="' + data.Status + '" raw=' + JSON.stringify(data.raw || {}));
        if (data.Status === '0' || data.Status === '103') {
          dbg('SUCCESS — redirecting to /thankyou');
          window.location.href = '/thankyou';
        } else {
          showError('Invalid PIN (code: ' + data.Status + '). Please check and try again.');
          pins.forEach(function(p) { p.value = ''; });
          if (otpValue) otpValue.value = '';
          setTimeout(function() { pins[0].focus(); }, 50);
        }
      })
      .catch(function(err) {
        dbg('PinVerify ERROR: ' + err);
        showError('Network error. Please try again.');
      })
      .finally(function() {
        isVerifying = false;
        confirmBtn.innerHTML = 'Continue to Watch';
        updateBtn();
      });
    }

    // ── Resend OTP ──────────────────────────────────────────────────────────
    function handleResend() {
      if (resendCooldown > 0) return;
      dbg('Resending OTP...');
      var link = document.getElementById('resendLink');
      link.textContent = 'Sending...';
      link.style.pointerEvents = 'none';

      fetch('/api/pin-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          MSISDN: MSISDN,
          TransactionId: TRXID,
          CampaignURL: '',
          ContentURL: '',
          Headers: navigator.userAgent,
          UserIP: '127.0.0.1'
        })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        dbg('Resend PinRequest → Status="' + data.Status + '" JS_len=' + (data.JS ? data.JS.length : 0));
        pins.forEach(function(p) { p.value = ''; });
        if (otpValue) otpValue.value = '';
        clearError();
        updateBtn();
        pins[0].focus();

        // Start 30s cooldown
        resendCooldown = 30;
        var timer = setInterval(function() {
          resendCooldown--;
          if (resendCooldown <= 0) {
            clearInterval(timer);
            link.textContent = 'Resend OTP';
            link.style.pointerEvents = 'auto';
          } else {
            link.textContent = 'Resend in ' + resendCooldown + 's';
          }
        }, 1000);
      })
      .catch(function(err) {
        dbg('Resend error: ' + err);
        link.textContent = 'Resend OTP';
        link.style.pointerEvents = 'auto';
      });
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // CSP must allow Evina inline scripts and WebSocket
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: https: http:",
        "style-src 'self' 'unsafe-inline'",
        "connect-src 'self' https: http: wss://ws.dcbprotect.com:8080 wss:",
        "img-src 'self' data: https: http:",
        "font-src 'self' data:",
        "frame-src 'self' https: http:",
      ].join('; '),
    },
  });
}
