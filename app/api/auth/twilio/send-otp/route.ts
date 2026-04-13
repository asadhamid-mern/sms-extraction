import { NextRequest, NextResponse } from 'next/server';
import { twilioSendOTP } from '@/lib/twilio';
import { getGlobalUserBySession } from '@/lib/google-auth';

/**
 * Send OTP via Twilio Verify to the user's phone number.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body;

    // Get session from cookie or body
    const sessionToken =
      request.cookies.get('session_token')?.value || body.sessionToken;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!phone) {
      return NextResponse.json({ error: 'phone is required' }, { status: 400 });
    }

    // Verify user exists
    const user = await getGlobalUserBySession(sessionToken);
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Normalize phone: ensure it starts with +
    const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;

    const result = await twilioSendOTP(normalizedPhone);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send OTP' }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: result.status });
  } catch (e) {
    console.error('[auth/twilio/send-otp]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
