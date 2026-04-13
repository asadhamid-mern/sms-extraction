'use client';

import { useEffect, useState } from 'react';
import type { Country, Telco } from '@/types';

interface Config {
  content_url: string;
  app_url: string;
  redirect_to: 'content' | 'thankyou';
  subscription_provider: 'kuwait_dcb' | 'vas_universal';
  vas_user_telco_service_id: string;
  vas_ad_agency_campaign_id: string;
}

type TabId = 'general' | 'countries' | 'telcos';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [config, setConfig] = useState<Config | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [telcos, setTelcos] = useState<Telco[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  // General config state
  const [contentUrl, setContentUrl] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [redirectTo, setRedirectTo] = useState<'content' | 'thankyou'>('content');
  const [subscriptionProvider, setSubscriptionProvider] = useState<'kuwait_dcb' | 'vas_universal'>('kuwait_dcb');
  const [vasUserTelcoServiceId, setVasUserTelcoServiceId] = useState('100');
  const [vasAdAgencyCampaignId, setVasAdAgencyCampaignId] = useState('100');

  // Telco form state
  const [showTelcoForm, setShowTelcoForm] = useState(false);
  const [editingTelco, setEditingTelco] = useState<Partial<Telco> | null>(null);

  function showMessage(msg: string, type: 'success' | 'error') {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 4000);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cfgRes, countriesRes, telcosRes] = await Promise.all([
          fetch('/api/admin/config'),
          fetch('/api/admin/countries'),
          fetch('/api/admin/telcos'),
        ]);
        const cfgData = await cfgRes.json();
        const countriesData = await countriesRes.json();
        const telcosData = await telcosRes.json();
        if (cancelled) return;

        setConfig(cfgData);
        setContentUrl(cfgData.content_url);
        setAppUrl(cfgData.app_url);
        setRedirectTo(cfgData.redirect_to);
        setSubscriptionProvider(cfgData.subscription_provider ?? 'kuwait_dcb');
        setVasUserTelcoServiceId(cfgData.vas_user_telco_service_id ?? '100');
        setVasAdAgencyCampaignId(cfgData.vas_ad_agency_campaign_id ?? '100');
        setCountries(countriesData.countries || []);
        setTelcos(telcosData.telcos || []);
      } catch {
        if (!cancelled) showMessage('Failed to load config', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSaveConfig(e: React.FormEvent) {
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
          subscription_provider: subscriptionProvider,
          vas_user_telco_service_id: vasUserTelcoServiceId,
          vas_ad_agency_campaign_id: vasAdAgencyCampaignId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        showMessage('Settings saved!', 'success');
      } else {
        showMessage(data.error || 'Failed to save', 'error');
      }
    } catch {
      showMessage('Network error', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleCountry(code: string, field: string, value: unknown) {
    const country = countries.find(c => c.code === code);
    if (!country) return;

    try {
      const res = await fetch('/api/admin/countries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...country, [field]: value }),
      });
      const data = await res.json();
      if (data.success) {
        setCountries(data.countries);
      } else {
        showMessage('Failed to update country', 'error');
      }
    } catch {
      showMessage('Network error', 'error');
    }
  }

  async function handleSaveTelco(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTelco) return;
    setSaving(true);

    try {
      const method = editingTelco.id ? 'PUT' : 'POST';
      const res = await fetch('/api/admin/telcos', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTelco),
      });
      const data = await res.json();
      if (data.success) {
        setTelcos(data.telcos);
        setShowTelcoForm(false);
        setEditingTelco(null);
        showMessage(editingTelco.id ? 'Telco updated!' : 'Telco created!', 'success');
      } else {
        showMessage(data.error || 'Failed to save telco', 'error');
      }
    } catch {
      showMessage('Network error', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTelco(id: string) {
    if (!confirm('Delete this telco?')) return;

    try {
      const res = await fetch('/api/admin/telcos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setTelcos(data.telcos);
        showMessage('Telco deleted', 'success');
      }
    } catch {
      showMessage('Failed to delete', 'error');
    }
  }

  async function handleToggleTelco(telco: Telco) {
    try {
      const res = await fetch('/api/admin/telcos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: telco.id, is_enabled: !telco.is_enabled }),
      });
      const data = await res.json();
      if (data.success) setTelcos(data.telcos);
    } catch {
      showMessage('Failed to toggle', 'error');
    }
  }

  function openNewTelco() {
    setEditingTelco({
      name: '',
      country_code: '',
      country_name: '',
      user_telco_service_id: 100,
      ad_agency_campaign_id: 100,
      callback_url: '',
      success_page_url: '',
      failure_page_url: '',
      schedule_start: '00:00',
      schedule_end: '23:59',
      timezone: 'UTC',
      priority: 0,
      is_enabled: true,
    });
    setShowTelcoForm(true);
  }

  function openEditTelco(telco: Telco) {
    setEditingTelco({ ...telco });
    setShowTelcoForm(true);
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
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#e2383a] rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Admin Panel</h1>
            <p className="text-white/30 text-sm">Manage subscription system</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#141923] rounded-xl p-1 mb-6 border border-white/5">
          {([
            { id: 'general' as TabId, label: 'General', icon: '⚙️' },
            { id: 'countries' as TabId, label: 'Countries', icon: '🌍' },
            { id: 'telcos' as TabId, label: 'Telcos', icon: '📡' },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-[#e2383a]/10 text-[#e2383a] border border-[#e2383a]/20'
                  : 'text-white/30 hover:text-white/50'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
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

        {/* ─── GENERAL TAB ───────────────────────────────────────── */}
        {activeTab === 'general' && (
          <form onSubmit={handleSaveConfig}>
            {/* Subscription flow */}
            <div className="bg-[#141923] rounded-2xl p-6 border border-white/5 mb-5">
              <h2 className="text-base font-bold text-white mb-4">Subscription Flow</h2>
              <div className="flex gap-3 mb-5">
                <button type="button" onClick={() => setSubscriptionProvider('kuwait_dcb')}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all border ${
                    subscriptionProvider === 'kuwait_dcb' ? 'bg-[#e2383a]/10 border-[#e2383a]/30 text-[#e2383a]' : 'bg-white/3 border-white/8 text-white/30 hover:border-white/15'
                  }`}>Kuwait DCB</button>
                <button type="button" onClick={() => setSubscriptionProvider('vas_universal')}
                  className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all border ${
                    subscriptionProvider === 'vas_universal' ? 'bg-[#e2383a]/10 border-[#e2383a]/30 text-[#e2383a]' : 'bg-white/3 border-white/8 text-white/30 hover:border-white/15'
                  }`}>VAS Universal</button>
              </div>
              {subscriptionProvider === 'vas_universal' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/60 text-xs font-semibold mb-2 uppercase tracking-wider">Default userTelcoServiceId</label>
                    <input type="text" inputMode="numeric" value={vasUserTelcoServiceId}
                      onChange={e => setVasUserTelcoServiceId(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e2383a]/50" />
                  </div>
                  <div>
                    <label className="block text-white/60 text-xs font-semibold mb-2 uppercase tracking-wider">Default adAgencyCampaignId</label>
                    <input type="text" inputMode="numeric" value={vasAdAgencyCampaignId}
                      onChange={e => setVasAdAgencyCampaignId(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e2383a]/50" />
                  </div>
                </div>
              )}
            </div>

            {/* URLs */}
            <div className="bg-[#141923] rounded-2xl p-6 border border-white/5 mb-5">
              <h2 className="text-base font-bold text-white mb-5">Redirect URLs</h2>
              <div className="mb-5">
                <label className="block text-white/60 text-xs font-semibold mb-2 uppercase tracking-wider">Content Page URL</label>
                <input type="url" value={contentUrl} onChange={e => setContentUrl(e.target.value)}
                  placeholder="https://www.goalzzz.net/"
                  className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e2383a]/50 placeholder:text-white/15" />
              </div>
              <div className="mb-5">
                <label className="block text-white/60 text-xs font-semibold mb-2 uppercase tracking-wider">App Content URL</label>
                <input type="url" value={appUrl} onChange={e => setAppUrl(e.target.value)}
                  placeholder="https://www.goalzzz.net/"
                  className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e2383a]/50 placeholder:text-white/15" />
              </div>
              <div>
                <label className="block text-white/60 text-xs font-semibold mb-2 uppercase tracking-wider">After Subscription</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setRedirectTo('content')}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all border ${
                      redirectTo === 'content' ? 'bg-[#e2383a]/10 border-[#e2383a]/30 text-[#e2383a]' : 'bg-white/3 border-white/8 text-white/30'
                    }`}>Content Page</button>
                  <button type="button" onClick={() => setRedirectTo('thankyou')}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all border ${
                      redirectTo === 'thankyou' ? 'bg-[#e2383a]/10 border-[#e2383a]/30 text-[#e2383a]' : 'bg-white/3 border-white/8 text-white/30'
                    }`}>Thank You Page</button>
                </div>
              </div>
            </div>

            {/* Live Config */}
            {config && (
              <div className="bg-[#141923] rounded-2xl p-6 border border-white/5 mb-5">
                <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full" /> Live Configuration
                </h2>
                <div className="space-y-2 text-sm">
                  {[
                    ['Provider', config.subscription_provider === 'vas_universal' ? 'VAS Universal' : 'Kuwait DCB'],
                    ['Content URL', config.content_url],
                    ['App URL', config.app_url],
                    ['Redirect', config.redirect_to === 'content' ? 'Content Page' : 'Thank You Page'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <span className="text-white/30 shrink-0">{k}</span>
                      <span className="text-white/60 font-mono text-right break-all">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button type="submit" disabled={saving}
              className="w-full bg-[#e2383a] hover:bg-[#c42f31] disabled:bg-white/10 disabled:text-white/30 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-[#e2383a]/15 disabled:shadow-none flex items-center justify-center gap-2">
              {saving ? (
                <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
              ) : (
                <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Save Settings</>
              )}
            </button>
          </form>
        )}

        {/* ─── COUNTRIES TAB ──────────────────────────────────────── */}
        {activeTab === 'countries' && (
          <div className="space-y-3">
            <p className="text-white/30 text-sm mb-4">Toggle countries ON/OFF and set their flow type (DCB = carrier billing, Global = Google Sign-In + Twilio OTP).</p>
            {countries.map(country => (
              <div key={country.code} className="bg-[#141923] rounded-xl p-4 border border-white/5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-sm">{country.name}</span>
                    <span className="text-white/20 text-xs font-mono">{country.code}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      country.flow_type === 'dcb' ? 'bg-blue-500/10 text-blue-400' :
                      country.flow_type === 'global' ? 'bg-purple-500/10 text-purple-400' :
                      'bg-white/5 text-white/30'
                    }`}>{country.flow_type}</span>
                  </div>
                </div>

                <select
                  value={country.flow_type}
                  onChange={e => handleToggleCountry(country.code, 'flow_type', e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white/70 text-xs outline-none appearance-none cursor-pointer"
                >
                  <option value="dcb">DCB</option>
                  <option value="global">Global</option>
                  <option value="disabled">Disabled</option>
                </select>

                <button
                  onClick={() => handleToggleCountry(country.code, 'is_enabled', !country.is_enabled)}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    country.is_enabled ? 'bg-green-500' : 'bg-white/10'
                  }`}
                >
                  <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                    country.is_enabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ─── TELCOS TAB ─────────────────────────────────────────── */}
        {activeTab === 'telcos' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-white/30 text-sm">Manage telco configurations for different countries.</p>
              <button onClick={openNewTelco}
                className="bg-[#e2383a] hover:bg-[#c42f31] text-white text-sm font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Telco
              </button>
            </div>

            {/* Telco list */}
            <div className="space-y-3 mb-6">
              {telcos.map(telco => (
                <div key={telco.id} className="bg-[#141923] rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm">{telco.name}</span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        telco.is_enabled ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-white/30'
                      }`}>{telco.is_enabled ? 'Active' : 'Off'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleToggleTelco(telco)}
                        className={`relative w-10 h-6 rounded-full transition-colors ${telco.is_enabled ? 'bg-green-500' : 'bg-white/10'}`}>
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${telco.is_enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                      <button onClick={() => openEditTelco(telco)} className="text-white/30 hover:text-white/60 text-xs font-semibold">Edit</button>
                      <button onClick={() => handleDeleteTelco(telco.id)} className="text-red-400/50 hover:text-red-400 text-xs font-semibold">Delete</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div><span className="text-white/25">Country:</span> <span className="text-white/50">{telco.country_code}</span></div>
                    <div><span className="text-white/25">SvcID:</span> <span className="text-white/50 font-mono">{telco.user_telco_service_id}</span></div>
                    <div><span className="text-white/25">CmpID:</span> <span className="text-white/50 font-mono">{telco.ad_agency_campaign_id}</span></div>
                    <div><span className="text-white/25">Schedule:</span> <span className="text-white/50">{telco.schedule_start}–{telco.schedule_end}</span></div>
                  </div>
                </div>
              ))}
              {telcos.length === 0 && (
                <p className="text-white/20 text-sm text-center py-8">No telcos configured yet.</p>
              )}
            </div>

            {/* Telco form modal */}
            {showTelcoForm && editingTelco && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-[#141923] rounded-2xl p-6 border border-white/10 w-full max-w-md max-h-[90vh] overflow-y-auto">
                  <h3 className="text-lg font-bold text-white mb-5">{editingTelco.id ? 'Edit Telco' : 'New Telco'}</h3>
                  <form onSubmit={handleSaveTelco} className="space-y-4">
                    <div>
                      <label className="block text-white/50 text-xs font-semibold mb-1 uppercase">Name</label>
                      <input type="text" value={editingTelco.name || ''} onChange={e => setEditingTelco(p => ({ ...p!, name: e.target.value }))}
                        placeholder="e.g. Zain Kuwait" required
                        className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e2383a]/50 placeholder:text-white/15" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-white/50 text-xs font-semibold mb-1 uppercase">Country Code</label>
                        <input type="text" value={editingTelco.country_code || ''} onChange={e => setEditingTelco(p => ({ ...p!, country_code: e.target.value.toUpperCase() }))}
                          placeholder="KW" maxLength={2} required
                          className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e2383a]/50 placeholder:text-white/15" />
                      </div>
                      <div>
                        <label className="block text-white/50 text-xs font-semibold mb-1 uppercase">Country Name</label>
                        <input type="text" value={editingTelco.country_name || ''} onChange={e => setEditingTelco(p => ({ ...p!, country_name: e.target.value }))}
                          placeholder="Kuwait"
                          className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e2383a]/50 placeholder:text-white/15" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-white/50 text-xs font-semibold mb-1 uppercase">userTelcoServiceId</label>
                        <input type="number" value={editingTelco.user_telco_service_id ?? 100} onChange={e => setEditingTelco(p => ({ ...p!, user_telco_service_id: parseInt(e.target.value) || 0 }))}
                          required className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e2383a]/50" />
                      </div>
                      <div>
                        <label className="block text-white/50 text-xs font-semibold mb-1 uppercase">adAgencyCampaignId</label>
                        <input type="number" value={editingTelco.ad_agency_campaign_id ?? 100} onChange={e => setEditingTelco(p => ({ ...p!, ad_agency_campaign_id: parseInt(e.target.value) || 0 }))}
                          required className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e2383a]/50" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-white/50 text-xs font-semibold mb-1 uppercase">Schedule Start</label>
                        <input type="time" value={editingTelco.schedule_start || '00:00'} onChange={e => setEditingTelco(p => ({ ...p!, schedule_start: e.target.value }))}
                          className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e2383a]/50" />
                      </div>
                      <div>
                        <label className="block text-white/50 text-xs font-semibold mb-1 uppercase">Schedule End</label>
                        <input type="time" value={editingTelco.schedule_end || '23:59'} onChange={e => setEditingTelco(p => ({ ...p!, schedule_end: e.target.value }))}
                          className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e2383a]/50" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-white/50 text-xs font-semibold mb-1 uppercase">Timezone</label>
                      <input type="text" value={editingTelco.timezone || 'UTC'} onChange={e => setEditingTelco(p => ({ ...p!, timezone: e.target.value }))}
                        placeholder="Asia/Kuwait"
                        className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e2383a]/50 placeholder:text-white/15" />
                    </div>
                    <div>
                      <label className="block text-white/50 text-xs font-semibold mb-1 uppercase">Callback URL (Flow A / CG)</label>
                      <input type="text" value={editingTelco.callback_url || ''} onChange={e => setEditingTelco(p => ({ ...p!, callback_url: e.target.value }))}
                        placeholder="https://yourdomain.com/api/vas/cg-callback"
                        className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e2383a]/50 placeholder:text-white/15" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-white/50 text-xs font-semibold mb-1 uppercase">Success Page URL</label>
                        <input type="text" value={editingTelco.success_page_url || ''} onChange={e => setEditingTelco(p => ({ ...p!, success_page_url: e.target.value }))}
                          className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e2383a]/50 placeholder:text-white/15" />
                      </div>
                      <div>
                        <label className="block text-white/50 text-xs font-semibold mb-1 uppercase">Failure Page URL</label>
                        <input type="text" value={editingTelco.failure_page_url || ''} onChange={e => setEditingTelco(p => ({ ...p!, failure_page_url: e.target.value }))}
                          className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e2383a]/50 placeholder:text-white/15" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-white/50 text-xs font-semibold mb-1 uppercase">Priority (higher = preferred)</label>
                      <input type="number" value={editingTelco.priority ?? 0} onChange={e => setEditingTelco(p => ({ ...p!, priority: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e2383a]/50" />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => { setShowTelcoForm(false); setEditingTelco(null); }}
                        className="flex-1 py-3 px-4 rounded-xl text-sm font-bold bg-white/5 text-white/50 border border-white/8 hover:bg-white/10 transition-all">
                        Cancel
                      </button>
                      <button type="submit" disabled={saving}
                        className="flex-1 py-3 px-4 rounded-xl text-sm font-bold bg-[#e2383a] text-white hover:bg-[#c42f31] transition-all disabled:bg-white/10 disabled:text-white/30">
                        {saving ? 'Saving...' : 'Save Telco'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-white/10 text-xs mt-8">GoalNowX Admin Panel</p>
      </div>
    </div>
  );
}
