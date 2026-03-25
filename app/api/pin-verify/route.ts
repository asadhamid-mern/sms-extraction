import { NextRequest, NextResponse } from 'next/server';

const PIN_VERIFY_URL =
  'https://vivavas1.future-club.com/fcc-evina-pin-flow-apis/PinVerify';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { TransactionId, Pin, MSISDN } = body;

    if (!TransactionId || !Pin) {
      return NextResponse.json(
        { error: 'TransactionId and Pin are required' },
        { status: 400 }
      );
    }

    // Original working payload — no extra credentials needed.
    // The TransactionId links to the PinRequest which already had credentials.
    const payload: Record<string, string> = { TransactionId, Pin };
    if (MSISDN) payload.MSISDN = MSISDN;

    console.log('[PinVerify] Sending payload:', payload);

    const response = await fetch(PIN_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    console.log('[PinVerify] Raw response:', text);

    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(text);
    } catch {
      console.error('[PinVerify] Failed to parse response JSON:', text);
      return NextResponse.json(
        { error: 'Invalid response from carrier API', raw: text },
        { status: 502 }
      );
    }

    const normalized = {
      Status: String(raw.Status ?? raw.status ?? raw.STATUS ?? ''),
      raw,
    };

    console.log('[PinVerify] Status:', normalized.Status);
    return NextResponse.json(normalized);
  } catch (err) {
    console.error('[PinVerify] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
