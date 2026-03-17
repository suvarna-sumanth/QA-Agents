/** @type {import('next').NextConfig} */

const nextConfig = {
  // CLOUDFLARE_DISCOVERY_SCRIPT is set by scripts/run-dev-with-cloudflare.sh (or in .env) so Turbopack doesn't inline and try to resolve the path
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  serverExternalPackages: ['playwright', 'playwright-core', 'chromium-bidi', 'rebrowser-playwright'],
  devIndicators: {
    buildActivity: false,
    appIsrStatus: false,
  },
};

export default nextConfig;
