/** @type {import('next').NextConfig} */
const isWindows = process.platform === 'win32';
const forceStandalone = process.env.BUILD_STANDALONE === 'true' || process.env.BUILD_STANDALONE === '1';

const nextConfig = {
  output: isWindows && !forceStandalone ? undefined : 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
