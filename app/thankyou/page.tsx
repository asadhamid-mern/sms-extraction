'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ThankYouPage() {
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Guard: user must have gone through the flow
    const trxId = sessionStorage.getItem('trxId');
    if (!trxId) {
      router.replace('/');
      return;
    }
    // Slight delay for a polished entrance
    const t = setTimeout(() => setShow(true), 100);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center p-4">
      <div
        className={`bg-white rounded-2xl shadow-2xl p-10 w-full max-w-sm text-center transition-all duration-500 ${
          show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {/* Animated checkmark */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center animate-bounce">
            <svg
              className="w-12 h-12 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          You&apos;re Subscribed!
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-8">
          Welcome! Enjoy your exclusive premium content.
        </p>

        <button
          onClick={() => {
            // Replace with your actual content URL
            window.location.href = '/';
          }}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition-colors min-h-[48px]"
        >
          Watch Now
        </button>

        <p className="text-xs text-gray-400 mt-6 leading-relaxed">
          To unsubscribe, send{' '}
          <span className="font-medium">STOP</span> to{' '}
          <span className="font-medium">50995</span> or contact support.
        </p>
      </div>
    </div>
  );
}
