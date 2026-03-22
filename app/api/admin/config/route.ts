import { NextRequest, NextResponse } from 'next/server';
import { getConfig, setConfig } from '@/lib/config';

export async function GET() {
  const config = await getConfig();
  return NextResponse.json(config);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content_url, app_url, redirect_to } = body;

    const updates: Record<string, string> = {};
    if (content_url !== undefined) updates.content_url = content_url;
    if (app_url !== undefined) updates.app_url = app_url;
    if (redirect_to !== undefined) updates.redirect_to = redirect_to;

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
