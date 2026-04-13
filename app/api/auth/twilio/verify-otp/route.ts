import { NextRequest, NextResponse } from 'next/server';
import { twilioVerifyOTP } from '@/lib/twilio';
import { getGlobalUserBySession, updatePhoneVerification } from '@/lib/google-auth';

/**
 * Verify OTP code via Twilio Verify. On success, marks user phone as verified.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, code } = body;

    const sessionToken =
      request.cookies.get('session_token')?.value || body.sessionToken;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!phone || !code) {
      return NextResponse.json({ error: 'phone and code are required' }, { status: 400 });
    }

    const user = await getGlobalUserBySession(sessionToken);
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;

    const result = await twilioVerifyOTP(normalizedPhone, code);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Verification failed' }, { status: 400 });
    }

    if (result.valid) {
      // Update user's phone verification status
      await updatePhoneVerification(sessionToken, normalizedPhone, true);

      return NextResponse.json({
        success: true,
        verified: true,
        status: result.status,
      });
    }

    return NextResponse.json({
      success: true,
      verified: false,
      status: result.status,
      error: 'Invalid code',
    });
  } catch (e) {
    console.error('[auth/twilio/verify-otp]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
