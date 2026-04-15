'use client';

import { FootballCollageBackdrop } from '@/components/FootballCollageBackdrop';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#0b0e14] flex flex-col relative overflow-hidden text-white font-sans">
      <FootballCollageBackdrop scrim="heavy" />
      
      <div className="relative z-10 px-6 py-12 max-w-3xl mx-auto">
        <div className="flex items-center gap-2.5 mb-10 justify-center">
          <div className="w-10 h-10 bg-[#e2383a] rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
          <span className="text-white font-extrabold text-2xl tracking-tight">GOAL<span className="text-[#e2383a]">NOWX</span></span>
        </div>

        <div className="bg-[#141923]/80 backdrop-blur-2xl rounded-3xl p-8 md:p-12 border border-white/10 shadow-2xl">
          <h1 className="text-3xl font-black mb-2">Privacy Policy</h1>
          <p className="text-white/40 text-sm mb-8 font-medium">Last Updated: April 14, 2026</p>

          <div className="space-y-8 text-white/70 leading-relaxed text-sm">
            <section>
              <h2 className="text-xl font-bold text-white mb-3">1. Overview</h2>
              <p>GoalNowX is committed to protecting your privacy. This policy explains how we collect and use your data when you use our mobile application and services.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">2. Information Collection</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="text-white/90">Identity Data:</strong> Name and email address (collected via Google Sign-In).</li>
                <li><strong className="text-white/90">Contact Data:</strong> Phone number (collected for SMS OTP verification).</li>
                <li><strong className="text-white/90">Usage Data:</strong> Information about how you use our app and subscription features.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">3. How We Use Data</h2>
              <p>We use your data to authenticate your account, verify your subscription via your telco or global login, and provide you with premium football content.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">4. Third Parties</h2>
              <p>We share data only with necessary service providers: <strong>Google</strong> (for authentication), <strong>Twilio</strong> (for SMS verification), and your mobile network operator (for carrier billing).</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">5. Data Deletion</h2>
              <p>You have the right to request the deletion of your account and personal data at any time by contacting our support team.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">6. Contact</h2>
              <p>If you have questions about this policy, please contact us at: <span className="text-[#e2383a] font-bold">goalnowx@gmail.com</span></p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
