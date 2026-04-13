import { NextRequest, NextResponse } from 'next/server';
import { vasPinVerify } from '@/lib/vas-api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adAgencyCampaignTransactionId, pin } = body as Record<string, unknown>;

    if (!adAgencyCampaignTransactionId || pin == null || pin === '') {
      return NextResponse.json(
        { error: 'adAgencyCampaignTransactionId and pin are required' },
        { status: 400 }
      );
    }

    const res = await vasPinVerify(
      String(adAgencyCampaignTransactionId),
      String(pin)
    );
    return NextResponse.json(res);
  } catch (e) {
    console.error('[vas/pin-verify]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
