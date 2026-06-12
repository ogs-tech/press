#!/usr/bin/env node
// Committed CJS launcher — no tsx/TS runtime needed on the adopter's PATH. The
// real logic lives in compiled dist/cli.js (ship-dist, like @press/cms).
require('../dist/cli.js')
  .run(process.argv)
  .catch((err) => {
    console.error(err?.message ?? err);
    process.exit(1);
  });
