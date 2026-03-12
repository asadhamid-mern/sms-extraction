import { NextRequest, NextResponse } from 'next/server';
import type { PinVerifyResponse } from '@/types';

const PIN_VERIFY_URL =
  'https://vivavas1.future-club.com/fcc-evina-pin-flow-apis/PinVerify';

const TEST_PIN = '1234';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { TransactionId, Pin } = body;

    if (!TransactionId || !Pin) {
      return NextResponse.json(
        { error: 'TransactionId and Pin are required' },
        { status: 400 }
      );
    }

    // ── TEST MODE ─────────────────────────────────────────────────────────────
    if (process.env.TEST_MODE === 'true') {
      const success = Pin === TEST_PIN;
      console.log(
        `[PinVerify] TEST MODE — PIN "${Pin}" is ${success ? '✓ correct' : '✗ wrong (use 1234)'}`
      );
      const response: PinVerifyResponse = { Status: success ? '0' : '1' };
      return NextResponse.json(response);
    }

    // ── LIVE MODE ─────────────────────────────────────────────────────────────
    console.log('[PinVerify] Verifying for TransactionId:', TransactionId);

    const response = await fetch(PIN_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ TransactionId, Pin }),
    });

    const text = await response.text();
    console.log('[PinVerify] Raw response:', text);

    let data: PinVerifyResponse;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('[PinVerify] Failed to parse response JSON:', text);
      return NextResponse.json(
        { error: 'Invalid response from carrier API', raw: text },
        { status: 502 }
      );
    }

    console.log('[PinVerify] Parsed response Status:', data.Status);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[PinVerify] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
