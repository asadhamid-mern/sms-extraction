import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { vasPinRequestWithRetry } from '@/lib/vas-api';

/** Debug / tooling: mirrors app JSON body to VAS pinrequest. Main flow uses /api/vas/otp-page. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      msisdn,
      adAgencyCampaignTransactionId,
      userIP,
      ua,
      userTelcoServiceId,
      adAgencyCampaignId,
    } = body as Record<string, unknown>;

    if (!adAgencyCampaignTransactionId || !userIP) {
      return NextResponse.json(
        { error: 'adAgencyCampaignTransactionId and userIP are required' },
        { status: 400 }
      );
    }

    const cfg = await getConfig();
    const sid =
      typeof userTelcoServiceId === 'number'
        ? userTelcoServiceId
        : parseInt(String(userTelcoServiceId ?? cfg.vas_user_telco_service_id), 10);
    const cid =
      typeof adAgencyCampaignId === 'number'
        ? adAgencyCampaignId
        : parseInt(
            String(adAgencyCampaignId ?? cfg.vas_ad_agency_campaign_id),
            10
          );

    const res = await vasPinRequestWithRetry({
      msisdn: msisdn != null ? String(msisdn) : undefined,
      userTelcoServiceId: sid,
      adAgencyCampaignId: cid,
      adAgencyCampaignTransactionId: String(adAgencyCampaignTransactionId),
      userIP: String(userIP),
      ua: String(ua ?? request.headers.get('user-agent') ?? ''),
    });

    return NextResponse.json(res);
  } catch (e) {
    console.error('[vas/pin-request]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
