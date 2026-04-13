import { NextRequest, NextResponse } from 'next/server';
import { vasPinVerify } from '@/lib/vas-api';

/**
 * Consent Gateway callback (Flow A). Register full HTTPS URL with VAS team.
 * Expected query: errorCode, AdAgencyCampaignTransactionId; optional pin / Pin / otp.
 */
export async function GET(request: NextRequest) {
  const u = new URL(request.url);
  const errorCode = u.searchParams.get('errorCode');
  const tid =
    u.searchParams.get('AdAgencyCampaignTransactionId') ??
    u.searchParams.get('adAgencyCampaignTransactionId');
  const pin =
    u.searchParams.get('pin') ??
    u.searchParams.get('Pin') ??
    u.searchParams.get('otp') ??
    u.searchParams.get('OTP') ??
    '';

  const base = u.origin;

  if (tid && pin.replace(/\D/g, '').length >= 4) {
    try {
      const v = await vasPinVerify(tid, pin);
      if (v.errorCode === 0 || v.errorCode === 1) {
        return NextResponse.redirect(new URL('/thankyou', base));
      }
      return new NextResponse(
        cgCallbackHtml(
          false,
          `Verification failed (${v.errorCode}). Please open the app and use manual entry.`,
          base
        ),
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    } catch {
      return new NextResponse(
        cgCallbackHtml(false, 'Server error. Please try again from the app.', base),
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }
  }

  return new NextResponse(
    cgCallbackHtml(
      true,
      `Callback received (errorCode=${errorCode ?? 'n/a'}). ${
        tid ? `Session: ${tid.slice(0, 8)}…` : 'Missing transaction id.'
      } If the carrier did not pass a PIN in the URL, complete verification from the app.`,
      base
    ),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

function cgCallbackHtml(ok: boolean, msg: string, origin: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Subscription</title>
<style>body{font-family:system-ui,sans-serif;background:#0b0e14;color:#fff;padding:24px;max-width:480px;margin:0 auto}</style></head><body>
<h1>${ok ? 'Almost done' : 'Action needed'}</h1><p>${escapeHtml(msg)}</p>
<p><a href="${origin}/?manual=1" style="color:#e2383a">Back to app — manual entry</a></p>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
