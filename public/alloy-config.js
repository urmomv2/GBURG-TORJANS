// public/alloy-config.js
// Alloy client config — loaded before alloy.js on the page.
// Alloy is a separate proxy engine that uses Bare as its transport.

self.__alloy$config = {
  // Where proxied URLs live. Must match the SW scope at /alloy/alloy.sw.js
  prefix: '/alloy/',

  // Bare transport — same endpoint the Scramjet and UV engines use
  bare: '/api/edge/',

  // Runtime file paths — served from node_modules/alloyproxy/public/
  // mounted at /alloy/ by server.js
  bundle:  '/alloy/alloy.js',
  config:  '/alloy/alloy.config.js',
  handler: '/alloy/handler.js',
  sw:      '/alloy/alloy.sw.js',

  // Alloy uses base64 by default (simpler than UV's XOR cipher)
  encodeUrl: (url) => btoa(url),
  decodeUrl: (url) => atob(url),
};