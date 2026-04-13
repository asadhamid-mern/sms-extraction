import { NextRequest, NextResponse } from 'next/server';
import { getConfig, setConfig, type SiteConfig } from '@/lib/config';

export async function GET() {
  const config = await getConfig();
  return NextResponse.json(config);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      content_url,
      app_url,
      redirect_to,
      subscription_provider,
      vas_user_telco_service_id,
      vas_ad_agency_campaign_id,
    } = body;

    const updates: Partial<SiteConfig> = {};
    if (content_url !== undefined) updates.content_url = String(content_url);
    if (app_url !== undefined) updates.app_url = String(app_url);
    if (redirect_to === 'content' || redirect_to === 'thankyou')
      updates.redirect_to = redirect_to;
    if (subscription_provider === 'kuwait_dcb' || subscription_provider === 'vas_universal')
      updates.subscription_provider = subscription_provider;
    if (vas_user_telco_service_id !== undefined)
      updates.vas_user_telco_service_id = String(vas_user_telco_service_id);
    if (vas_ad_agency_campaign_id !== undefined)
      updates.vas_ad_agency_campaign_id = String(vas_ad_agency_campaign_id);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const success = await setConfig(updates);
    if (!success) {
      return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
    }

    const newConfig = await getConfig();
    return NextResponse.json({ success: true, config: newConfig });
  } catch (err) {
    console.error('[Admin Config] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
