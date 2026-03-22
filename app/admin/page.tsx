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

  // Form state
  const [contentUrl, setContentUrl] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [redirectTo, setRedirectTo] = useState<'content' | 'thankyou'>('content');

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      const res = await fetch('/api/admin/config');
      const data = await res.json();
      setConfig(data);
      setContentUrl(data.content_url);
      setAppUrl(data.app_url);
      setRedirectTo(data.redirect_to);
    } catch {
      showMessage('Failed to load config', 'error');
    } finally {
      setLoading(false);
    }
  }

  function showMessage(msg: string, type: 'success' | 'error') {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 4000);
  }

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
      <div className="min-h-screen bg-gradient-to-b from-[#0a1628] via-[#0d1f3c] to-[#0a1628] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1628] via-[#0d1f3c] to-[#0a1628] p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Admin Panel</h1>
          <p className="text-white/40 text-sm mt-1">Manage your DCB subscription system settings</p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl text-sm font-medium ${
            messageType === 'success'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/15 text-red-400 border border-red-500/20'
          }`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSave}>
          {/* URL Settings */}
          <div className="bg-white/7 backdrop-blur-xl rounded-2xl p-6 border border-white/8 shadow-xl mb-6">
            <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              URL Management
            </h2>
            <p className="text-white/30 text-xs mb-5">Configure where users are redirected after subscription</p>

            {/* Content URL */}
            <div className="mb-5">
              <label className="block text-white/70 text-sm font-semibold mb-2">
                Content Page URL
              </label>
              <p className="text-white/30 text-xs mb-2">
                Users are redirected here after successful subscription (web page)
              </p>
              <input
                type="url"
                value={contentUrl}
                onChange={e => setContentUrl(e.target.value)}
                placeholder="https://www.xoomsports.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-emerald-500/50 transition-colors placeholder:text-white/20"
              />
            </div>

            {/* App URL */}
            <div className="mb-5">
              <label className="block text-white/70 text-sm font-semibold mb-2">
                App Content URL
              </label>
              <p className="text-white/30 text-xs mb-2">
                Website loaded inside the WebView app after subscription
              </p>
              <input
                type="url"
                value={appUrl}
                onChange={e => setAppUrl(e.target.value)}
                placeholder="https://www.xoomsports.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-emerald-500/50 transition-colors placeholder:text-white/20"
              />
            </div>

            {/* Redirect Preference */}
            <div>
              <label className="block text-white/70 text-sm font-semibold mb-2">
                After Subscription Redirect
              </label>
              <p className="text-white/30 text-xs mb-3">
                Choose where to send users after successful OTP verification
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setRedirectTo('content')}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all border ${
                    redirectTo === 'content'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
                  }`}
                >
                  Content Page
                </button>
                <button
                  type="button"
                  onClick={() => setRedirectTo('thankyou')}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all border ${
                    redirectTo === 'thankyou'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
                  }`}
                >
                  Thank You Page
                </button>
              </div>
            </div>
          </div>

          {/* Current Config Display */}
          {config && (
            <div className="bg-white/7 backdrop-blur-xl rounded-2xl p-6 border border-white/8 shadow-xl mb-6">
              <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Current Live Settings
              </h2>
              <p className="text-white/30 text-xs mb-4">These are the settings currently active in production</p>

              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-white/50 text-sm shrink-0">Content URL:</span>
                  <span className="text-emerald-400 text-sm font-mono break-all text-right">{config.content_url}</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-white/50 text-sm shrink-0">App URL:</span>
                  <span className="text-emerald-400 text-sm font-mono break-all text-right">{config.app_url}</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-white/50 text-sm shrink-0">Redirect to:</span>
                  <span className="text-emerald-400 text-sm font-semibold">{config.redirect_to === 'content' ? 'Content Page' : 'Thank You Page'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/25 disabled:shadow-none flex items-center justify-center gap-2 text-base"
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

        {/* Footer */}
        <p className="text-center text-white/15 text-xs mt-8">
          DCB Subscription Admin Panel &bull; Kuwait Telecom
        </p>
      </div>
    </div>
  );
}
