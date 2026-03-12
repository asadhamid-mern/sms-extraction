import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Evina's obfuscated JS to execute as inline script.
  // Without this, Vercel's default CSP may silently block it.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: https: http:",
              "style-src 'self' 'unsafe-inline'",
              "connect-src 'self' https: http:",
              "img-src 'self' data: https: http:",
              "font-src 'self' data:",
              "frame-src 'self' https: http:",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
