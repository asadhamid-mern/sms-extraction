import { NextRequest, NextResponse } from 'next/server';
import { verifyGoogleToken, upsertGlobalUser } from '@/lib/google-auth';

/**
 * Google Sign-In backend — receives ID token, verifies, creates/updates user.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken, countryCode } = body;

    if (!idToken) {
      return NextResponse.json({ error: 'idToken is required' }, { status: 400 });
    }

    const payload = await verifyGoogleToken(idToken);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid Google token' }, { status: 401 });
    }

    const result = await upsertGlobalUser(payload, countryCode);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to create user' }, { status: 500 });
    }

    // Set session cookie
    const response = NextResponse.json({
      success: true,
      sessionToken: result.sessionToken,
      user: {
        email: payload.email,
        name: payload.name,
      },
    });

    response.cookies.set('session_token', result.sessionToken!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    return response;
  } catch (e) {
    console.error('[auth/google]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
