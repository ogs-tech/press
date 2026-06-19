import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // @ogs-tech/press-web ships TS/TSX source, so Next must transpile it rather than
  // expecting pre-built JS.
  transpilePackages: ['@ogs-tech/press-web'],
};

export default config;
