/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['avatar.vercel.sh', 'github.com']
  },
  webpack: (config, { isServer }) => {
    // Add fallbacks for node modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };

    // Add WASM support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    return config;
  },
  // Add public directory to asset prefix
  assetPrefix: process.env.NODE_ENV === 'production' ? '/_next' : '',
};

module.exports = nextConfig; 