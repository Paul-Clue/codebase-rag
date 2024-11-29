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

    return config;
  },
};

module.exports = nextConfig; 