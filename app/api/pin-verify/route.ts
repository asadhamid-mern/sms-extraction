import { NextRequest, NextResponse } from 'next/server';

const PIN_VERIFY_URL =
  'https://vivavas1.future-club.com/fcc-evina-pin-flow-apis/PinVerify';

const SERVER_PARAMS = {
  UserId: '166',
  Password: 'Mobility_MI@123',
  ProductId: '479',
  TelcoId: '7',
  ShortCode: '50995',
};

// Try these field names in order until one succeeds
const OTP_FIELD_NAMES = ['OTP', 'Pin', 'PIN', 'otp', 'pin'];

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

    // Try each field name until we get a non-2804 response
    let lastRaw: Record<string, unknown> = {};
    let lastStatus = '';
    const tried: string[] = [];

    for (const fieldName of OTP_FIELD_NAMES) {
      const payload: Record<string, string> = {
        TransactionId,
        [fieldName]: Pin,
        ...SERVER_PARAMS,
      };
      if (MSISDN) payload.MSISDN = MSISDN;

      console.log(`[PinVerify] Trying field="${fieldName}" payload:`, { ...payload, Password: '***' });

      const response = await fetch(PIN_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      console.log(`[PinVerify] field="${fieldName}" response:`, text);

      let raw: Record<string, unknown>;
      try {
        raw = JSON.parse(text);
      } catch {
        console.error(`[PinVerify] field="${fieldName}" failed to parse:`, text);
        tried.push(`${fieldName}=parse_error`);
        continue;
      }

      const status = String(raw.Status ?? raw.status ?? raw.STATUS ?? '');
      tried.push(`${fieldName}=${status}`);
      lastRaw = raw;
      lastStatus = status;

      // If we got success or any non-2804 error, stop trying
      if (status === '0' || status === '103' || status !== '2804') {
        console.log(`[PinVerify] SUCCESS with field="${fieldName}" Status=${status}`);
        return NextResponse.json({
          Status: status,
          raw,
          _fieldUsed: fieldName,
          _tried: tried,
        });
      }

      console.log(`[PinVerify] field="${fieldName}" got 2804, trying next...`);
    }

    // All field names returned 2804 (or failed)
    console.log('[PinVerify] All field names tried:', tried);
    return NextResponse.json({
      Status: lastStatus || '2804',
      raw: lastRaw,
      _tried: tried,
    });
  } catch (err) {
    console.error('[PinVerify] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
