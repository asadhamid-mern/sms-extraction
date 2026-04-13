/**
 * Google OAuth ID token verification — no SDK needed.
 * Server-side only.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url === 'your_supabase_url' || !url.startsWith('http')) return null;
  return createClient(url, key);
}

export interface GoogleTokenPayload {
  sub: string;        // Google user ID
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
}

/**
 * Verify Google ID token using Google's tokeninfo endpoint.
 * No SDK/library needed — just a fetch call.
 */
export async function verifyGoogleToken(idToken: string): Promise<GoogleTokenPayload | null> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!res.ok) {
      console.error('[GoogleAuth] Token verification failed:', res.status);
      return null;
    }

    const data = await res.json();
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    // Verify audience matches our client ID
    if (clientId && data.aud !== clientId) {
      console.error('[GoogleAuth] Token audience mismatch');
      return null;
    }

    if (!data.sub || !data.email) {
      console.error('[GoogleAuth] Missing sub or email in token');
      return null;
    }

    return {
      sub: data.sub,
      email: data.email,
      email_verified: data.email_verified === 'true' || data.email_verified === true,
      name: data.name || data.email.split('@')[0],
      picture: data.picture,
    };
  } catch (e) {
    console.error('[GoogleAuth] Token verification error:', e);
    return null;
  }
}

/**
 * Create or update a global user from Google login, generate session token.
 */
export async function upsertGlobalUser(google: GoogleTokenPayload, countryCode?: string): Promise<{
  success: boolean;
  sessionToken?: string;
  userId?: string;
  error?: string;
}> {
  const client = getClient();
  if (!client) return { success: false, error: 'DB not configured' };

  const sessionToken = randomUUID();

  try {
    // Check if user exists
    const { data: existing } = await client
      .from('global_users')
      .select('id')
      .eq('google_id', google.sub)
      .single();

    if (existing) {
      // Update existing user
      const { error } = await client
        .from('global_users')
        .update({
          email: google.email,
          name: google.name,
          session_token: sessionToken,
          country_code: countryCode || '',
          updated_at: new Date().toISOString(),
        })
        .eq('google_id', google.sub);

      if (error) {
        console.error('[GoogleAuth] Update user error:', error);
        return { success: false, error: 'Failed to update user' };
      }

      return { success: true, sessionToken, userId: existing.id };
    }

    // Create new user
    const { data: newUser, error } = await client
      .from('global_users')
      .insert({
        google_id: google.sub,
        email: google.email,
        name: google.name,
        session_token: sessionToken,
        country_code: countryCode || '',
        subscription_status: 'none',
      })
      .select('id')
      .single();

    if (error || !newUser) {
      console.error('[GoogleAuth] Insert user error:', error);
      return { success: false, error: 'Failed to create user' };
    }

    return { success: true, sessionToken, userId: newUser.id };
  } catch (e) {
    console.error('[GoogleAuth] Upsert error:', e);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * Get global user by session token.
 */
export async function getGlobalUserBySession(sessionToken: string) {
  const client = getClient();
  if (!client || !sessionToken) return null;

  try {
    const { data, error } = await client
      .from('global_users')
      .select('*')
      .eq('session_token', sessionToken)
      .single();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Update phone verification status.
 */
export async function updatePhoneVerification(
  sessionToken: string,
  phone: string,
  verified: boolean
): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('global_users')
      .update({
        phone,
        phone_verified: verified,
        subscription_status: verified ? 'active' : 'pending_otp',
        updated_at: new Date().toISOString(),
      })
      .eq('session_token', sessionToken);
    return !error;
  } catch {
    return false;
  }
}
