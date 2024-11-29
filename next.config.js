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

    // Configure WASM loading
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };

    return config;
  },
  // Remove assetPrefix as it's not needed
  output: 'standalone',
};

module.exports = nextConfig; 