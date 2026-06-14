import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // @press/web ships TS/TSX source, so Next must transpile it rather than
  // expecting pre-built JS.
  transpilePackages: ['@press/web'],
};

export default config;
