import { NextRequest, NextResponse } from 'next/server';
import { getCountryFromIP, resolveTelco } from '@/lib/telco';

/**
 * Detect user's country from IP and determine flow type.
 */
export async function GET(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
  const qIP = new URL(request.url).searchParams.get('ip');
  const userIP = qIP || ip;

  try {
    const resolution = await resolveTelco(userIP);

    return NextResponse.json({
      ip: userIP,
      countryCode: resolution.geo.countryCode,
      countryName: resolution.geo.countryName,
      flowType: resolution.flowType,
      countryEnabled: resolution.country?.is_enabled ?? false,
      telcoId: resolution.telco?.id ?? null,
      telcoName: resolution.telco?.name ?? null,
      outsideSchedule: resolution.outsideSchedule,
    });
  } catch (e) {
    console.error('[detect-country]', e);
    return NextResponse.json({ ip: userIP, countryCode: '', flowType: 'unknown' });
  }
}
