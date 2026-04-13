import { NextRequest, NextResponse } from 'next/server';
import { getAllTelcos, upsertTelco, deleteTelco } from '@/lib/telco';

export async function GET() {
  const telcos = await getAllTelcos();
  return NextResponse.json({ telcos });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, country_code, country_name, user_telco_service_id, ad_agency_campaign_id,
            callback_url, success_page_url, failure_page_url,
            schedule_start, schedule_end, timezone, priority, is_enabled } = body;

    if (!name || !country_code || user_telco_service_id == null || ad_agency_campaign_id == null) {
      return NextResponse.json({ error: 'name, country_code, user_telco_service_id, ad_agency_campaign_id are required' }, { status: 400 });
    }

    const result = await upsertTelco({
      name,
      country_code: String(country_code).toUpperCase(),
      country_name: country_name || '',
      user_telco_service_id: Number(user_telco_service_id),
      ad_agency_campaign_id: Number(ad_agency_campaign_id),
      callback_url: callback_url || '',
      success_page_url: success_page_url || '',
      failure_page_url: failure_page_url || '',
      schedule_start: schedule_start || '00:00',
      schedule_end: schedule_end || '23:59',
      timezone: timezone || 'UTC',
      priority: Number(priority || 0),
      is_enabled: is_enabled !== false,
    });

    if (!result.success) {
      return NextResponse.json({ error: 'Failed to create telco' }, { status: 500 });
    }

    const telcos = await getAllTelcos();
    return NextResponse.json({ success: true, id: result.id, telcos });
  } catch (e) {
    console.error('[admin/telcos] POST error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const result = await upsertTelco(body);
    if (!result.success) {
      return NextResponse.json({ error: 'Failed to update telco' }, { status: 500 });
    }

    const telcos = await getAllTelcos();
    return NextResponse.json({ success: true, telcos });
  } catch (e) {
    console.error('[admin/telcos] PUT error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const ok = await deleteTelco(id);
    if (!ok) {
      return NextResponse.json({ error: 'Failed to delete telco' }, { status: 500 });
    }

    const telcos = await getAllTelcos();
    return NextResponse.json({ success: true, telcos });
  } catch (e) {
    console.error('[admin/telcos] DELETE error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
