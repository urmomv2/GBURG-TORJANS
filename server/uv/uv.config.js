// server/uv/uv.config.js
// UV copy #2 — served at /uv/

self.__uv$config = {
  prefix: '/uv/',
  bare: '/api/edge/',
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: '/uv/uv.handler.js',
  bundle:  '/uv/uv.bundle.js',
  config:  '/uv/uv.config.js',
  sw:      '/uv/uv.sw.js',
};