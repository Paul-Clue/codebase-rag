/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@tree-sitter/tree-sitter'],
  },
  images: {
    domains: ['avatar.vercel.sh', 'github.com']
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },
  output: 'standalone'
};

module.exports = nextConfig; 