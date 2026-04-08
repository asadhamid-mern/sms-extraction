'use client';

import { useEffect, useState } from 'react';

interface Config {
  content_url: string;
  app_url: string;
  redirect_to: 'content' | 'thankyou';
}

export default function AdminPanel() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const [contentUrl, setContentUrl] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [redirectTo, setRedirectTo] = useState<'content' | 'thankyou'>('content');

  function showMessage(msg: string, type: 'success' | 'error') {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 4000);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/config');
        const data = await res.json();
        if (cancelled) return;
        setConfig(data);
        setContentUrl(data.content_url);
        setAppUrl(data.app_url);
        setRedirectTo(data.redirect_to);
      } catch {
        if (!cancelled) showMessage('Failed to load config', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_url: contentUrl,
          app_url: appUrl,
          redirect_to: redirectTo,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        showMessage('Settings saved successfully!', 'success');
      } else {
        showMessage(data.error || 'Failed to save', 'error');
      }
    } catch {
      showMessage('Network error — please try again', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center">
        <div className="w-10 h-10 border-[3px] border-[#e2383a]/20 border-t-[#e2383a] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0e14] p-4 md:p-8">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-[#e2383a] rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Settings</h1>
            <p className="text-white/30 text-sm">Manage subscription system configuration</p>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-5 p-4 rounded-xl text-sm font-semibold ${
            messageType === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/15'
              : 'bg-red-500/10 text-red-400 border border-red-500/15'
          }`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSave}>
          {/* URL Settings */}
          <div className="bg-[#141923] rounded-2xl p-6 border border-white/5 mb-5">
            <h2 className="text-base font-bold text-white mb-5 flex items-center gap-2">
              <svg className="w-4 h-4 text-[#e2383a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Redirect URLs
            </h2>

            <div className="mb-5">
              <label className="block text-white/60 text-xs font-semibold mb-2 uppercase tracking-wider">
                Content Page URL
              </label>
              <p className="text-white/25 text-[11px] mb-2">
                Where users go after successful subscription (web)
              </p>
              <input
                type="url"
                value={contentUrl}
                onChange={e => setContentUrl(e.target.value)}
                placeholder="https://www.xoomsports.com"
                className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e2383a]/50 transition-colors placeholder:text-white/15 font-medium"
              />
            </div>

            <div className="mb-5">
              <label className="block text-white/60 text-xs font-semibold mb-2 uppercase tracking-wider">
                App Content URL
              </label>
              <p className="text-white/25 text-[11px] mb-2">
                Website loaded in the WebView app
              </p>
              <input
                type="url"
                value={appUrl}
                onChange={e => setAppUrl(e.target.value)}
                placeholder="https://www.xoomsports.com"
                className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e2383a]/50 transition-colors placeholder:text-white/15 font-medium"
              />
            </div>

            <div>
              <label className="block text-white/60 text-xs font-semibold mb-2 uppercase tracking-wider">
                After Subscription
              </label>
              <p className="text-white/25 text-[11px] mb-3">
                Where to redirect after OTP verification
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRedirectTo('content')}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all border ${
                    redirectTo === 'content'
                      ? 'bg-[#e2383a]/10 border-[#e2383a]/30 text-[#e2383a]'
                      : 'bg-white/3 border-white/8 text-white/30 hover:border-white/15'
                  }`}
                >
                  Content Page
                </button>
                <button
                  type="button"
                  onClick={() => setRedirectTo('thankyou')}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all border ${
                    redirectTo === 'thankyou'
                      ? 'bg-[#e2383a]/10 border-[#e2383a]/30 text-[#e2383a]'
                      : 'bg-white/3 border-white/8 text-white/30 hover:border-white/15'
                  }`}
                >
                  Thank You Page
                </button>
              </div>
            </div>
          </div>

          {/* Current Config Display */}
          {config && (
            <div className="bg-[#141923] rounded-2xl p-6 border border-white/5 mb-5">
              <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Live Configuration
              </h2>

              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-white/30 text-sm shrink-0">Content URL</span>
                  <span className="text-white/60 text-sm font-mono break-all text-right">{config.content_url}</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-white/30 text-sm shrink-0">App URL</span>
                  <span className="text-white/60 text-sm font-mono break-all text-right">{config.app_url}</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-white/30 text-sm shrink-0">Redirect</span>
                  <span className="text-white/60 text-sm font-semibold">{config.redirect_to === 'content' ? 'Content Page' : 'Thank You Page'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#e2383a] hover:bg-[#c42f31] disabled:bg-white/10 disabled:text-white/30 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-[#e2383a]/15 disabled:shadow-none flex items-center justify-center gap-2 text-base"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Settings
              </>
            )}
          </button>
        </form>

        <p className="text-center text-white/10 text-xs mt-8">
          XoomSports Admin Panel
        </p>
      </div>
    </div>
  );
}
