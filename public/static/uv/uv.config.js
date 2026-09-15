// public/static/uv/uv.config.js
// UV copy #1 — served at /static/uv/

self.__uv$config = {
  prefix: '/static/uv/',
  bare: '/api/edge/',
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: '/static/uv/uv.handler.js',
  bundle:  '/static/uv/uv.bundle.js',
  config:  '/static/uv/uv.config.js',
  sw:      '/static/uv/uv.sw.js',
};