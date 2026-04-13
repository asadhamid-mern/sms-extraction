import { NextRequest, NextResponse } from 'next/server';
import { getAllCountries, upsertCountry } from '@/lib/telco';

export async function GET() {
  const countries = await getAllCountries();
  return NextResponse.json({ countries });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, name, is_enabled, flow_type } = body;

    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 });
    }

    const ok = await upsertCountry({
      code: String(code).toUpperCase(),
      name: name || code,
      is_enabled: is_enabled === true,
      flow_type: flow_type || 'dcb',
    });

    if (!ok) {
      return NextResponse.json({ error: 'Failed to update country' }, { status: 500 });
    }

    const countries = await getAllCountries();
    return NextResponse.json({ success: true, countries });
  } catch (e) {
    console.error('[admin/countries] POST error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
