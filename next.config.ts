import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Evina's obfuscated JS to execute and phone home.
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
              // Evina needs to reach notify.dcbprotect.com + WebSocket ws.dcbprotect.com
              "connect-src 'self' https: http: wss://ws.dcbprotect.com:8080 wss:",
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
