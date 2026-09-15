import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@kyra/ui'],
  typedRoutes: true,
}

export default nextConfig
