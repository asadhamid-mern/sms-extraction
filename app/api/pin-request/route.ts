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

    // Always call live carrier endpoint in production
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
