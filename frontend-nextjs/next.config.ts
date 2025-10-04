import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: process.env.NODE_ENV === 'development'
              ? "connect-src 'self' http://localhost:8000 http://127.0.0.1:8000 wss: https:;"
              : "connect-src 'self' wss: https:;"
          },
        ],
      },
    ];
  },
};

export default nextConfig;
