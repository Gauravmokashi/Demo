// The browser talks to /api on the frontend's own origin; Next.js proxies it to the NestJS API.
// One origin means the SameSite=Strict session cookie works in any deployment, with no CORS.
const apiProxyTarget = (process.env.API_PROXY_TARGET || 'http://localhost:4000').replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiProxyTarget}/api/:path*` }];
  },
};

export default nextConfig;
