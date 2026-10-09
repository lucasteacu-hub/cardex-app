const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { createMiddleware } = require('./server/recognition.cjs');
const { getConfig } = require('./server/config.cjs');
const config = getDefaultConfig(__dirname);
// Server files and credentials must never be available to the mobile bundler.
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const previous = config.resolver.blockList;
config.resolver.blockList = [...(Array.isArray(previous) ? previous : previous ? [previous] : []), new RegExp(`^${escape(path.join(__dirname, 'server'))}[/\\\\]`), /credentials\.local\.json$/];
const previousEnhancer = config.server.enhanceMiddleware;
const recognize = createMiddleware({ getConfig });
config.server.enhanceMiddleware = (middleware, server) => {
  const next = previousEnhancer ? previousEnhancer(middleware, server) : middleware;
  return (req, res, fallback) => {
    let pathname;
    try { pathname = decodeURIComponent((req.url || '').split('?')[0]); }
    catch { res.writeHead(400); return res.end(); }
    if (/(^|\/)server(\/|$)|credentials\.local\.json|(^|\/)\.env|cardex-token/.test(pathname)) {
      res.writeHead(404); return res.end();
    }
    return recognize(req, res, () => next(req, res, fallback));
  };
};
module.exports = config;
