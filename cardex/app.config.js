const { getToken } = require('./server/config.cjs');
module.exports = ({ config }) => ({ ...config, extra: { ...config.extra, recognitionToken: getToken() } });
