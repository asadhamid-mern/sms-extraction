import { createClient } from '@supabase/supabase-js';

export type SubscriptionProvider = 'kuwait_dcb' | 'vas_universal';

export interface SiteConfig {
  content_url: string;
  app_url: string;
  redirect_to: 'content' | 'thankyou';
  /** Default keeps existing Kuwait HE + Future Club flow untouched. */
  subscription_provider: SubscriptionProvider;
  vas_user_telco_service_id: string;
  vas_ad_agency_campaign_id: string;
}

const DEFAULT_CONFIG: SiteConfig = {
  content_url: 'https://www.goalzzz.net/',
  app_url: 'https://www.goalzzz.net/',
  redirect_to: 'content',
  subscription_provider: 'kuwait_dcb',
  vas_user_telco_service_id: '100',
  vas_ad_agency_campaign_id: '100',
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
      .in('key', [
        'content_url',
        'app_url',
        'redirect_to',
        'subscription_provider',
        'vas_user_telco_service_id',
        'vas_ad_agency_campaign_id',
      ]);

    if (error || !data || data.length === 0) return DEFAULT_CONFIG;

    const config = { ...DEFAULT_CONFIG };
    for (const row of data) {
      const k = row.key as keyof SiteConfig;
      if (k in config && row.value != null) {
        if (k === 'redirect_to') {
          const v = String(row.value);
          if (v === 'content' || v === 'thankyou') {
            config.redirect_to = v;
          }
        } else if (k === 'subscription_provider') {
          const v = String(row.value);
          if (v === 'vas_universal' || v === 'kuwait_dcb') {
            config.subscription_provider = v;
          }
        } else {
          (config as Record<string, string>)[row.key] = String(row.value);
        }
      }
    }
    return config;
  } catch {
    return DEFAULT_CONFIG;
  }
}

const CONFIG_KEYS: (keyof SiteConfig)[] = [
  'content_url',
  'app_url',
  'redirect_to',
  'subscription_provider',
  'vas_user_telco_service_id',
  'vas_ad_agency_campaign_id',
];

export async function setConfig(updates: Partial<SiteConfig>): Promise<boolean> {
  const client = getServerClient();
  if (!client) return false;

  try {
    for (const key of CONFIG_KEYS) {
      const value = updates[key];
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
