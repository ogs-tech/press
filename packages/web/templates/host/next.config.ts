import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // @ogs-tech/press-web ships TS/TSX source, so Next must transpile it rather than
  // expecting pre-built JS. @ogs-tech/press-shared also ships TS source and is now
  // a runtime dep of press-web (the PressTree validator), so it needs the same treatment.
  transpilePackages: ['@ogs-tech/press-web', '@ogs-tech/press-shared'],
};

export default config;
