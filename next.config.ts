import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow Vercel Blob URLs to be fetched in server-side API routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ]
  },
  turbopack: {},
}

export default nextConfig
