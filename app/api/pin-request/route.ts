import { NextRequest, NextResponse } from 'next/server';
import type { PinRequestResponse } from '@/types';

const PIN_REQUEST_URL =
  'https://vivavas1.future-club.com/fcc-evina-pin-flow-apis/PinRequest';

// Hardcoded server-side credentials — never exposed to the client
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

// ── Mock response used in TEST_MODE ──────────────────────────────────────────
// Simulates a successful PinRequest. The JS value is a no-op script so the
// OTP page loads normally. Enter PIN "1234" to complete the flow.
const MOCK_PIN_REQUEST_RESPONSE: PinRequestResponse = {
  Status: '0',
  JS: `console.log('[TEST MODE] Evina JS injected — enter PIN 1234 to verify.');`,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { MSISDN, TransactionId, Headers, UserIP } = body;

    if (!MSISDN || !TransactionId) {
      return NextResponse.json(
        { error: 'MSISDN and TransactionId are required' },
        { status: 400 }
      );
    }

    // ── TEST MODE ─────────────────────────────────────────────────────────────
    if (process.env.TEST_MODE === 'true') {
      console.log(
        '[PinRequest] TEST MODE — returning mock response for MSISDN:',
        MSISDN
      );
      return NextResponse.json(MOCK_PIN_REQUEST_RESPONSE);
    }

    // ── LIVE MODE ─────────────────────────────────────────────────────────────
    const payload = {
      MSISDN,
      TransactionId,
      Headers: Headers || '',
      UserIP: UserIP || '127.0.0.1',
      ...SERVER_PARAMS,
    };

    console.log('[PinRequest] Sending payload:', {
      ...payload,
      Password: '***',
    });

    const response = await fetch(PIN_REQUEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    console.log('[PinRequest] Raw response:', text);

    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(text);
    } catch {
      console.error('[PinRequest] Failed to parse response JSON:', text);
      return NextResponse.json(
        { error: 'Invalid response from carrier API', raw: text },
        { status: 502 }
      );
    }

    // Normalize: carrier may return "Status" or "status" — always expose as "Status"
    const normalized: PinRequestResponse = {
      Status: String(raw.Status ?? raw.status ?? raw.STATUS ?? ''),
      JS:     String(raw.JS     ?? raw.js     ?? raw.Javascript ?? ''),
    };

    console.log('[PinRequest] Raw response keys:', Object.keys(raw));
    console.log('[PinRequest] Normalized Status:', normalized.Status);
    return NextResponse.json(normalized);
  } catch (err) {
    console.error('[PinRequest] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
