'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FootballCollageBackdrop } from '@/components/FootballCollageBackdrop';

export default function VerifyPhonePage() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'otp' | 'success'>('phone');
  const [phone, setPhone] = useState('');
  const [countryDialCode, setCountryDialCode] = useState('+1');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [userName, setUserName] = useState('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const session = sessionStorage.getItem('session_token');
    if (!session) {
      router.replace('/auth/google');
      return;
    }
    setUserName(sessionStorage.getItem('user_name') || '');

    // Detect country for dial code
    fetch('/api/detect-country')
      .then(r => r.json())
      .then(d => {
        const dialCodes: Record<string, string> = {
          US: '+1', GB: '+44', IN: '+91', PK: '+92', AE: '+971',
          SA: '+966', KW: '+965', BH: '+973', QA: '+974', OM: '+968',
          EG: '+20', JO: '+962', IQ: '+964',
        };
        if (d.countryCode && dialCodes[d.countryCode]) {
          setCountryDialCode(dialCodes[d.countryCode]);
        }
      })
      .catch(() => {});
  }, [router]);

  // Resend timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  async function handleSendOTP() {
    if (!phone || phone.length < 6) return;
    setSending(true);
    setError('');

    const fullPhone = `${countryDialCode}${phone}`;
    const sessionToken = sessionStorage.getItem('session_token');

    try {
      const res = await fetch('/api/auth/twilio/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, sessionToken }),
      });
      const data = await res.json();

      if (data.success) {
        setStep('otp');
        setResendTimer(60);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      } else {
        setError(data.error || 'Failed to send verification code');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  }

  function handleOtpInput(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setError('');

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all 6 digits entered
    const full = newOtp.join('');
    if (full.length === 6 && full.replace(/\D/g, '').length === 6) {
      handleVerifyOTP(full);
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) newOtp[i] = text[i] || '';
    setOtp(newOtp);
    if (text.length === 6) handleVerifyOTP(text);
  }

  async function handleVerifyOTP(code?: string) {
    const finalCode = code || otp.join('');
    if (finalCode.length !== 6) return;

    setVerifying(true);
    setError('');

    const fullPhone = `${countryDialCode}${phone}`;
    const sessionToken = sessionStorage.getItem('session_token');

    try {
      const res = await fetch('/api/auth/twilio/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, code: finalCode, sessionToken }),
      });
      const data = await res.json();

      if (data.verified) {
        setStep('success');
        // Redirect to content page after 2s
        setTimeout(() => {
          fetch('/api/admin/config')
            .then(r => r.json())
            .then(cfg => { window.location.href = cfg.content_url || 'https://www.goalzzz.net/'; })
            .catch(() => { window.location.href = '/thankyou'; });
        }, 2000);
      } else {
        setError(data.error || 'Invalid code. Please try again.');
        setOtp(['', '', '', '', '', '']);
        otpRefs.current[0]?.focus();
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (resendTimer > 0) return;
    setOtp(['', '', '', '', '', '']);
    setError('');
    await handleSendOTP();
  }

  return (
    <div className="min-h-screen bg-[#0b0e14] flex flex-col relative overflow-hidden">
      <FootballCollageBackdrop scrim="heavy" />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-[#e2383a] rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
          <span className="text-white font-extrabold text-lg tracking-tight">GOAL<span className="text-[#e2383a]">NOWX</span></span>
        </div>
        <div className="flex items-center gap-1.5 bg-white/5 rounded-full px-3 py-1.5">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-[11px] text-white/70 font-semibold uppercase tracking-wider">Step {step === 'phone' ? '1' : step === 'otp' ? '2' : '3'}/3</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-8 relative z-10">
        <div className="w-full max-w-sm">
          <div className="bg-[#141923]/90 backdrop-blur-xl rounded-2xl p-8 border border-white/10 shadow-2xl">

            {/* ─── PHONE INPUT ───────────────────────────── */}
            {step === 'phone' && (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  {userName && (
                    <p className="text-white/50 text-sm mb-1">Welcome, <span className="text-white/80 font-semibold">{userName}</span></p>
                  )}
                  <h1 className="text-xl font-black text-white mb-1">Verify Your Phone</h1>
                  <p className="text-white/40 text-sm">We&apos;ll send you a verification code</p>
                </div>

                <label className="block text-white/50 text-xs font-semibold mb-2 uppercase tracking-wider">
                  Phone Number
                </label>
                <div className="flex border border-white/10 rounded-xl overflow-hidden mb-5 focus-within:border-[#e2383a]/50 transition-colors bg-white/5">
                  <select
                    value={countryDialCode}
                    onChange={e => setCountryDialCode(e.target.value)}
                    className="bg-white/3 border-r border-white/10 px-2 py-4 text-white/70 text-sm font-bold outline-none appearance-none cursor-pointer"
                  >
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+91">🇮🇳 +91</option>
                    <option value="+92">🇵🇰 +92</option>
                    <option value="+971">🇦🇪 +971</option>
                    <option value="+966">🇸🇦 +966</option>
                    <option value="+965">🇰🇼 +965</option>
                    <option value="+973">🇧🇭 +973</option>
                    <option value="+974">🇶🇦 +974</option>
                    <option value="+968">🇴🇲 +968</option>
                    <option value="+20">🇪🇬 +20</option>
                    <option value="+962">🇯🇴 +962</option>
                    <option value="+964">🇮🇶 +964</option>
                  </select>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter your number"
                    className="flex-1 px-3.5 py-4 text-white text-base outline-none bg-transparent placeholder:text-white/20 font-medium"
                    maxLength={12}
                    autoFocus
                  />
                </div>

                {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}

                <button
                  onClick={handleSendOTP}
                  disabled={sending || phone.length < 6}
                  className="w-full bg-[#e2383a] hover:bg-[#c42f31] disabled:bg-white/10 disabled:text-white/30 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-[#e2383a]/20 disabled:shadow-none"
                >
                  {sending ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Send Verification Code
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>
              </>
            )}

            {/* ─── OTP INPUT ─────────────────────────────── */}
            {step === 'otp' && (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-[#e2383a]/10 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-8 h-8 text-[#e2383a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h1 className="text-xl font-black text-white mb-1">Enter Code</h1>
                  <p className="text-white/40 text-sm">
                    Sent to <span className="text-white/70 font-semibold">{countryDialCode}{phone}</span>
                  </p>
                </div>

                <div className="flex gap-2 justify-center mb-5" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => { otpRefs.current[i] = el; }}
                      type="tel"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpInput(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      className="w-12 h-14 text-center text-xl font-black rounded-xl border-2 border-white/10 bg-white/3 text-white outline-none focus:border-[#e2383a] focus:bg-[#e2383a]/5 transition-all"
                    />
                  ))}
                </div>

                {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}

                <button
                  onClick={() => handleVerifyOTP()}
                  disabled={verifying || otp.join('').length !== 6}
                  className="w-full bg-[#e2383a] hover:bg-[#c42f31] disabled:bg-white/10 disabled:text-white/30 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-[#e2383a]/20 disabled:shadow-none"
                >
                  {verifying ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify'
                  )}
                </button>

                <div className="text-center mt-5">
                  {resendTimer > 0 ? (
                    <p className="text-white/30 text-sm">Resend in <span className="text-[#e2383a] font-bold">{resendTimer}s</span></p>
                  ) : (
                    <button onClick={handleResend} className="text-[#e2383a] text-sm font-semibold hover:underline">
                      Resend Code
                    </button>
                  )}
                </div>

                <button
                  onClick={() => { setStep('phone'); setOtp(['', '', '', '', '', '']); setError(''); }}
                  className="mt-4 w-full text-white/30 text-sm font-medium hover:text-white/50"
                >
                  Change phone number
                </button>
              </>
            )}

            {/* ─── SUCCESS ───────────────────────────────── */}
            {step === 'success' && (
              <div className="text-center">
                <div className="w-20 h-20 bg-green-500/10 rounded-full mx-auto mb-6 flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-green-500/5 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
                  <svg className="w-10 h-10 text-green-500 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-2xl font-black text-white mb-2">You&apos;re All Set!</h1>
                <p className="text-white/40 text-sm mb-6">Your phone has been verified successfully.</p>
                <div className="w-8 h-8 border-[3px] border-[#e2383a]/20 border-t-[#e2383a] rounded-full animate-spin mx-auto" />
                <p className="text-white/25 text-xs mt-3">Redirecting to content...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
