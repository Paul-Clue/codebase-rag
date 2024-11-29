/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['./node_modules/**/*.wasm', './node_modules/**/*.proto'],
  },
  images: {
    domains: ['avatar.vercel.sh', 'github.com']
  },
  output: 'standalone'
};

module.exports = nextConfig; 