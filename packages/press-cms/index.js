'use strict';
// Root entrypoint — lets require.resolve('@press/cms') land at the package
// root so Strapi's plugin loader can find package.json next to this file.
module.exports = require('./dist/server/index.js');
