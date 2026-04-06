import { NextRequest, NextResponse } from 'next/server';

const PIN_REQUEST_URL =
  'https://vivavas1.future-club.com/fcc-evina-pin-flow-apis/PinRequest';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { msisdn, trxId, userAgent, userIP } = body;

    if (!msisdn || !trxId) {
      return NextResponse.json(
        { error: 'msisdn and trxId are required' },
        { status: 400 }
      );
    }

    const normalizedMsisdn =
      msisdn.startsWith('965') || msisdn.startsWith('+965')
        ? msisdn.replace(/^\+/, '')
        : `965${msisdn}`;

    const payload = {
      MSISDN: normalizedMsisdn,
      TransactionId: trxId,
      Headers: userAgent || '',
      UserIP: userIP || '127.0.0.1',
      ...SERVER_PARAMS,
    };

    console.log(`[pin-request] PinRequest payload:`, { ...payload, Password: '***' });

    const res = await fetch(PIN_REQUEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const raw = await res.json();
    const status = String(raw.Status ?? raw.status ?? raw.STATUS ?? '');

    let evinaJS = String(
      raw.JS ?? raw.js ?? raw.Javascript ?? raw.javascript ??
      raw.Script ?? raw.script ?? raw.Evina ?? raw.evina ?? ''
    );

    evinaJS = evinaJS
      .trim()
      .replace(/^<script[^>]*>/i, '')
      .replace(/<\/script\s*>$/i, '')
      .trim();

    console.log(`[pin-request] PinRequest -> Status: ${status}, JS len: ${evinaJS.length}`);

    return NextResponse.json({ status, evinaJS });
  } catch (err) {
    console.error(`[pin-request] PinRequest error:`, err);
    return NextResponse.json(
      { error: 'PinRequest failed', status: 'error' },
      { status: 500 }
    );
  }
}
