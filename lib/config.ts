import { createClient } from '@supabase/supabase-js';

export interface SiteConfig {
  content_url: string;
  app_url: string;
  redirect_to: 'content' | 'thankyou';
}

const DEFAULT_CONFIG: SiteConfig = {
  content_url: 'https://www.xoomsports.com',
  app_url: 'https://www.xoomsports.com',
  redirect_to: 'content',
};

function getServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url === 'your_supabase_url' || !url.startsWith('http')) {
    return null;
  }

  return createClient(url, key);
}

export async function getConfig(): Promise<SiteConfig> {
  const client = getServerClient();
  if (!client) return DEFAULT_CONFIG;

  try {
    const { data, error } = await client
      .from('config')
      .select('key, value')
      .in('key', ['content_url', 'app_url', 'redirect_to']);

    if (error || !data || data.length === 0) return DEFAULT_CONFIG;

    const config = { ...DEFAULT_CONFIG };
    for (const row of data) {
      if (row.key in config) {
        (config as Record<string, string>)[row.key] = row.value;
      }
    }
    return config;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function setConfig(updates: Partial<SiteConfig>): Promise<boolean> {
  const client = getServerClient();
  if (!client) return false;

  try {
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      const { error } = await client
        .from('config')
        .upsert({ key, value: String(value) }, { onConflict: 'key' });

      if (error) {
        console.error(`[Config] Failed to set ${key}:`, error);
        return false;
      }
    }
    return true;
  } catch (e) {
    console.error('[Config] setConfig error:', e);
    return false;
  }
}
