/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['web-tree-sitter'],
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
    if (isServer) {
      config.output.webassemblyModuleFilename = 'chunks/[modulehash].wasm';
      config.optimization.moduleIds = 'named';
    }
    return config;
  },
  output: 'standalone'
};

module.exports = nextConfig; 