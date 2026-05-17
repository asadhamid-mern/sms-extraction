/**
 * Multi-telco resolution: IP → country → telco config.
 * Server-side only.
 */

import { createClient } from '@supabase/supabase-js';
import type { Telco, Country, GeoIPResult } from '@/types';

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url === 'your_supabase_url' || !url.startsWith('http')) return null;
  return createClient(url, key);
}

// ── GeoIP (free, rate-limited 45 req/min) ─────────────────────────

const geoCache = new Map<string, { result: GeoIPResult; ts: number }>();
const GEO_CACHE_TTL = 5 * 60 * 1000; // 5 min

export async function getCountryFromIP(ip: string): Promise<GeoIPResult> {
  if (!ip || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { countryCode: '', countryName: 'Localhost', city: '', isp: '' };
  }

  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.ts < GEO_CACHE_TTL) return cached.result;

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode,country,city,isp`, {
      signal: AbortSignal.timeout(4000),
    });
    const data = await res.json();
    if (data.status === 'success') {
      const result: GeoIPResult = {
        countryCode: data.countryCode || '',
        countryName: data.country || '',
        city: data.city || '',
        isp: data.isp || '',
      };
      geoCache.set(ip, { result, ts: Date.now() });
      return result;
    }
  } catch (e) {
    console.error('[Telco] GeoIP error:', e);
  }

  return { countryCode: '', countryName: '', city: '', isp: '' };
}

// ── Country lookup ────────────────────────────────────────────────

export async function getCountry(code: string): Promise<Country | null> {
  const client = getClient();
  if (!client || !code) return null;

  try {
    const { data, error } = await client
      .from('countries')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();
    if (error || !data) return null;
    return data as Country;
  } catch {
    return null;
  }
}

export async function getAllCountries(): Promise<Country[]> {
  const client = getClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('countries')
      .select('*')
      .order('name', { ascending: true });
    if (error || !data) return [];
    return data as Country[];
  } catch {
    return [];
  }
}

export async function upsertCountry(country: Partial<Country> & { code: string }): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('countries')
      .upsert(
        { ...country, updated_at: new Date().toISOString() },
        { onConflict: 'code' }
      );
    return !error;
  } catch {
    return false;
  }
}

// ── Telco lookup ──────────────────────────────────────────────────

export async function getTelcosForCountry(countryCode: string): Promise<Telco[]> {
  const client = getClient();
  if (!client || !countryCode) return [];

  try {
    const { data, error } = await client
      .from('telcos')
      .select('*')
      .eq('country_code', countryCode.toUpperCase())
      .eq('is_enabled', true)
      .order('priority', { ascending: false });
    if (error || !data) return [];
    return data as Telco[];
  } catch {
    return [];
  }
}

export async function getAllTelcos(): Promise<Telco[]> {
  const client = getClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('telcos')
      .select('*')
      .order('country_code', { ascending: true })
      .order('priority', { ascending: false });
    if (error || !data) return [];
    return data as Telco[];
  } catch {
    return [];
  }
}

export async function getTelcoById(id: string): Promise<Telco | null> {
  const client = getClient();
  if (!client || !id) return null;

  try {
    const { data, error } = await client
      .from('telcos')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return data as Telco;
  } catch {
    return null;
  }
}

export async function upsertTelco(telco: Partial<Telco>): Promise<{ success: boolean; id?: string }> {
  const client = getClient();
  if (!client) return { success: false };

  try {
    const payload = { ...telco, updated_at: new Date().toISOString() };
    if (telco.id) {
      const { error } = await client.from('telcos').update(payload).eq('id', telco.id);
      return { success: !error, id: telco.id };
    } else {
      const { data, error } = await client.from('telcos').insert(payload).select('id').single();
      return { success: !error, id: data?.id };
    }
  } catch {
    return { success: false };
  }
}

export async function deleteTelco(id: string): Promise<boolean> {
  const client = getClient();
  if (!client || !id) return false;

  try {
    const { error } = await client.from('telcos').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

// ── Schedule check ────────────────────────────────────────────────

export function isWithinSchedule(telco: Telco): boolean {
  try {
    const now = new Date();
    // Convert to telco's local time
    const localTime = new Date(now.toLocaleString('en-US', { timeZone: telco.timezone || 'UTC' }));
    const hhmm = `${String(localTime.getHours()).padStart(2, '0')}:${String(localTime.getMinutes()).padStart(2, '0')}`;
    const start = telco.schedule_start || '00:00';
    const end = telco.schedule_end || '23:59';

    // Handle overnight schedules (e.g., 22:00 - 06:00)
    if (start <= end) {
      return hhmm >= start && hhmm <= end;
    } else {
      return hhmm >= start || hhmm <= end;
    }
  } catch {
    return true; // Default to allowing if timezone conversion fails
  }
}

// ── Master resolver ───────────────────────────────────────────────

export interface TelcoResolution {
  country: Country | null;
  telco: Telco | null;
  geo: GeoIPResult;
  flowType: 'dcb' | 'global' | 'disabled' | 'unknown';
  outsideSchedule: boolean;
}

export async function resolveTelco(userIP: string): Promise<TelcoResolution> {
  const geo = await getCountryFromIP(userIP);

  if (!geo.countryCode) {
    return { country: null, telco: null, geo, flowType: 'unknown', outsideSchedule: false };
  }

  // ── HARDCODED: Kuwait always enabled (DCB flow via carrier HE) ──
  // Even if Kuwait is missing from the `countries` table or disabled,
  // we always allow the DCB flow so Kuwait users are never blocked.
  if (geo.countryCode.toUpperCase() === 'KW') {
    console.log('[Telco] Kuwait detected — using hardcoded DCB flow, bypassing DB check');
    const dbCountry = await getCountry(geo.countryCode);
    const country: Country = dbCountry || {
      code: 'KW',
      name: 'Kuwait',
      flow_type: 'dcb',
      is_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Country;
    return { country, telco: null, geo, flowType: 'dcb', outsideSchedule: false };
  }

  const country = await getCountry(geo.countryCode);

  if (!country || !country.is_enabled) {
    return {
      country,
      telco: null,
      geo,
      flowType: country ? (country.flow_type as 'dcb' | 'global' | 'disabled') : 'disabled',
      outsideSchedule: false,
    };
  }

  const flowType = (country.flow_type || 'dcb') as 'dcb' | 'global' | 'disabled';

  if (flowType === 'global') {
    return { country, telco: null, geo, flowType: 'global', outsideSchedule: false };
  }

  // DCB flow — find matching telco
  const telcos = await getTelcosForCountry(geo.countryCode);
  if (telcos.length === 0) {
    return { country, telco: null, geo, flowType: 'dcb', outsideSchedule: false };
  }

  // Pick the highest-priority enabled telco that is within schedule
  for (const t of telcos) {
    if (isWithinSchedule(t)) {
      return { country, telco: t, geo, flowType: 'dcb', outsideSchedule: false };
    }
  }

  // All telcos are outside schedule
  return { country, telco: telcos[0], geo, flowType: 'dcb', outsideSchedule: true };
}
